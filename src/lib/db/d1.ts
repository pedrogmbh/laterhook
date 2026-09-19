import type { Database, QueryResult, SqlValue } from "./types";

interface D1ApiResult {
  results?: Record<string, unknown>[];
  success: boolean;
  meta?: { changes?: number; rows_written?: number };
}

interface D1ApiResponse {
  success: boolean;
  errors?: { code: number; message: string }[];
  result?: D1ApiResult[];
}

/**
 * Cloudflare D1 over its HTTPS REST API. This is what runs on Vercel, where we
 * have no Workers binding. One round-trip per statement; `batch` sends several
 * statements in a single request.
 */
export function createD1Database(opts: {
  accountId: string;
  databaseId: string;
  apiToken: string;
}): Database {
  const url = `https://api.cloudflare.com/client/v4/accounts/${opts.accountId}/d1/database/${opts.databaseId}/query`;

  async function call(sql: string, params: SqlValue[] = []): Promise<D1ApiResult[]> {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
      cache: "no-store",
    });
    let json: D1ApiResponse;
    try {
      json = (await res.json()) as D1ApiResponse;
    } catch {
      throw new Error(`D1: unexpected non-JSON response (HTTP ${res.status})`);
    }
    if (!res.ok || !json.success) {
      const msg = json.errors?.map((e) => `${e.code}: ${e.message}`).join("; ") || `HTTP ${res.status}`;
      throw new Error(`D1 query failed: ${msg}`);
    }
    return json.result ?? [];
  }

  return {
    driver: "d1",
    async query<Row>(sql: string, params: SqlValue[] = []): Promise<QueryResult<Row>> {
      const [first] = await call(sql, params);
      return {
        rows: (first?.results ?? []) as Row[],
        changes: first?.meta?.changes ?? first?.meta?.rows_written ?? 0,
      };
    },
    async batch(statements) {
      // D1's /query accepts several ';'-separated statements only when they share
      // no bound params, so parameterised statements go one by one.
      const bare = statements.filter((s) => !s.params || s.params.length === 0);
      const bound = statements.filter((s) => s.params && s.params.length > 0);
      if (bare.length) await call(bare.map((s) => s.sql.trim().replace(/;$/, "")).join(";\n"));
      for (const s of bound) await call(s.sql, s.params);
    },
  };
}
