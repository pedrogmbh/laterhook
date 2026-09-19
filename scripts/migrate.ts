/**
 * Apply the schema to the configured database. Not strictly needed (the app
 * does this on first use) but handy to validate credentials before deploying.
 *
 *   bun run db:migrate
 */
import { env } from "../src/lib/env";
import { createD1 } from "../src/lib/db";
import { POST_MIGRATION_STATEMENTS, SCHEMA_MIGRATIONS, SCHEMA_STATEMENTS } from "../src/lib/db/schema";

async function main() {
  if (env.databaseDriver !== "d1") {
    console.log("DATABASE_DRIVER is sqlite: the local schema is created automatically on first request.");
    return;
  }
  const db = createD1();
  await db.batch(SCHEMA_STATEMENTS.map((sql) => ({ sql })));
  for (const sql of SCHEMA_MIGRATIONS) {
    try {
      await db.query(sql);
    } catch (err) {
      if (!/duplicate column/i.test(err instanceof Error ? err.message : String(err))) throw err;
    }
  }
  await db.batch(POST_MIGRATION_STATEMENTS.map((sql) => ({ sql })));
  const { rows } = await db.query<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`);
  console.log(`D1 schema ready (via ${env.d1Worker ? "the laterhook-d1 Worker" : "the REST API"}). Tables:`, rows.map((r) => r.name).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
