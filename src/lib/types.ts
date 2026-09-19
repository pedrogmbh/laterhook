import type { EndpointColor } from "./palette";

export interface Endpoint {
  id: string;
  slug: string;
  name: string | null;
  description: string | null;
  color: EndpointColor;
  forward_url: string | null;
  forward_enabled: boolean;
  response_status: number;
  response_body: string | null;
  response_content_type: string | null;
  archived: boolean;
  request_count: number;
  last_received_at: string | null;
  created_at: string;
  updated_at: string;
}

export type BodyEncoding = "utf8" | "base64" | "none";

export interface WebhookRequest {
  id: string;
  endpoint_id: string;
  endpoint_slug: string;
  path: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  query: Record<string, string | string[]>;
  body: string | null;
  body_encoding: BodyEncoding;
  body_truncated: boolean;
  content_type: string | null;
  size: number;
  ip: string | null;
  user_agent: string | null;
  received_at: string;
  starred: boolean;
  read: boolean;
  tags: string[];
  note: string | null;
  forward_status: number | null;
  forward_error: string | null;
  /** Route that matched at capture time, if any. */
  route_id: string | null;
  /** True when a route's header secret check failed; the request is kept but not forwarded. */
  rejected: boolean;
  rejected_reason: string | null;
}

/**
 * A permanent, regex-based rule. The pattern is tested against the path after
 * `/webhooks/` (e.g. `my-product/stripe/live`). First enabled match by
 * priority wins.
 */
export interface Route {
  id: string;
  name: string;
  description: string | null;
  pattern: string;
  case_insensitive: boolean;
  /** Uppercase method list, or null for any method. */
  methods: string[] | null;
  enabled: boolean;
  priority: number;
  forward_url: string | null;
  /** Extra headers added when forwarding. */
  forward_headers: Record<string, string>;
  require_header_name: string | null;
  require_header_value: string | null;
  response_status: number | null;
  response_body: string | null;
  response_content_type: string | null;
  auto_tags: string[];
  match_count: number;
  last_matched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Delivery {
  id: string;
  request_id: string;
  endpoint_id: string;
  kind: "forward" | "replay";
  target_url: string;
  status_code: number | null;
  response_headers: Record<string, string> | null;
  response_body: string | null;
  duration_ms: number | null;
  error: string | null;
  created_at: string;
}

export interface RequestFilters {
  endpointId?: string;
  method?: string;
  starred?: boolean;
  unread?: boolean;
  tag?: string;
  search?: string;
  routeId?: string;
  /** Only requests that matched no route. */
  unrouted?: boolean;
  rejected?: boolean;
  /** AI triage: only requests judged to need action. */
  needsAction?: boolean;
  /** AI triage: drop scanner/bot probes. */
  hideNoise?: boolean;
  /** AI triage: sender service key. */
  source?: string;
  limit?: number;
  before?: string; // received_at cursor
}

export interface Stats {
  total: number;
  last24h: number;
  endpoints: number;
  starred: number;
  unread: number;
  /** 24 hourly buckets, oldest first. */
  hourly: number[];
  /** Method distribution over the last 24h. */
  methods: { method: string; count: number }[];
}

/** Geolocation / network data from ip-api.com, cached per IP. */
export interface IpInfoData {
  continent?: string;
  continentCode?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  district?: string;
  zip?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  offset?: number;
  currency?: string;
  isp?: string;
  org?: string;
  as?: string;
  asname?: string;
  reverse?: string;
  mobile?: boolean;
  proxy?: boolean;
  hosting?: boolean;
  query?: string;
}

export interface IpInfo {
  ip: string;
  status: "success" | "fail";
  message: string | null;
  data: IpInfoData;
  fetched_at: string;
}

/** What a request is, as judged by AI triage. */
export type TriageKind = "event" | "test" | "handshake" | "probe" | "other";

/**
 * AI triage for one request (TypeSafe Jev via Vercel AI Gateway). The typed
 * judgments are stored raw so thresholds can change without re-running
 * inference; `event` is extracted by code, not the model.
 */
export interface RequestInsight {
  request_id: string;
  status: "ok" | "error";
  model: string | null;
  /** Event name read from headers/body, e.g. `invoice.paid` or `push`. */
  event: string | null;
  /** Sender service key from TRIAGE_SOURCES (most likely option). */
  source: string | null;
  kind: TriageKind | null;
  /** Position on the attention rubric, 0 (routine) to 2 (needs action). */
  attention: number | null;
  /** P(the request reports a failure). */
  failure: number | null;
  /** P(the body or query carries personal data or secrets). */
  sensitive: number | null;
  /** Full probability distributions per question id. */
  probabilities: Record<string, Record<string, number>>;
  /** TypeSafe's Choice/Score confidence per question id. */
  confidence: Record<string, number>;
  error: string | null;
  input_tokens: number | null;
  duration_ms: number | null;
  created_at: string;
}
