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
