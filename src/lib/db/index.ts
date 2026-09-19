import { env } from "@/lib/env";
import { createD1Database } from "./d1";
import { createSqliteDatabase } from "./sqlite";
import { SCHEMA_STATEMENTS } from "./schema";
import type { Database } from "./types";

export type { Database, QueryResult, SqlValue } from "./types";

// Cache across hot reloads in dev and across invocations on a warm function.
// The cache is keyed by a fingerprint of the schema so that editing schema.ts
// re-applies it (statements are idempotent) instead of reusing a stale setup.
const globalCache = globalThis as unknown as {
  __laterhookDb?: { key: string; promise: Promise<Database> };
};

function schemaKey(): string {
  let h = 0;
  const text = SCHEMA_STATEMENTS.join(";") + "|" + env.databaseDriver;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

async function connect(): Promise<Database> {
  const driver = env.databaseDriver;
  const db =
    driver === "d1" ? createD1Database(env.d1) : await createSqliteDatabase(env.sqlitePath);
  await db.batch(SCHEMA_STATEMENTS.map((sql) => ({ sql })));
  return db;
}

/** Returns the shared database, creating or updating the schema on first use. */
export function getDb(): Promise<Database> {
  const key = schemaKey();
  if (!globalCache.__laterhookDb || globalCache.__laterhookDb.key !== key) {
    const promise = connect().catch((err) => {
      // Don't cache a failed connection.
      if (globalCache.__laterhookDb?.promise === promise) globalCache.__laterhookDb = undefined;
      throw err;
    });
    globalCache.__laterhookDb = { key, promise };
  }
  return globalCache.__laterhookDb.promise;
}
