import { after, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { deliver } from "@/lib/forward";
import { ipLookupEnabled, lookupIp } from "@/lib/ipinfo";
import { ensureEndpoint, insertRequest } from "@/lib/repo";
import type { BodyEncoding } from "@/lib/types";

/**
 * The catch-all inbox. Any method, any path under /webhooks/<slug>/... is
 * accepted, persisted, and acknowledged. The first path segment becomes the
 * endpoint; the rest is kept as a sub-path so deep paths still round-trip when
 * forwarding.
 */

const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS",
  "access-control-allow-headers": "*",
  "access-control-max-age": "86400",
};

function usage(request: NextRequest) {
  const base = env.publicBaseUrl ?? request.nextUrl.origin;
  return Response.json(
    {
      service: "laterhook",
      usage: `Send any HTTP request to ${base}/webhooks/<name>[/<any/deeper/path>] and it will be captured.`,
      example: `curl -X POST ${base}/webhooks/my-product/stripe -H 'content-type: application/json' -d '{"hello":"world"}'`,
    },
    { headers: CORS_HEADERS },
  );
}

function looksBinary(contentType: string | null): boolean {
  if (!contentType) return false;
  const ct = contentType.toLowerCase();
  if (ct.startsWith("text/")) return false;
  if (/json|xml|javascript|x-www-form-urlencoded|graphql|yaml|csv|html|svg/.test(ct)) return false;
  return /^(image|audio|video|application\/(octet-stream|pdf|zip|gzip|protobuf|msgpack|x-)|multipart\/)/.test(ct);
}

async function readBody(request: NextRequest, contentType: string | null) {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD") {
    return { body: null, encoding: "none" as BodyEncoding, truncated: false, size: 0 };
  }
  const buf = new Uint8Array(await request.arrayBuffer());
  const size = buf.byteLength;
  if (size === 0) return { body: null, encoding: "none" as BodyEncoding, truncated: false, size };
  const max = env.maxBodyBytes;
  const truncated = size > max;
  const slice = truncated ? buf.subarray(0, max) : buf;

  if (!looksBinary(contentType)) {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(slice);
      return { body: text, encoding: "utf8" as BodyEncoding, truncated, size };
    } catch {
      // fall through to base64
    }
  }
  return { body: Buffer.from(slice).toString("base64"), encoding: "base64" as BodyEncoding, truncated, size };
}

async function capture(request: NextRequest, ctx: RouteContext<"/webhooks/[[...path]]">) {
  const { path = [] } = await ctx.params;
  if (path.length === 0) return usage(request);

  const [rawSlug, ...rest] = path;
  const slug = decodeURIComponent(rawSlug);
  if (!SLUG_RE.test(slug)) {
    return Response.json(
      { error: "invalid endpoint name", hint: "Use letters, numbers, dots, dashes or underscores (max 64 chars)." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Browser CORS preflights are noise; answer them without storing.
  if (request.method === "OPTIONS" && request.headers.has("access-control-request-method")) {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const headers: Record<string, string> = {};
  request.headers.forEach((v, k) => (headers[k] = v));
  const contentType = request.headers.get("content-type");

  const query: Record<string, string | string[]> = {};
  for (const [k, v] of request.nextUrl.searchParams) {
    const prev = query[k];
    if (prev === undefined) query[k] = v;
    else query[k] = Array.isArray(prev) ? [...prev, v] : [prev, v];
  }

  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("cf-connecting-ip") ??
    null;

  try {
    const [endpoint, body] = await Promise.all([ensureEndpoint(slug), readBody(request, contentType)]);
    const stored = await insertRequest({
      endpoint,
      path: rest.map(decodeURIComponent).join("/"),
      method: request.method.toUpperCase(),
      url: request.nextUrl.toString(),
      headers,
      query,
      body: body.body,
      body_encoding: body.encoding,
      body_truncated: body.truncated,
      content_type: contentType,
      size: body.size,
      ip,
      user_agent: request.headers.get("user-agent"),
    });

    if (ip && ipLookupEnabled()) {
      after(async () => {
        try {
          await lookupIp(ip);
        } catch (err) {
          console.error("[laterhook] ip lookup failed", ip, err);
        }
      });
    }

    if (endpoint.forward_enabled && endpoint.forward_url) {
      const target = endpoint.forward_url;
      after(async () => {
        try {
          await deliver(stored, target, "forward");
        } catch (err) {
          console.error("[laterhook] forward failed", stored.id, err);
        }
      });
    }

    const respHeaders: Record<string, string> = {
      ...CORS_HEADERS,
      "x-laterhook-id": stored.id,
      "x-laterhook-endpoint": endpoint.slug,
    };
    if (endpoint.response_body != null && endpoint.response_body !== "") {
      respHeaders["content-type"] = endpoint.response_content_type || "application/json; charset=utf-8";
      return new Response(request.method === "HEAD" ? null : endpoint.response_body, {
        status: endpoint.response_status,
        headers: respHeaders,
      });
    }
    respHeaders["content-type"] = "application/json; charset=utf-8";
    return new Response(
      request.method === "HEAD"
        ? null
        : JSON.stringify({ ok: true, id: stored.id, endpoint: endpoint.slug, received_at: stored.received_at }),
      { status: endpoint.response_status, headers: respHeaders },
    );
  } catch (err) {
    console.error("[laterhook] capture failed", err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "capture failed" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

export const GET = capture;
export const POST = capture;
export const PUT = capture;
export const PATCH = capture;
export const DELETE = capture;
export const HEAD = capture;
export const OPTIONS = capture;
