/**
 * Schema is applied idempotently on first use (CREATE ... IF NOT EXISTS), so a
 * fresh D1 database needs zero manual setup. Keep every statement idempotent.
 */
export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS endpoints (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT,
    description TEXT,
    color TEXT NOT NULL DEFAULT 'lime',
    forward_url TEXT,
    forward_enabled INTEGER NOT NULL DEFAULT 0,
    response_status INTEGER NOT NULL DEFAULT 200,
    response_body TEXT,
    response_content_type TEXT,
    archived INTEGER NOT NULL DEFAULT 0,
    request_count INTEGER NOT NULL DEFAULT 0,
    last_received_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    endpoint_id TEXT NOT NULL,
    endpoint_slug TEXT NOT NULL,
    path TEXT NOT NULL DEFAULT '',
    method TEXT NOT NULL,
    url TEXT NOT NULL,
    headers TEXT NOT NULL DEFAULT '{}',
    query TEXT NOT NULL DEFAULT '{}',
    body TEXT,
    body_encoding TEXT NOT NULL DEFAULT 'none',
    body_truncated INTEGER NOT NULL DEFAULT 0,
    content_type TEXT,
    size INTEGER NOT NULL DEFAULT 0,
    ip TEXT,
    user_agent TEXT,
    received_at TEXT NOT NULL,
    starred INTEGER NOT NULL DEFAULT 0,
    read INTEGER NOT NULL DEFAULT 0,
    tags TEXT NOT NULL DEFAULT '[]',
    note TEXT,
    forward_status INTEGER,
    forward_error TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_requests_received ON requests(received_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_requests_endpoint ON requests(endpoint_id, received_at DESC)`,
  `CREATE TABLE IF NOT EXISTS deliveries (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    endpoint_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    target_url TEXT NOT NULL,
    status_code INTEGER,
    response_headers TEXT,
    response_body TEXT,
    duration_ms INTEGER,
    error TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_deliveries_request ON deliveries(request_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS ip_info (
    ip TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    message TEXT,
    data TEXT NOT NULL DEFAULT '{}',
    fetched_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_requests_ip ON requests(ip)`,
  `CREATE TABLE IF NOT EXISTS routes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    pattern TEXT NOT NULL,
    case_insensitive INTEGER NOT NULL DEFAULT 0,
    methods TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    priority INTEGER NOT NULL DEFAULT 100,
    forward_url TEXT,
    forward_headers TEXT,
    require_header_name TEXT,
    require_header_value TEXT,
    response_status INTEGER,
    response_body TEXT,
    response_content_type TEXT,
    auto_tags TEXT NOT NULL DEFAULT '[]',
    match_count INTEGER NOT NULL DEFAULT 0,
    last_matched_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  // One AI triage result per request (TypeSafe Jev via Vercel AI Gateway). `answers` keeps the raw typed answers with probabilities.
  `CREATE TABLE IF NOT EXISTS request_insights (
    request_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    model TEXT,
    event TEXT,
    source TEXT,
    kind TEXT,
    attention REAL,
    failure REAL,
    sensitive REAL,
    answers TEXT NOT NULL DEFAULT '{}',
    confidence TEXT NOT NULL DEFAULT '{}',
    error TEXT,
    input_tokens INTEGER,
    duration_ms INTEGER,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_insights_created ON request_insights(created_at DESC)`,
];

/**
 * Column additions for tables that already exist. SQLite has no
 * `ADD COLUMN IF NOT EXISTS`, so these run one by one and "duplicate column"
 * errors are ignored.
 */
export const SCHEMA_MIGRATIONS: string[] = [
  `ALTER TABLE requests ADD COLUMN route_id TEXT`,
  `ALTER TABLE requests ADD COLUMN rejected INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE requests ADD COLUMN rejected_reason TEXT`,
];

export const POST_MIGRATION_STATEMENTS: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_requests_route ON requests(route_id, received_at DESC)`,
];
