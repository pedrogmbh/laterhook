/**
 * laterhook-d1: a tiny Cloudflare Worker that gives Laterhook (running on
 * Vercel) access to D1 through a Worker binding instead of the REST API.
 *
 * Why: D1 read replication needs the Sessions API (`withSession`), which only
 * exists on the Worker binding. The binding is also much cheaper per query
 * than the REST API. Laterhook uses this Worker only when
 * LATERHOOK_D1_WORKER_URL and LATERHOOK_D1_WORKER_SECRET are set.
 *
 * Protocol (POST /query, `Authorization: Bearer <secret>`):
 *   → { statements: [{ sql, params? }], bookmark?: string }
 *   ← { results: [{ rows, changes, servedByRegion, servedByPrimary }], bookmark }
 * `bookmark` is a D1 bookmark or one of "first-unconstrained" (any replica)
 * and "first-primary". Several statements run as one D1 batch (a transaction).
 * Errors come back as `{ error }` with status 400 (SQL) or 401/404/405.
 */

// Minimal slices of the Workers D1 types, so this file needs no extra packages.
type SqlValue = string | number | null;
interface D1Meta {
  changes?: number;
  served_by_region?: string;
  served_by_primary?: boolean;
}
interface D1Result {
  results?: Record<string, unknown>[];
  meta: D1Meta;
}
interface D1PreparedStatement {
  bind(...values: SqlValue[]): D1PreparedStatement;
  all(): Promise<D1Result>;
}
interface D1DatabaseSession {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
  getBookmark(): string | null;
}
interface D1Database {
  withSession(constraintOrBookmark?: string): D1DatabaseSession;
}

interface Env {
  DB: D1Database;
  LATERHOOK_D1_WORKER_SECRET: string;
}

interface QueryBody {
  statements?: { sql?: unknown; params?: unknown }[];
  bookmark?: unknown;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

/** Constant-time comparison: hash both sides so lengths don't leak either. */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function isSqlValue(v: unknown): v is SqlValue {
  return v === null || typeof v === "string" || typeof v === "number";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname !== "/query") return json({ error: "Not found" }, 404);
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const secret = env.LATERHOOK_D1_WORKER_SECRET;
    const auth = request.headers.get("authorization") ?? "";
    if (!secret || !(await safeEqual(auth, `Bearer ${secret}`))) return json({ error: "Unauthorized" }, 401);

    let body: QueryBody;
    try {
      body = (await request.json()) as QueryBody;
    } catch {
      return json({ error: "Body must be JSON" }, 400);
    }
    const statements = Array.isArray(body.statements) ? body.statements : [];
    if (statements.length === 0) return json({ error: "No statements" }, 400);
    for (const s of statements) {
      if (typeof s?.sql !== "string" || (s.params !== undefined && !(Array.isArray(s.params) && s.params.every(isSqlValue)))) {
        return json({ error: "Each statement needs { sql: string, params?: (string|number|null)[] }" }, 400);
      }
    }

    const bookmark = typeof body.bookmark === "string" && body.bookmark ? body.bookmark : "first-unconstrained";
    const session = env.DB.withSession(bookmark);
    try {
      const prepared = statements.map((s) => {
        const stmt = session.prepare(s.sql as string);
        const params = (s.params ?? []) as SqlValue[];
        return params.length ? stmt.bind(...params) : stmt;
      });
      const results = prepared.length === 1 ? [await prepared[0].all()] : await session.batch(prepared);
      return json({
        results: results.map((r) => ({
          rows: r.results ?? [],
          changes: r.meta.changes ?? 0,
          servedByRegion: r.meta.served_by_region ?? null,
          servedByPrimary: r.meta.served_by_primary ?? null,
        })),
        bookmark: session.getBookmark(),
      });
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : String(err), bookmark: session.getBookmark() }, 400);
    }
  },
};
