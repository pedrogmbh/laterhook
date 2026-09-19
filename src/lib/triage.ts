import { createGateway, experimental_evaluate as evaluate, type JSONValue } from "ai";
import { env } from "@/lib/env";
import { getCachedIpInfo } from "@/lib/ipinfo";
import { getInsight, upsertInsight } from "@/lib/repo";
import { ATTENTION_LEVELS, isRateLimited, TRIAGE_KINDS, TRIAGE_SOURCES } from "@/lib/triage-meta";
import type { IpInfo, RequestInsight, TriageKind, WebhookRequest } from "@/lib/types";

/**
 * Optional AI triage with TypeSafe's Jev, a System One model that returns
 * typed judgments (choices, scores, probabilities) instead of text, called
 * through Vercel AI Gateway. Enabled only when AI_GATEWAY_API_KEY is set and
 * TYPESAFE_AI_ENABLED is on; capture never waits for it.
 *
 * One call asks five independent questions about the same request state.
 * Code keeps the exact parts (event name, redaction, thresholds); the model
 * only supplies the judgments ordinary code can't make.
 */

const TIMEOUT_MS = 10_000;
/** A failed triage is retried when the request is viewed again after this long. */
const RETRY_AFTER_MS = 5 * 60_000;
/** Jev reads 32k tokens of state; keep bodies well under that. */
const MAX_BODY_CHARS = 16_000;

export function triageEnabled(): boolean {
  return Boolean(env.aiGatewayApiKey) && env.typesafeAiEnabled;
}

const cache = globalThis as unknown as { __laterhookGateway?: { key: string; gateway: ReturnType<typeof createGateway> } };

function model() {
  const key = env.aiGatewayApiKey;
  if (!key) throw new Error("AI_GATEWAY_API_KEY is not configured");
  if (cache.__laterhookGateway?.key !== key) cache.__laterhookGateway = { key, gateway: createGateway({ apiKey: key }) };
  return cache.__laterhookGateway.gateway.evaluationModel(env.typesafeAiModel);
}

// ---------- state ----------

/** Platform/proxy headers say nothing about the sender. */
const INFRA_HEADER = /^(x-vercel-|x-forwarded-|forwarded$|x-real-ip$|x-matched-path$|cf-|cdn-loop$|x-invoke-|host$|connection$|content-length$|accept-encoding$|via$|traceparent$|tracestate$|baggage$|sentry-trace$)/i;
/** Credentials never leave laterhook; the header *name* is kept because it identifies senders (stripe-signature, x-hub-signature-256…). */
const SECRET_HEADER = /(authorization|cookie|signature|token|secret|api-?key|password|-key$|^x-hook-)/i;

function headersForState(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (INFRA_HEADER.test(k)) continue;
    out[k] = SECRET_HEADER.test(k) ? "[redacted]" : v.length > 300 ? `${v.slice(0, 300)}…` : v;
  }
  return out;
}

function bodyForState(r: WebhookRequest): JSONValue {
  if (!r.body) return null;
  if (r.body_encoding === "base64") return `[binary body, ${r.size} bytes, ${r.content_type ?? "unknown type"}]`;
  const text = r.body;
  try {
    const parsed = JSON.parse(text) as JSONValue;
    if (text.length <= MAX_BODY_CHARS) return parsed;
  } catch {
    /* not JSON: send as text */
  }
  return text.length > MAX_BODY_CHARS ? `${text.slice(0, MAX_BODY_CHARS)}… [truncated, ${r.size} bytes total]` : text;
}

/** Network facts about the sender (from the ip-api cache) help tell services from scanners. */
function senderForState(info: IpInfo | null): JSONValue {
  if (!info || info.status !== "success") return null;
  const d = info.data;
  const out: Record<string, JSONValue> = {};
  for (const [k, v] of Object.entries({ country: d.country, isp: d.isp, org: d.org, as: d.asname, reverse_dns: d.reverse, proxy_or_vpn: d.proxy, datacenter: d.hosting, mobile: d.mobile })) {
    if (v !== undefined && v !== "") out[k] = v;
  }
  return out;
}

function stateFor(r: WebhookRequest, ipInfo: IpInfo | null) {
  return {
    request: {
      method: r.method,
      path: `/${r.endpoint_slug}${r.path ? `/${r.path}` : ""}`,
      query: r.query,
      content_type: r.content_type,
      user_agent: r.user_agent,
      headers: headersForState(r.headers),
      body_truncated_on_capture: r.body_truncated,
    },
    body: bodyForState(r),
    sender_network: senderForState(ipInfo),
    context:
      "This HTTP request arrived at a public webhook inbox URL. The first path segment is a name the owner chose for the endpoint. Header values shown as [redacted] were removed for privacy and are not evidence of anything.",
  };
}

// ---------- event name (code, not model) ----------

const EVENT_HEADERS = ["x-github-event", "x-gitlab-event", "x-shopify-topic", "x-event-key", "x-wc-webhook-topic", "linear-event", "x-twilio-event", "x-event-type", "x-webhook-event"];
const EVENT_KEYS = ["type", "event_type", "eventType", "event", "topic", "trigger", "action"];

/** Read the sender's own event name from well-known headers and body keys. */
export function extractEventName(r: Pick<WebhookRequest, "headers" | "body" | "body_encoding">): string | null {
  const clean = (v: unknown) => (typeof v === "string" && v.trim() && v.length <= 80 && !/\s{2,}|\n/.test(v) ? v.trim() : null);
  let body: Record<string, unknown> | null = null;
  if (r.body && r.body_encoding === "utf8") {
    try {
      const parsed: unknown = JSON.parse(r.body);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
    } catch {
      /* not JSON */
    }
  }
  for (const h of EVENT_HEADERS) {
    const v = clean(r.headers[h]);
    if (v) {
      // GitHub-style: header names the entity, body.action the transition (pull_request.opened).
      const action = clean(body?.action);
      return action && h === "x-github-event" ? `${v}.${action}` : v;
    }
  }
  if (!body) return null;
  // Slack Events API wraps the real event: { type: "event_callback", event: { type: "app_mention" } }.
  const inner = body.event;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    const v = clean((inner as Record<string, unknown>).type);
    if (v) return v;
  }
  for (const k of EVENT_KEYS) {
    const v = clean(body[k]);
    if (v) return v;
  }
  return null;
}

// ---------- questions ----------

const describe = (m: Record<string, { description: string }>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.description]));

const QUESTIONS = {
  source: {
    type: "choice",
    instructions:
      "Which service most likely sent this HTTP request? Use the headers (including which header names are present), the user agent, the path and the body shape.",
    criteria: describe(TRIAGE_SOURCES) as Record<keyof typeof TRIAGE_SOURCES, string>,
  },
  kind: {
    type: "choice",
    instructions: "What kind of request is this?",
    criteria: describe(TRIAGE_KINDS) as Record<TriageKind, string>,
  },
  attention: {
    type: "score",
    instructions: "How urgently should the developer who owns this webhook inbox look at this request?",
    criteria: [...ATTENTION_LEVELS],
  },
  failure: {
    type: "boolean",
    instructions: "Does this request report that an operation failed, errored, was declined, was rejected or timed out?",
    criteria: {
      true: "The payload describes a failure, error, decline, rejection or timeout",
      false: "The payload describes a success, a neutral change, or no outcome at all",
    },
  },
  sensitive: {
    type: "boolean",
    instructions:
      "Does the request body or query string contain personal data or secrets in plain text, such as email addresses, phone numbers, street addresses, payment card numbers, passwords or API keys?",
    criteria: {
      true: "At least one such value appears in plain text",
      false: "No personal data or secrets appear (IDs, amounts and redacted values do not count)",
    },
  },
} as const;

// ---------- run ----------

/** Triage one request and store the result (an error row on failure). Never throws. */
export async function triageRequest(r: WebhookRequest, opts: { maxRetries?: number } = {}): Promise<RequestInsight | null> {
  if (!triageEnabled()) return null;
  const event = extractEventName(r);
  const started = Date.now();
  try {
    const ipInfo = r.ip ? await getCachedIpInfo(r.ip).catch(() => null) : null;
    const result = await evaluate({
      model: model(),
      state: stateFor(r, ipInfo),
      questions: QUESTIONS,
      maxRetries: opts.maxRetries ?? 1,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const a = result.answers;
    const typesafe = result.providerMetadata?.typesafe as { confidence?: Record<string, number> } | undefined;
    return await upsertInsight({
      request_id: r.id,
      status: "ok",
      model: env.typesafeAiModel,
      event,
      source: a.source.choice,
      kind: a.kind.choice,
      attention: a.attention.score,
      failure: a.failure.probability,
      sensitive: a.sensitive.probability,
      probabilities: {
        ...(a.source.probabilities && { source: a.source.probabilities }),
        ...(a.kind.probabilities && { kind: a.kind.probabilities }),
        ...(a.attention.probabilities && { attention: a.attention.probabilities }),
      },
      confidence: typesafe?.confidence ?? {},
      input_tokens: result.usage.inputTokens ?? null,
      duration_ms: Date.now() - started,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "triage failed";
    console.error("[laterhook] triage failed", r.id, message);
    try {
      return await upsertInsight({ request_id: r.id, status: "error", model: env.typesafeAiModel, event, error: message.slice(0, 500), duration_ms: Date.now() - started });
    } catch {
      return null;
    }
  }
}

/**
 * Stored triage for a request, running it the first time the request is
 * looked at, or again when an earlier attempt failed a while ago.
 */
export async function ensureTriage(r: WebhookRequest): Promise<RequestInsight | null> {
  const existing = await getInsight(r.id);
  if (!triageEnabled()) return existing;
  if (existing && (existing.status === "ok" || Date.now() - new Date(existing.created_at).getTime() < RETRY_AFTER_MS)) return existing;
  // A page render is waiting: one attempt, no backoff.
  return triageRequest(r, { maxRetries: 0 });
}

/**
 * Triage several requests with bounded concurrency. Stops early when the
 * Gateway rate-limits us; the rest stay untriaged for a later run.
 */
export async function triageMany(requests: WebhookRequest[], concurrency = 3): Promise<{ ok: number; rateLimited: boolean }> {
  let ok = 0;
  let next = 0;
  let rateLimited = false;
  const worker = async () => {
    while (next < requests.length && !rateLimited) {
      const insight = await triageRequest(requests[next++]);
      if (insight?.status === "ok") ok++;
      else if (isRateLimited(insight)) rateLimited = true;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, requests.length) }, worker));
  return { ok, rateLimited };
}
