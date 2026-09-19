import { env } from "@/lib/env";
import { createD1Database } from "./d1";
import { createSqliteDatabase } from "./sqlite";
import { SCHEMA_STATEMENTS } from "./schema";
import type { Database } from "./types";

export type { Database, QueryResult, SqlValue } from "./types";

// Cache across hot reloads in dev and across invocations on a warm function.
const globalCache = globalThis as unknown as {
  __laterhookDb?: Promise<Database>;
};

async function connect(): Promise<Database> {
  const driver = env.databaseDriver;
  const db =
    driver === "d1" ? createD1Database(env.d1) : await createSqliteDatabase(env.sqlitePath);
  await db.batch(SCHEMA_STATEMENTS.map((sql) => ({ sql })));
  return db;
}

/** Returns the shared database, creating the schema on first use. */
export function getDb(): Promise<Database> {
  if (!globalCache.__laterhookDb) {
    globalCache.__laterhookDb = connect().catch((err) => {
      // Don't cache a failed connection.
      globalCache.__laterhookDb = undefined;
      throw err;
    });
  }
  return globalCache.__laterhookDb;
}
