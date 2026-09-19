/**
 * Apply the schema to the configured database. Not strictly needed (the app
 * does this on first use) but handy to validate credentials before deploying.
 *
 *   bun run db:migrate
 */
import { env } from "../src/lib/env";
import { createD1Database } from "../src/lib/db/d1";
import { SCHEMA_STATEMENTS } from "../src/lib/db/schema";

async function main() {
  if (env.databaseDriver !== "d1") {
    console.log("DATABASE_DRIVER is sqlite: the local schema is created automatically on first request.");
    return;
  }
  const db = createD1Database(env.d1);
  await db.batch(SCHEMA_STATEMENTS.map((sql) => ({ sql })));
  const { rows } = await db.query<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`);
  console.log("D1 schema ready. Tables:", rows.map((r) => r.name).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
