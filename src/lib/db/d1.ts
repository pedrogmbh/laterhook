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
      const authProblem = res.status === 401 || res.status === 403 || json.errors?.some((e) => e.code === 7403 || e.code === 10000);
      throw new Error(
        `D1 query failed: ${msg}` +
          (authProblem
            ? ". Check the token/account: a CLOUDFLARE_API_TOKEN exported by your shell overrides .env files; set LATERHOOK_D1_TOKEN to pin this project's token."
            : ""),
      );
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
