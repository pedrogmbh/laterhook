/**
 * Central place for every environment variable laterhook reads.
 * Nothing else in the codebase should touch `process.env` directly.
 */

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

function required(name: string): string {
  const v = optional(name);
  if (!v) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example.`,
    );
  }
  return v;
}

export type DatabaseDriver = "d1" | "sqlite";

/**
 * D1 credentials. The LATERHOOK_D1_* names win over the generic CLOUDFLARE_*
 * ones so a global CLOUDFLARE_API_TOKEN exported by a shell profile (common
 * for wrangler users) can't silently shadow the project's token.
 */
function d1Var(specific: string, generic: string): string | undefined {
  return optional(specific) ?? optional(generic);
}
const d1AccountId = () => d1Var("LATERHOOK_D1_ACCOUNT_ID", "CLOUDFLARE_ACCOUNT_ID");
const d1DatabaseId = () => d1Var("LATERHOOK_D1_DATABASE_ID", "CLOUDFLARE_D1_DATABASE_ID");
const d1Token = () => d1Var("LATERHOOK_D1_TOKEN", "CLOUDFLARE_API_TOKEN");

function requiredD1(specific: string, generic: string): string {
  const v = d1Var(specific, generic);
  if (!v) throw new Error(`Missing ${specific} (or ${generic}). See .env.example.`);
  return v;
}

function resolveDriver(): DatabaseDriver {
  const explicit = optional("DATABASE_DRIVER")?.toLowerCase();
  if (explicit === "d1" || explicit === "sqlite") return explicit;
  // Infer: if Cloudflare credentials are present, use D1; otherwise local SQLite.
  if (d1AccountId() && d1DatabaseId() && d1Token()) return "d1";
  return "sqlite";
}

export const env = {
  /** Fixed dashboard password. */
  get password(): string {
    return required("LATERHOOK_PASSWORD");
  },
  /** Secret used to sign the session cookie. Falls back to the password (weaker, but zero-setup). */
  get sessionSecret(): string {
    return optional("LATERHOOK_SECRET") ?? `laterhook:${required("LATERHOOK_PASSWORD")}`;
  },
  /** How long a login lasts, in seconds. Default 30 days. */
  get sessionTtlSeconds(): number {
    return Number(optional("LATERHOOK_SESSION_TTL") ?? 60 * 60 * 24 * 30);
  },
  get databaseDriver(): DatabaseDriver {
    return resolveDriver();
  },
  get d1(): { accountId: string; databaseId: string; apiToken: string } {
    return {
      accountId: requiredD1("LATERHOOK_D1_ACCOUNT_ID", "CLOUDFLARE_ACCOUNT_ID"),
      databaseId: requiredD1("LATERHOOK_D1_DATABASE_ID", "CLOUDFLARE_D1_DATABASE_ID"),
      apiToken: requiredD1("LATERHOOK_D1_TOKEN", "CLOUDFLARE_API_TOKEN"),
    };
  },
  get sqlitePath(): string {
    return optional("SQLITE_PATH") ?? ".data/laterhook.db";
  },
  /** Largest request body we persist. Larger bodies are stored truncated. Default 512 KiB. */
  get maxBodyBytes(): number {
    return Number(optional("LATERHOOK_MAX_BODY_BYTES") ?? 512 * 1024);
  },
  /** Timeout for forwarding a webhook to its target, in ms. Default 10s. */
  get forwardTimeoutMs(): number {
    return Number(optional("LATERHOOK_FORWARD_TIMEOUT_MS") ?? 10_000);
  },
  /** ip-api.com Pro license key. When set, request origins are geolocated. Optional. */
  get ipApiKey(): string | undefined {
    return optional("IP_API_KEY");
  },
  /** How long a cached IP lookup stays fresh, in days. Default 30. */
  get ipInfoTtlDays(): number {
    return Number(optional("IP_API_CACHE_DAYS") ?? 30);
  },
  /** Vercel AI Gateway key. Together with TYPESAFE_AI_ENABLED it turns on AI triage. Optional. */
  get aiGatewayApiKey(): string | undefined {
    return optional("AI_GATEWAY_API_KEY");
  },
  /** Opt-in switch for TypeSafe AI (Jev) triage: "true", "1", "yes" or "on". */
  get typesafeAiEnabled(): boolean {
    return /^(1|true|yes|on)$/i.test(optional("TYPESAFE_AI_ENABLED") ?? "");
  },
  /** Gateway model id used for triage. Default "typesafe-ai/jev". */
  get typesafeAiModel(): string {
    return optional("TYPESAFE_AI_MODEL") ?? "typesafe-ai/jev";
  },
  /** Absolute origin for metadata (Open Graph URLs). Falls back to Vercel's production URL, then localhost. */
  get metadataBase(): URL {
    const explicit = optional("LATERHOOK_PUBLIC_URL");
    if (explicit) return new URL(explicit);
    const vercel = optional("VERCEL_PROJECT_PRODUCTION_URL") ?? optional("VERCEL_URL");
    if (vercel) return new URL(`https://${vercel}`);
    return new URL(`http://localhost:${optional("PORT") ?? "3000"}`);
  },
  /** Public base URL shown in the UI (e.g. https://hooks.example.com). Inferred from the request when unset. */
  get publicBaseUrl(): string | undefined {
    return optional("LATERHOOK_PUBLIC_URL");
  },
};
