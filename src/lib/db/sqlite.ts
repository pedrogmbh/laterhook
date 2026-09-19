import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Database, QueryResult, SqlValue } from "./types";

/**
 * Local development driver on Node's built-in `node:sqlite` (Node ≥ 22.5).
 * Same SQL dialect as D1, so anything that works here works there.
 */
export async function createSqliteDatabase(path: string): Promise<Database> {
  // Dev-only driver: tell Turbopack not to trace the whole project for this dynamic path.
  const abs = resolve(/*turbopackIgnore: true*/ process.cwd(), path);
  mkdirSync(dirname(abs), { recursive: true });
  // Dynamic import keeps the bundler from trying to resolve node:sqlite for
  // builds that never use this driver.
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(abs);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");

  function run<Row>(sql: string, params: SqlValue[] = []): QueryResult<Row> {
    const stmt = db.prepare(sql);
    const isRead = /^\s*(select|pragma|with)\b/i.test(sql) || /\breturning\b/i.test(sql);
    if (isRead) {
      return { rows: stmt.all(...params) as Row[], changes: 0 };
    }
    const info = stmt.run(...params);
    return { rows: [], changes: Number(info.changes) };
  }

  return {
    driver: "sqlite",
    async query<Row>(sql: string, params: SqlValue[] = []) {
      return run<Row>(sql, params);
    },
    async batch(statements) {
      db.exec("BEGIN");
      try {
        for (const s of statements) run(s.sql, s.params ?? []);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
