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

function resolveDriver(): DatabaseDriver {
  const explicit = optional("DATABASE_DRIVER")?.toLowerCase();
  if (explicit === "d1" || explicit === "sqlite") return explicit;
  // Infer: if Cloudflare credentials are present, use D1; otherwise local SQLite.
  if (
    optional("CLOUDFLARE_ACCOUNT_ID") &&
    optional("CLOUDFLARE_D1_DATABASE_ID") &&
    optional("CLOUDFLARE_API_TOKEN")
  ) {
    return "d1";
  }
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
      accountId: required("CLOUDFLARE_ACCOUNT_ID"),
      databaseId: required("CLOUDFLARE_D1_DATABASE_ID"),
      apiToken: required("CLOUDFLARE_API_TOKEN"),
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
  /** Public base URL shown in the UI (e.g. https://hooks.example.com). Inferred from the request when unset. */
  get publicBaseUrl(): string | undefined {
    return optional("LATERHOOK_PUBLIC_URL");
  },
};
