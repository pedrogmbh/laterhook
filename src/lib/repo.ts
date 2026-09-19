import { getDb, type SqlValue } from "@/lib/db";
import { newId } from "@/lib/ids";
import { isEndpointColor, pickColorFor, type EndpointColor } from "@/lib/palette";
import type {
  Delivery,
  Endpoint,
  RequestFilters,
  Route,
  Stats,
  WebhookRequest,
} from "@/lib/types";

// ---------- row mappers ----------

type Row = Record<string, unknown>;

function str(v: unknown): string | null {
  return v === null || v === undefined ? null : String(v);
}
function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function bool(v: unknown): boolean {
  return v === 1 || v === true || v === "1";
}
function json<T>(v: unknown, fallback: T): T {
  if (typeof v !== "string" || v === "") return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

function toEndpoint(r: Row): Endpoint {
  const color = r.color;
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: str(r.name),
    description: str(r.description),
    color: isEndpointColor(color) ? color : "lime",
    forward_url: str(r.forward_url),
    forward_enabled: bool(r.forward_enabled),
    response_status: num(r.response_status, 200),
    response_body: str(r.response_body),
    response_content_type: str(r.response_content_type),
    archived: bool(r.archived),
    request_count: num(r.request_count),
    last_received_at: str(r.last_received_at),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

function toRequest(r: Row): WebhookRequest {
  const enc = r.body_encoding;
  return {
    id: String(r.id),
    endpoint_id: String(r.endpoint_id),
    endpoint_slug: String(r.endpoint_slug),
    path: String(r.path ?? ""),
    method: String(r.method),
    url: String(r.url),
    headers: json<Record<string, string>>(r.headers, {}),
    query: json<Record<string, string | string[]>>(r.query, {}),
    body: str(r.body),
    body_encoding: enc === "utf8" || enc === "base64" ? enc : "none",
    body_truncated: bool(r.body_truncated),
    content_type: str(r.content_type),
    size: num(r.size),
    ip: str(r.ip),
    user_agent: str(r.user_agent),
    received_at: String(r.received_at),
    starred: bool(r.starred),
    read: bool(r.read),
    tags: json<string[]>(r.tags, []),
    note: str(r.note),
    forward_status: r.forward_status == null ? null : num(r.forward_status),
    forward_error: str(r.forward_error),
    route_id: str(r.route_id),
    rejected: bool(r.rejected),
    rejected_reason: str(r.rejected_reason),
  };
}

function toRoute(r: Row): Route {
  return {
    id: String(r.id),
    name: String(r.name),
    description: str(r.description),
    pattern: String(r.pattern),
    case_insensitive: bool(r.case_insensitive),
    methods: json<string[] | null>(r.methods, null),
    enabled: bool(r.enabled),
    priority: num(r.priority, 100),
    forward_url: str(r.forward_url),
    forward_headers: json<Record<string, string>>(r.forward_headers, {}),
    require_header_name: str(r.require_header_name),
    require_header_value: str(r.require_header_value),
    response_status: r.response_status == null ? null : num(r.response_status),
    response_body: str(r.response_body),
    response_content_type: str(r.response_content_type),
    auto_tags: json<string[]>(r.auto_tags, []),
    match_count: num(r.match_count),
    last_matched_at: str(r.last_matched_at),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

function toDelivery(r: Row): Delivery {
  return {
    id: String(r.id),
    request_id: String(r.request_id),
    endpoint_id: String(r.endpoint_id),
    kind: r.kind === "replay" ? "replay" : "forward",
    target_url: String(r.target_url),
    status_code: r.status_code == null ? null : num(r.status_code),
    response_headers: json<Record<string, string> | null>(r.response_headers, null),
    response_body: str(r.response_body),
    duration_ms: r.duration_ms == null ? null : num(r.duration_ms),
    error: str(r.error),
    created_at: String(r.created_at),
  };
}

const now = () => new Date().toISOString();

// ---------- endpoints ----------

export async function listEndpoints(opts: { includeArchived?: boolean } = {}): Promise<Endpoint[]> {
  const db = await getDb();
  const { rows } = await db.query<Row>(
    `SELECT * FROM endpoints ${opts.includeArchived ? "" : "WHERE archived = 0"}
     ORDER BY COALESCE(last_received_at, created_at) DESC`,
  );
  return rows.map(toEndpoint);
}

export async function getEndpointBySlug(slug: string): Promise<Endpoint | null> {
  const db = await getDb();
  const { rows } = await db.query<Row>(`SELECT * FROM endpoints WHERE slug = ? LIMIT 1`, [slug]);
  return rows[0] ? toEndpoint(rows[0]) : null;
}

export async function getEndpointById(id: string): Promise<Endpoint | null> {
  const db = await getDb();
  const { rows } = await db.query<Row>(`SELECT * FROM endpoints WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ? toEndpoint(rows[0]) : null;
}

/** Find-or-create by slug. This is what makes "zero setup" possible. */
export async function ensureEndpoint(slug: string): Promise<Endpoint> {
  const existing = await getEndpointBySlug(slug);
  if (existing) return existing;
  const db = await getDb();
  const ts = now();
  const id = newId("ep");
  await db.query(
    `INSERT OR IGNORE INTO endpoints (id, slug, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [id, slug, pickColorFor(slug), ts, ts],
  );
  // Re-read: a concurrent insert may have won the race.
  return (await getEndpointBySlug(slug)) as Endpoint;
}

export interface EndpointPatch {
  name?: string | null;
  description?: string | null;
  color?: EndpointColor;
  forward_url?: string | null;
  forward_enabled?: boolean;
  response_status?: number;
  response_body?: string | null;
  response_content_type?: string | null;
  archived?: boolean;
}

export async function updateEndpoint(id: string, patch: EndpointPatch): Promise<void> {
  const sets: string[] = [];
  const params: SqlValue[] = [];
  const push = (col: string, v: SqlValue) => {
    sets.push(`${col} = ?`);
    params.push(v);
  };
  if (patch.name !== undefined) push("name", patch.name);
  if (patch.description !== undefined) push("description", patch.description);
  if (patch.color !== undefined) push("color", patch.color);
  if (patch.forward_url !== undefined) push("forward_url", patch.forward_url);
  if (patch.forward_enabled !== undefined) push("forward_enabled", patch.forward_enabled ? 1 : 0);
  if (patch.response_status !== undefined) push("response_status", patch.response_status);
  if (patch.response_body !== undefined) push("response_body", patch.response_body);
  if (patch.response_content_type !== undefined) push("response_content_type", patch.response_content_type);
  if (patch.archived !== undefined) push("archived", patch.archived ? 1 : 0);
  if (!sets.length) return;
  push("updated_at", now());
  params.push(id);
  const db = await getDb();
  await db.query(`UPDATE endpoints SET ${sets.join(", ")} WHERE id = ?`, params);
}

export async function deleteEndpoint(id: string): Promise<void> {
  const db = await getDb();
  await db.batch([
    { sql: `DELETE FROM deliveries WHERE endpoint_id = ?`, params: [id] },
    { sql: `DELETE FROM requests WHERE endpoint_id = ?`, params: [id] },
    { sql: `DELETE FROM endpoints WHERE id = ?`, params: [id] },
  ]);
}

// ---------- requests ----------

export interface NewRequestInput {
  endpoint: Endpoint;
  path: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  query: Record<string, string | string[]>;
  body: string | null;
  body_encoding: WebhookRequest["body_encoding"];
  body_truncated: boolean;
  content_type: string | null;
  size: number;
  ip: string | null;
  user_agent: string | null;
  route_id?: string | null;
  rejected?: boolean;
  rejected_reason?: string | null;
  tags?: string[];
}

export async function insertRequest(input: NewRequestInput): Promise<WebhookRequest> {
  const db = await getDb();
  const id = newId("req");
  const ts = now();
  const tags = input.tags ?? [];
  const statements: { sql: string; params: SqlValue[] }[] = [
    {
      sql: `INSERT INTO requests
        (id, endpoint_id, endpoint_slug, path, method, url, headers, query, body, body_encoding,
         body_truncated, content_type, size, ip, user_agent, received_at, route_id, rejected, rejected_reason, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        id,
        input.endpoint.id,
        input.endpoint.slug,
        input.path,
        input.method,
        input.url,
        JSON.stringify(input.headers),
        JSON.stringify(input.query),
        input.body,
        input.body_encoding,
        input.body_truncated ? 1 : 0,
        input.content_type,
        input.size,
        input.ip,
        input.user_agent,
        ts,
        input.route_id ?? null,
        input.rejected ? 1 : 0,
        input.rejected_reason ?? null,
        JSON.stringify(tags),
      ],
    },
    {
      sql: `UPDATE endpoints SET request_count = request_count + 1, last_received_at = ? WHERE id = ?`,
      params: [ts, input.endpoint.id],
    },
  ];
  if (input.route_id) {
    statements.push({
      sql: `UPDATE routes SET match_count = match_count + 1, last_matched_at = ? WHERE id = ?`,
      params: [ts, input.route_id],
    });
  }
  await db.batch(statements);
  return {
    id,
    endpoint_id: input.endpoint.id,
    endpoint_slug: input.endpoint.slug,
    path: input.path,
    method: input.method,
    url: input.url,
    headers: input.headers,
    query: input.query,
    body: input.body,
    body_encoding: input.body_encoding,
    body_truncated: input.body_truncated,
    content_type: input.content_type,
    size: input.size,
    ip: input.ip,
    user_agent: input.user_agent,
    received_at: ts,
    starred: false,
    read: false,
    tags,
    note: null,
    forward_status: null,
    forward_error: null,
    route_id: input.route_id ?? null,
    rejected: Boolean(input.rejected),
    rejected_reason: input.rejected_reason ?? null,
  };
}

export async function getRequest(id: string): Promise<WebhookRequest | null> {
  const db = await getDb();
  const { rows } = await db.query<Row>(`SELECT * FROM requests WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ? toRequest(rows[0]) : null;
}

export async function listRequests(f: RequestFilters = {}): Promise<WebhookRequest[]> {
  const where: string[] = [];
  const params: SqlValue[] = [];
  if (f.endpointId) {
    where.push("endpoint_id = ?");
    params.push(f.endpointId);
  }
  if (f.method) {
    where.push("method = ?");
    params.push(f.method.toUpperCase());
  }
  if (f.starred) where.push("starred = 1");
  if (f.unread) where.push("read = 0");
  if (f.unrouted) where.push("route_id IS NULL");
  if (f.rejected) where.push("rejected = 1");
  if (f.routeId) {
    where.push("route_id = ?");
    params.push(f.routeId);
  }
  if (f.tag) {
    where.push("tags LIKE ?");
    params.push(`%${JSON.stringify(f.tag)}%`);
  }
  if (f.search) {
    const like = `%${f.search}%`;
    where.push("(body LIKE ? OR path LIKE ? OR headers LIKE ? OR query LIKE ? OR note LIKE ? OR endpoint_slug LIKE ? OR ip LIKE ?)");
    params.push(like, like, like, like, like, like, like);
  }
  if (f.before) {
    where.push("received_at < ?");
    params.push(f.before);
  }
  const limit = Math.min(Math.max(f.limit ?? 50, 1), 200);
  const db = await getDb();
  const { rows } = await db.query<Row>(
    `SELECT * FROM requests ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY received_at DESC LIMIT ${limit}`,
    params,
  );
  return rows.map(toRequest);
}

export async function listRequestsSince(since: string, limit = 50): Promise<WebhookRequest[]> {
  const db = await getDb();
  const { rows } = await db.query<Row>(
    `SELECT * FROM requests WHERE received_at > ? ORDER BY received_at DESC LIMIT ${Math.min(limit, 200)}`,
    [since],
  );
  return rows.map(toRequest);
}

export interface RequestPatch {
  starred?: boolean;
  read?: boolean;
  tags?: string[];
  note?: string | null;
  forward_status?: number | null;
  forward_error?: string | null;
}

export async function updateRequest(id: string, patch: RequestPatch): Promise<void> {
  const sets: string[] = [];
  const params: SqlValue[] = [];
  const push = (col: string, v: SqlValue) => {
    sets.push(`${col} = ?`);
    params.push(v);
  };
  if (patch.starred !== undefined) push("starred", patch.starred ? 1 : 0);
  if (patch.read !== undefined) push("read", patch.read ? 1 : 0);
  if (patch.tags !== undefined) push("tags", JSON.stringify(patch.tags));
  if (patch.note !== undefined) push("note", patch.note);
  if (patch.forward_status !== undefined) push("forward_status", patch.forward_status);
  if (patch.forward_error !== undefined) push("forward_error", patch.forward_error);
  if (!sets.length) return;
  params.push(id);
  const db = await getDb();
  await db.query(`UPDATE requests SET ${sets.join(", ")} WHERE id = ?`, params);
}

export async function markAllRead(endpointId?: string): Promise<void> {
  const db = await getDb();
  if (endpointId) await db.query(`UPDATE requests SET read = 1 WHERE endpoint_id = ? AND read = 0`, [endpointId]);
  else await db.query(`UPDATE requests SET read = 1 WHERE read = 0`);
}

export async function deleteRequest(id: string): Promise<void> {
  const db = await getDb();
  const req = await getRequest(id);
  if (!req) return;
  await db.batch([
    { sql: `DELETE FROM deliveries WHERE request_id = ?`, params: [id] },
    { sql: `DELETE FROM requests WHERE id = ?`, params: [id] },
    { sql: `UPDATE endpoints SET request_count = MAX(request_count - 1, 0) WHERE id = ?`, params: [req.endpoint_id] },
  ]);
}

export async function clearEndpointRequests(endpointId: string): Promise<void> {
  const db = await getDb();
  await db.batch([
    { sql: `DELETE FROM deliveries WHERE endpoint_id = ?`, params: [endpointId] },
    { sql: `DELETE FROM requests WHERE endpoint_id = ?`, params: [endpointId] },
    { sql: `UPDATE endpoints SET request_count = 0 WHERE id = ?`, params: [endpointId] },
  ]);
}

/** All distinct tags in use, most common first. */
export async function listTags(): Promise<string[]> {
  const db = await getDb();
  const { rows } = await db.query<{ tags: string }>(`SELECT tags FROM requests WHERE tags != '[]' LIMIT 2000`);
  const counts = new Map<string, number>();
  for (const r of rows) for (const t of json<string[]>(r.tags, [])) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}

// ---------- deliveries ----------

export async function insertDelivery(d: Omit<Delivery, "id" | "created_at">): Promise<Delivery> {
  const db = await getDb();
  const id = newId("dlv");
  const ts = now();
  await db.query(
    `INSERT INTO deliveries (id, request_id, endpoint_id, kind, target_url, status_code, response_headers, response_body, duration_ms, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      d.request_id,
      d.endpoint_id,
      d.kind,
      d.target_url,
      d.status_code,
      d.response_headers ? JSON.stringify(d.response_headers) : null,
      d.response_body,
      d.duration_ms,
      d.error,
      ts,
    ],
  );
  return { ...d, id, created_at: ts };
}

export async function listDeliveries(requestId: string): Promise<Delivery[]> {
  const db = await getDb();
  const { rows } = await db.query<Row>(
    `SELECT * FROM deliveries WHERE request_id = ? ORDER BY created_at DESC LIMIT 50`,
    [requestId],
  );
  return rows.map(toDelivery);
}

// ---------- stats ----------

export async function getStats(): Promise<Stats> {
  const db = await getDb();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [totals, recent, hourly, methods] = await Promise.all([
    db.query<{ total: number; starred: number; unread: number }>(
      `SELECT COUNT(*) AS total, SUM(starred) AS starred, SUM(CASE WHEN read = 0 THEN 1 ELSE 0 END) AS unread FROM requests`,
    ),
    db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM requests WHERE received_at >= ?`, [since]),
    db.query<{ h: string; n: number }>(
      `SELECT substr(received_at, 1, 13) AS h, COUNT(*) AS n FROM requests WHERE received_at >= ? GROUP BY h`,
      [since],
    ),
    db.query<{ method: string; count: number }>(
      `SELECT method, COUNT(*) AS count FROM requests WHERE received_at >= ? GROUP BY method ORDER BY count DESC`,
      [since],
    ),
  ]);
  const endpoints = await db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM endpoints WHERE archived = 0`);

  const byHour = new Map(hourly.rows.map((r) => [r.h, num(r.n)]));
  const buckets: number[] = [];
  const start = new Date();
  start.setUTCMinutes(0, 0, 0);
  for (let i = 23; i >= 0; i--) {
    const d = new Date(start.getTime() - i * 3600 * 1000);
    buckets.push(byHour.get(d.toISOString().slice(0, 13)) ?? 0);
  }
  const t = totals.rows[0] ?? { total: 0, starred: 0, unread: 0 };
  return {
    total: num(t.total),
    starred: num(t.starred),
    unread: num(t.unread),
    last24h: num(recent.rows[0]?.n),
    endpoints: num(endpoints.rows[0]?.n),
    hourly: buckets,
    methods: methods.rows.map((r) => ({ method: String(r.method), count: num(r.count) })),
  };
}

/** Per-endpoint hourly sparkline data for the last 24h. */
export async function getEndpointSparklines(): Promise<Record<string, number[]>> {
  const db = await getDb();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { rows } = await db.query<{ endpoint_id: string; h: string; n: number }>(
    `SELECT endpoint_id, substr(received_at, 1, 13) AS h, COUNT(*) AS n
     FROM requests WHERE received_at >= ? GROUP BY endpoint_id, h`,
    [since],
  );
  const start = new Date();
  start.setUTCMinutes(0, 0, 0);
  const keys: string[] = [];
  for (let i = 23; i >= 0; i--) keys.push(new Date(start.getTime() - i * 3600 * 1000).toISOString().slice(0, 13));
  const out: Record<string, number[]> = {};
  for (const r of rows) {
    const arr = (out[r.endpoint_id] ??= new Array(24).fill(0));
    const idx = keys.indexOf(r.h);
    if (idx >= 0) arr[idx] = num(r.n);
  }
  return out;
}

// ---------- routes ----------

export async function listRoutes(opts: { enabledOnly?: boolean } = {}): Promise<Route[]> {
  const db = await getDb();
  const { rows } = await db.query<Row>(
    `SELECT * FROM routes ${opts.enabledOnly ? "WHERE enabled = 1" : ""} ORDER BY priority ASC, created_at ASC`,
  );
  return rows.map(toRoute);
}

export async function getRoute(id: string): Promise<Route | null> {
  const db = await getDb();
  const { rows } = await db.query<Row>(`SELECT * FROM routes WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ? toRoute(rows[0]) : null;
}

export type RouteInput = Omit<Route, "id" | "match_count" | "last_matched_at" | "created_at" | "updated_at">;

export async function createRoute(input: RouteInput): Promise<Route> {
  const db = await getDb();
  const id = newId("rt");
  const ts = now();
  await db.query(
    `INSERT INTO routes (id, name, description, pattern, case_insensitive, methods, enabled, priority, forward_url, forward_headers,
       require_header_name, require_header_value, response_status, response_body, response_content_type, auto_tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.description,
      input.pattern,
      input.case_insensitive ? 1 : 0,
      input.methods ? JSON.stringify(input.methods) : null,
      input.enabled ? 1 : 0,
      input.priority,
      input.forward_url,
      JSON.stringify(input.forward_headers),
      input.require_header_name,
      input.require_header_value,
      input.response_status,
      input.response_body,
      input.response_content_type,
      JSON.stringify(input.auto_tags),
      ts,
      ts,
    ],
  );
  return { ...input, id, match_count: 0, last_matched_at: null, created_at: ts, updated_at: ts };
}

export async function updateRoute(id: string, input: Partial<RouteInput>): Promise<void> {
  const sets: string[] = [];
  const params: SqlValue[] = [];
  const push = (col: string, v: SqlValue) => {
    sets.push(`${col} = ?`);
    params.push(v);
  };
  if (input.name !== undefined) push("name", input.name);
  if (input.description !== undefined) push("description", input.description);
  if (input.pattern !== undefined) push("pattern", input.pattern);
  if (input.case_insensitive !== undefined) push("case_insensitive", input.case_insensitive ? 1 : 0);
  if (input.methods !== undefined) push("methods", input.methods ? JSON.stringify(input.methods) : null);
  if (input.enabled !== undefined) push("enabled", input.enabled ? 1 : 0);
  if (input.priority !== undefined) push("priority", input.priority);
  if (input.forward_url !== undefined) push("forward_url", input.forward_url);
  if (input.forward_headers !== undefined) push("forward_headers", JSON.stringify(input.forward_headers));
  if (input.require_header_name !== undefined) push("require_header_name", input.require_header_name);
  if (input.require_header_value !== undefined) push("require_header_value", input.require_header_value);
  if (input.response_status !== undefined) push("response_status", input.response_status);
  if (input.response_body !== undefined) push("response_body", input.response_body);
  if (input.response_content_type !== undefined) push("response_content_type", input.response_content_type);
  if (input.auto_tags !== undefined) push("auto_tags", JSON.stringify(input.auto_tags));
  if (!sets.length) return;
  push("updated_at", now());
  params.push(id);
  const db = await getDb();
  await db.query(`UPDATE routes SET ${sets.join(", ")} WHERE id = ?`, params);
}

export async function deleteRoute(id: string): Promise<void> {
  const db = await getDb();
  await db.batch([
    { sql: `UPDATE requests SET route_id = NULL WHERE route_id = ?`, params: [id] },
    { sql: `DELETE FROM routes WHERE id = ?`, params: [id] },
  ]);
}

/** Recent requests that matched no route; used to link them when a new route is created. */
export async function listUnroutedForBackfill(limit = 1000): Promise<Pick<WebhookRequest, "id" | "endpoint_slug" | "path" | "method">[]> {
  const db = await getDb();
  const { rows } = await db.query<Row>(
    `SELECT id, endpoint_slug, path, method FROM requests WHERE route_id IS NULL ORDER BY received_at DESC LIMIT ${Math.min(limit, 5000)}`,
  );
  return rows.map((r) => ({ id: String(r.id), endpoint_slug: String(r.endpoint_slug), path: String(r.path ?? ""), method: String(r.method) }));
}

export async function assignRoute(routeId: string, requestIds: string[]): Promise<number> {
  if (!requestIds.length) return 0;
  const db = await getDb();
  let n = 0;
  for (let i = 0; i < requestIds.length; i += 100) {
    const chunk = requestIds.slice(i, i + 100);
    await db.query(`UPDATE requests SET route_id = ? WHERE id IN (${chunk.map(() => "?").join(",")}) AND route_id IS NULL`, [routeId, ...chunk]);
    n += chunk.length;
  }
  await db.query(`UPDATE routes SET match_count = (SELECT COUNT(*) FROM requests WHERE route_id = ?) WHERE id = ?`, [routeId, routeId]);
  return n;
}

export async function countUnrouted(): Promise<number> {
  const db = await getDb();
  const { rows } = await db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM requests WHERE route_id IS NULL`);
  return num(rows[0]?.n);
}
