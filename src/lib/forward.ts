import { env } from "@/lib/env";
import { insertDelivery, updateRequest } from "@/lib/repo";
import type { Delivery, WebhookRequest } from "@/lib/types";

/** Hop-by-hop or origin-specific headers we never replay to a target. */
const STRIP_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "keep-alive",
  "upgrade",
  "expect",
  "te",
  "trailer",
  "proxy-authorization",
  "proxy-connection",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-real-ip",
  "x-vercel-id",
  "x-vercel-deployment-url",
  "x-vercel-forwarded-for",
  "x-vercel-ip-country",
  "x-vercel-ip-city",
  "x-vercel-ip-latitude",
  "x-vercel-ip-longitude",
  "x-vercel-ip-timezone",
  "x-vercel-ip-country-region",
  "x-vercel-ip-continent",
  "x-vercel-ip-as-number",
  "x-vercel-ip-postal-code",
  "x-vercel-proxied-for",
  "x-vercel-proxy-signature",
  "x-vercel-proxy-signature-ts",
  "x-vercel-ja4-digest",
  "x-vercel-internal-ingress-bucket",
  "x-vercel-internal-intra-session",
  "x-vercel-sc-headers",
  "x-vercel-sc-host",
  "x-vercel-sc-basepath",
  "x-vercel-oidc-token",
  "x-middleware-subrequest",
  "forwarded",
  "cdn-loop",
  "cf-connecting-ip",
  "cf-ray",
  "cf-visitor",
  "cf-ipcountry",
  "true-client-ip",
  "x-matched-path",
  "x-invoke-path",
  "x-invoke-query",
  "x-invoke-output",
]);

export interface DeliverOptions {
  /** Append the request's sub-path to the target (endpoint-level forwarding). Routes pass false. */
  appendPath?: boolean;
  /** Extra headers to add (route-level forwarding). */
  extraHeaders?: Record<string, string>;
  /** Which route triggered this delivery, for bookkeeping. */
  routeId?: string | null;
}

export function buildTargetUrl(base: string, req: WebhookRequest, appendPath = true): string {
  const url = new URL(base);
  // Preserve the sub-path below the endpoint slug, appended to the target path.
  if (appendPath && req.path) {
    url.pathname = url.pathname.replace(/\/$/, "") + "/" + req.path.replace(/^\//, "");
  }
  // Merge original query params (target's own params win on conflict).
  for (const [k, v] of Object.entries(req.query)) {
    if (url.searchParams.has(k)) continue;
    if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(k, item));
    else url.searchParams.set(k, v);
  }
  return url.toString();
}

function decodeBody(req: WebhookRequest): BodyInit | undefined {
  if (req.body == null || req.body_encoding === "none") return undefined;
  if (req.body_encoding === "base64") return Buffer.from(req.body, "base64");
  return req.body;
}

/**
 * Re-issue a stored request against `targetUrl` and persist the outcome as a
 * delivery. Used both for live forwarding right after capture and for
 * user-triggered replays from the UI.
 */
export async function deliver(
  req: WebhookRequest,
  targetUrl: string,
  kind: Delivery["kind"],
  opts: DeliverOptions = {},
): Promise<Delivery> {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (STRIP_HEADERS.has(k.toLowerCase())) continue;
    headers.set(k, v);
  }
  for (const [k, v] of Object.entries(opts.extraHeaders ?? {})) headers.set(k, v);
  headers.set("x-laterhook-request-id", req.id);
  headers.set("x-laterhook-endpoint", req.endpoint_slug);
  headers.set("x-laterhook-delivery", kind);
  headers.set("x-laterhook-received-at", req.received_at);
  if (opts.routeId) headers.set("x-laterhook-route", opts.routeId);

  const url = buildTargetUrl(targetUrl, req, opts.appendPath ?? true);
  const method = req.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : decodeBody(req);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.forwardTimeoutMs);
  const started = Date.now();
  let outcome: Omit<Delivery, "id" | "created_at">;
  try {
    const res = await fetch(url, { method, headers, body, signal: controller.signal, redirect: "manual" });
    const text = await res.text().catch(() => "");
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => (responseHeaders[k] = v));
    outcome = {
      request_id: req.id,
      endpoint_id: req.endpoint_id,
      kind,
      target_url: url,
      status_code: res.status,
      response_headers: responseHeaders,
      response_body: text.slice(0, 64 * 1024),
      duration_ms: Date.now() - started,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? (err.name === "AbortError" ? `Timed out after ${env.forwardTimeoutMs}ms` : err.message) : String(err);
    outcome = {
      request_id: req.id,
      endpoint_id: req.endpoint_id,
      kind,
      target_url: url,
      status_code: null,
      response_headers: null,
      response_body: null,
      duration_ms: Date.now() - started,
      error: message,
    };
  } finally {
    clearTimeout(timer);
  }
  const delivery = await insertDelivery(outcome);
  if (kind === "forward") {
    await updateRequest(req.id, { forward_status: outcome.status_code, forward_error: outcome.error });
  }
  return delivery;
}
