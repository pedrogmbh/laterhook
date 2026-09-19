import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import type { IpInfo, IpInfoData } from "@/lib/types";

/**
 * Optional origin enrichment via ip-api.com (Pro). Enabled only when
 * IP_API_KEY is set. Lookups are cached per IP in the `ip_info` table so a
 * chatty sender costs one API call, not one per webhook.
 *
 * `fields` is the bitmask from the ip-api docs selecting the full record and
 * must stay exactly as is.
 */
const IP_API_FIELDS = "66846719";
const LOOKUP_TIMEOUT_MS = 4000;

export function ipLookupEnabled(): boolean {
  return Boolean(env.ipApiKey);
}

/** Loopback, link-local, private and other ranges ip-api rejects as "reserved range". */
export function isReservedIp(ip: string): boolean {
  const v = ip.trim().toLowerCase();
  if (!v || v === "::1" || v === "::" || v === "localhost") return true;
  if (v.startsWith("::ffff:")) return isReservedIp(v.slice(7));
  if (v.includes(":")) {
    return v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("2001:db8");
  }
  const parts = v.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function toInfo(r: Record<string, unknown>): IpInfo {
  let data: IpInfoData = {};
  try {
    data = JSON.parse(String(r.data ?? "{}")) as IpInfoData;
  } catch {
    /* keep empty */
  }
  return {
    ip: String(r.ip),
    status: r.status === "success" ? "success" : "fail",
    message: r.message == null ? null : String(r.message),
    data,
    fetched_at: String(r.fetched_at),
  };
}

function isFresh(info: IpInfo): boolean {
  const ttl = env.ipInfoTtlDays * 24 * 3600 * 1000;
  return Date.now() - new Date(info.fetched_at).getTime() < ttl;
}

export async function getCachedIpInfo(ip: string): Promise<IpInfo | null> {
  const db = await getDb();
  const { rows } = await db.query<Record<string, unknown>>(`SELECT * FROM ip_info WHERE ip = ? LIMIT 1`, [ip]);
  return rows[0] ? toInfo(rows[0]) : null;
}

export async function getCachedIpInfoMany(ips: (string | null)[]): Promise<Map<string, IpInfo>> {
  const unique = [...new Set(ips.filter((x): x is string => Boolean(x)))];
  const out = new Map<string, IpInfo>();
  if (!unique.length) return out;
  const db = await getDb();
  // Chunk to stay well under SQLite's bound-parameter limit.
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const { rows } = await db.query<Record<string, unknown>>(
      `SELECT * FROM ip_info WHERE ip IN (${chunk.map(() => "?").join(",")})`,
      chunk,
    );
    for (const r of rows) {
      const info = toInfo(r);
      out.set(info.ip, info);
    }
  }
  return out;
}

async function fetchFromApi(ip: string): Promise<Omit<IpInfo, "fetched_at">> {
  const key = env.ipApiKey;
  if (!key) throw new Error("IP_API_KEY is not configured");
  const url = `https://pro.ip-api.com/json/${encodeURIComponent(ip)}?key=${encodeURIComponent(key)}&fields=${IP_API_FIELDS}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`ip-api responded ${res.status}`);
    const json = (await res.json()) as IpInfoData & { status?: string; message?: string };
    const { status, message, ...data } = json;
    return {
      ip,
      status: status === "success" ? "success" : "fail",
      message: message ?? null,
      data: status === "success" ? data : {},
    };
  } finally {
    clearTimeout(timer);
  }
}

async function store(info: Omit<IpInfo, "fetched_at">): Promise<IpInfo> {
  const db = await getDb();
  const fetched_at = new Date().toISOString();
  await db.query(
    `INSERT INTO ip_info (ip, status, message, data, fetched_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(ip) DO UPDATE SET status = excluded.status, message = excluded.message, data = excluded.data, fetched_at = excluded.fetched_at`,
    [info.ip, info.status, info.message, JSON.stringify(info.data), fetched_at],
  );
  return { ...info, fetched_at };
}

/**
 * Return origin info for an IP, fetching and caching it when missing or stale.
 * Never throws for reserved/private addresses; those are cached as `fail`.
 * Returns null when lookups are disabled.
 */
export async function lookupIp(ip: string | null, opts: { force?: boolean } = {}): Promise<IpInfo | null> {
  if (!ip || !ipLookupEnabled()) return null;
  const cached = await getCachedIpInfo(ip);
  if (cached && !opts.force && isFresh(cached)) return cached;
  if (isReservedIp(ip)) {
    return cached ?? store({ ip, status: "fail", message: "reserved range", data: {} });
  }
  try {
    return await store(await fetchFromApi(ip));
  } catch (err) {
    // Keep whatever we had; a transient failure shouldn't erase good data.
    if (cached) return cached;
    return store({ ip, status: "fail", message: err instanceof Error ? err.message : "lookup failed", data: {} });
  }
}

/** Requests in the last `hours` grouped by origin country, most frequent first. */
export async function topOrigins(hours = 24, limit = 8): Promise<{ countryCode: string; country: string; count: number; cities: string[] }[]> {
  if (!ipLookupEnabled()) return [];
  const db = await getDb();
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const { rows } = await db.query<{ ip: string; n: number }>(
    `SELECT ip, COUNT(*) AS n FROM requests WHERE received_at >= ? AND ip IS NOT NULL GROUP BY ip ORDER BY n DESC LIMIT 500`,
    [since],
  );
  const infos = await getCachedIpInfoMany(rows.map((r) => r.ip));
  const agg = new Map<string, { countryCode: string; country: string; count: number; cities: Set<string> }>();
  for (const r of rows) {
    const info = infos.get(r.ip);
    const cc = info?.status === "success" ? (info.data.countryCode ?? "??") : info?.status === "fail" ? "LOCAL" : "??";
    const country = info?.status === "success" ? (info.data.country ?? "Unknown") : info?.status === "fail" ? "Private / reserved" : "Not looked up";
    const entry = agg.get(cc) ?? { countryCode: cc, country, count: 0, cities: new Set<string>() };
    entry.count += Number(r.n);
    if (info?.data.city) entry.cities.add(info.data.city);
    agg.set(cc, entry);
  }
  return [...agg.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((e) => ({ ...e, cities: [...e.cities].slice(0, 3) }));
}

/** Country code → flag emoji ("BR" → 🇧🇷). Falls back to a globe. */
export function flagEmoji(countryCode: string | undefined | null): string {
  if (!countryCode || countryCode.length !== 2 || !/^[A-Za-z]{2}$/.test(countryCode)) return "🌐";
  const base = 0x1f1e6;
  const cc = countryCode.toUpperCase();
  return String.fromCodePoint(base + cc.charCodeAt(0) - 65, base + cc.charCodeAt(1) - 65);
}

/** One-line origin label for lists: "São Paulo, BR". */
export function originLabel(info: IpInfo | undefined): string | null {
  if (!info || info.status !== "success") return null;
  const { city, regionName, countryCode, country } = info.data;
  const place = city || regionName || country;
  return place ? `${place}${countryCode ? `, ${countryCode}` : ""}` : (country ?? null);
}
