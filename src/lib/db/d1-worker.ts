import type { Database, QueryResult, SqlValue } from "./types";

interface WorkerResult {
  rows: Record<string, unknown>[];
  changes: number;
  servedByRegion: string | null;
  servedByPrimary: boolean | null;
}

interface WorkerResponse {
  results?: WorkerResult[];
  bookmark?: string | null;
  error?: string;
}

// Latest D1 bookmark this process has seen. Sending it with every query keeps
// reads sequentially consistent (read-your-writes, monotonic reads) across
// requests served by the same warm function, even when replicas answer.
const state = globalThis as unknown as { __laterhookD1Bookmark?: string };

function remember(bookmark: string | null | undefined) {
  // Bookmarks sort lexicographically from oldest to newest.
  if (bookmark && (!state.__laterhookD1Bookmark || bookmark > state.__laterhookD1Bookmark)) state.__laterhookD1Bookmark = bookmark;
}

/**
 * Cloudflare D1 through the optional `laterhook-d1` Worker (`worker/`), which
 * uses the Worker binding and the Sessions API. That lets reads be served by
 * the nearest read replica, and skips the REST API's per-call overhead.
 */
export function createD1WorkerDatabase(opts: { url: string; secret: string; readReplicas: boolean }): Database {
  const endpoint = new URL("/query", opts.url).toString();

  async function call(statements: { sql: string; params?: SqlValue[] }[]): Promise<WorkerResult[]> {
    // "first-primary" pins the whole session to the primary (replicas off).
    const bookmark = opts.readReplicas ? (state.__laterhookD1Bookmark ?? "first-unconstrained") : "first-primary";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ statements, bookmark }),
      cache: "no-store",
    });
    let json: WorkerResponse;
    try {
      json = (await res.json()) as WorkerResponse;
    } catch {
      throw new Error(`D1 worker: unexpected non-JSON response (HTTP ${res.status}) from ${endpoint}`);
    }
    remember(json.bookmark);
    if (!res.ok || json.error) {
      const hint = res.status === 401 ? ". LATERHOOK_D1_WORKER_SECRET must match the Worker's secret (bun run worker:secret)." : "";
      throw new Error(`D1 query failed: ${json.error ?? `HTTP ${res.status}`}${hint}`);
    }
    return json.results ?? [];
  }

  return {
    driver: "d1",
    async query<Row>(sql: string, params: SqlValue[] = []): Promise<QueryResult<Row>> {
      const [first] = await call([{ sql, params }]);
      return { rows: (first?.rows ?? []) as Row[], changes: first?.changes ?? 0 };
    },
    async batch(statements) {
      // One round trip; D1 runs a batch as a single transaction.
      if (statements.length) await call(statements.map((s) => ({ sql: s.sql, params: s.params ?? [] })));
    },
  };
}
