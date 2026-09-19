/**
 * Pure, browser-safe helpers for route patterns. No database imports here:
 * the route form (a client component) uses them for live validation.
 */
import type { Route, WebhookRequest } from "@/lib/types";

/** The string routes are matched against: everything after `/webhooks/`. */
export function fullPath(slug: string, subpath: string): string {
  return subpath ? `${slug}/${subpath}` : slug;
}

/** Validate a pattern; returns an error message or null. */
export function validatePattern(pattern: string, caseInsensitive = false): string | null {
  if (!pattern.trim()) return "Pattern is required.";
  if (pattern.length > 500) return "Pattern is too long.";
  try {
    new RegExp(pattern, caseInsensitive ? "i" : "");
    return null;
  } catch (e) {
    return e instanceof Error ? e.message.replace(/^Invalid regular expression: /, "") : "Invalid regular expression.";
  }
}

export function compile(route: Pick<Route, "pattern" | "case_insensitive">): RegExp | null {
  try {
    return new RegExp(route.pattern, route.case_insensitive ? "i" : "");
  } catch {
    return null;
  }
}

export interface RouteMatch {
  route: Route;
  match: RegExpExecArray;
}

export function matchRoute(routes: Route[], path: string, method: string): RouteMatch | null {
  const m = method.toUpperCase();
  for (const route of routes) {
    if (!route.enabled) continue;
    if (route.methods && route.methods.length && !route.methods.includes(m)) continue;
    const re = compile(route);
    if (!re) continue;
    const match = re.exec(path);
    if (match) return { route, match };
  }
  return null;
}

/**
 * Expand `$1`, `$2`, `$<name>` and `$0` in a forward URL from the regex match.
 * URLs without placeholders are used as-is.
 */
export function expandTarget(template: string, match: RegExpExecArray): string {
  return template.replace(/\$(\d+|<([A-Za-z_][A-Za-z0-9_]*)>)/g, (whole, idx: string, name?: string) => {
    if (name) return match.groups?.[name] ?? "";
    const i = Number(idx);
    return match[i] ?? "";
  });
}

export function hasPlaceholders(template: string): boolean {
  return /\$(\d+|<[A-Za-z_][A-Za-z0-9_]*>)/.test(template);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Check a route's header secret against the incoming headers. */
export function checkSecret(route: Route, headers: Record<string, string>): { ok: true } | { ok: false; reason: string } {
  if (!route.require_header_name || !route.require_header_value) return { ok: true };
  const name = route.require_header_name.toLowerCase();
  const got = Object.entries(headers).find(([k]) => k.toLowerCase() === name)?.[1];
  if (got == null) return { ok: false, reason: `Missing required header ${route.require_header_name}` };
  if (!timingSafeEqual(got.trim(), route.require_header_value.trim())) return { ok: false, reason: `Header ${route.require_header_name} did not match the configured secret` };
  return { ok: true };
}

/** "Name: value" lines → object. Invalid lines are skipped. */
export function parseHeaderLines(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (/^[A-Za-z0-9-]+$/.test(k)) out[k] = v;
  }
  return out;
}

export function headerLines(h: Record<string, string>): string {
  return Object.entries(h)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

/** Escape a literal path into an anchored regex, e.g. `shop/orders/42` → `^shop/orders/42$`. */
export function escapeToPattern(path: string): string {
  return `^${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;
}

/** Suggest a pattern that captures the sub-path under an endpoint: `^shop(/.*)?$`. */
export function endpointPattern(slug: string): string {
  return `^${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:/(.*))?$`;
}

/** Re-derive the match for a stored request against its route (for replay target expansion). */
export function rematch(route: Route, req: Pick<WebhookRequest, "endpoint_slug" | "path">): RegExpExecArray | null {
  const re = compile(route);
  return re ? re.exec(fullPath(req.endpoint_slug, req.path)) : null;
}
