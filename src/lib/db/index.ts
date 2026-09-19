import { env } from "@/lib/env";
import { createD1Database } from "./d1";
import { createD1WorkerDatabase } from "./d1-worker";
import { createSqliteDatabase } from "./sqlite";
import { POST_MIGRATION_STATEMENTS, SCHEMA_MIGRATIONS, SCHEMA_STATEMENTS } from "./schema";
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
  const driver = env.databaseDriver;
  // Credentials are part of the key (hashed, never stored) so an env change picks up a fresh connection.
  const creds = driver === "d1" ? JSON.stringify(env.d1Worker ?? env.d1) : env.sqlitePath;
  const text = [...SCHEMA_STATEMENTS, ...SCHEMA_MIGRATIONS, ...POST_MIGRATION_STATEMENTS].join(";") + "|" + driver + "|" + creds;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

async function connect(): Promise<Database> {
  const driver = env.databaseDriver;
  const db = driver === "d1" ? createD1() : await createSqliteDatabase(env.sqlitePath);
  await db.batch(SCHEMA_STATEMENTS.map((sql) => ({ sql })));
  for (const sql of SCHEMA_MIGRATIONS) {
    try {
      await db.query(sql);
    } catch (err) {
      if (!/duplicate column/i.test(err instanceof Error ? err.message : String(err))) throw err;
    }
  }
  await db.batch(POST_MIGRATION_STATEMENTS.map((sql) => ({ sql })));
  return db;
}

/** D1 through the optional Worker (read replicas) when configured, else the REST API. */
export function createD1(): Database {
  const worker = env.d1Worker;
  return worker ? createD1WorkerDatabase(worker) : createD1Database(env.d1);
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
