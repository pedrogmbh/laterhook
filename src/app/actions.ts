"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkPassword, clearSessionCookie, isAuthenticated, setSessionCookie } from "@/lib/auth";
import { deliver } from "@/lib/forward";
import { ipLookupEnabled, lookupIp } from "@/lib/ipinfo";
import { isEndpointColor } from "@/lib/palette";
import {
  assignRoute,
  clearEndpointRequests,
  createRoute,
  deleteEndpoint,
  deleteRequest,
  deleteRoute,
  getEndpointById,
  getRequest,
  getRoute,
  listUnroutedForBackfill,
  markAllRead,
  updateEndpoint,
  updateRequest,
  updateRoute,
  type RouteInput,
} from "@/lib/repo";
import { compile, expandTarget, fullPath, invalidateRouteCache, parseHeaderLines, rematch, validatePattern } from "@/lib/routes";
import { METHODS } from "@/lib/palette";

export interface ActionState {
  ok: boolean;
  error?: string;
  message?: string;
}

async function guard() {
  if (!(await isAuthenticated())) throw new Error("Unauthorized");
}

function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

// ---------- auth ----------

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  if (!password || !checkPassword(password)) {
    return { ok: false, error: "That password doesn't match." };
  }
  await setSessionCookie();
  redirect(safeNext(formData.get("next")));
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

// ---------- endpoints ----------

export async function updateEndpointAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await guard();
  const id = String(formData.get("id") ?? "");
  const endpoint = await getEndpointById(id);
  if (!endpoint) return { ok: false, error: "Endpoint not found." };

  const forwardUrlRaw = String(formData.get("forward_url") ?? "").trim();
  if (forwardUrlRaw) {
    try {
      const u = new URL(forwardUrlRaw);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
    } catch {
      return { ok: false, error: "Forward URL must be an absolute http(s) URL." };
    }
  }
  const status = Number(formData.get("response_status") ?? 200);
  if (!Number.isInteger(status) || status < 200 || status > 599) {
    return { ok: false, error: "Response status must be between 200 and 599." };
  }
  const color = String(formData.get("color") ?? endpoint.color);

  await updateEndpoint(id, {
    name: String(formData.get("name") ?? "").trim() || null,
    description: String(formData.get("description") ?? "").trim() || null,
    color: isEndpointColor(color) ? color : endpoint.color,
    forward_url: forwardUrlRaw || null,
    forward_enabled: formData.get("forward_enabled") === "on" && !!forwardUrlRaw,
    response_status: status,
    response_body: String(formData.get("response_body") ?? "").trim() || null,
    response_content_type: String(formData.get("response_content_type") ?? "").trim() || null,
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

export async function setEndpointArchivedAction(id: string, archived: boolean): Promise<void> {
  await guard();
  await updateEndpoint(id, { archived });
  revalidatePath("/", "layout");
}

export async function deleteEndpointAction(id: string): Promise<void> {
  await guard();
  await deleteEndpoint(id);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function clearEndpointAction(id: string): Promise<void> {
  await guard();
  await clearEndpointRequests(id);
  revalidatePath("/", "layout");
}

// ---------- requests ----------

export async function toggleStarAction(id: string, starred: boolean): Promise<void> {
  await guard();
  await updateRequest(id, { starred });
  revalidatePath("/", "layout");
}

export async function setTagsAction(id: string, tags: string[]): Promise<void> {
  await guard();
  const clean = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
  await updateRequest(id, { tags: clean });
  revalidatePath("/", "layout");
}

export async function setNoteAction(id: string, note: string): Promise<void> {
  await guard();
  await updateRequest(id, { note: note.trim() || null });
  revalidatePath("/", "layout");
}

export async function markReadAction(id: string): Promise<void> {
  await guard();
  await updateRequest(id, { read: true });
}

export async function markAllReadAction(endpointId?: string): Promise<void> {
  await guard();
  await markAllRead(endpointId);
  revalidatePath("/", "layout");
}

export async function deleteRequestAction(id: string, redirectTo?: string): Promise<void> {
  await guard();
  await deleteRequest(id);
  revalidatePath("/", "layout");
  if (redirectTo) redirect(redirectTo);
}

export async function replayAction(id: string, targetUrl?: string): Promise<ActionState> {
  await guard();
  const req = await getRequest(id);
  if (!req) return { ok: false, error: "Request not found." };
  let target = targetUrl?.trim();
  let opts: Parameters<typeof deliver>[3] = {};
  if (!target && req.route_id) {
    const route = await getRoute(req.route_id);
    if (route?.forward_url) {
      const m = rematch(route, req);
      target = m ? expandTarget(route.forward_url, m) : route.forward_url;
      opts = { appendPath: false, extraHeaders: route.forward_headers, routeId: route.id };
    }
  }
  if (!target) {
    const ep = await getEndpointById(req.endpoint_id);
    target = ep?.forward_url ?? undefined;
  }
  if (!target) return { ok: false, error: "No target URL. Set a forward URL on the route or endpoint, or provide one." };
  try {
    new URL(target);
  } catch {
    return { ok: false, error: "Target must be an absolute URL." };
  }
  const d = await deliver(req, target, "replay", opts);
  revalidatePath("/", "layout");
  if (d.error) return { ok: false, error: d.error };
  return { ok: true, message: `Replayed → ${d.status_code} in ${d.duration_ms}ms` };
}

// ---------- ip info ----------

export async function refreshIpInfoAction(requestId: string): Promise<ActionState> {
  await guard();
  if (!ipLookupEnabled()) return { ok: false, error: "IP lookups are not configured. Set IP_API_KEY." };
  const req = await getRequest(requestId);
  if (!req?.ip) return { ok: false, error: "This request has no source IP." };
  const info = await lookupIp(req.ip, { force: true });
  revalidatePath("/", "layout");
  if (!info || info.status !== "success") return { ok: false, error: info?.message ?? "Lookup failed." };
  return { ok: true, message: `Located in ${info.data.city ?? info.data.country ?? req.ip}` };
}

// ---------- routes ----------

function routeInputFromForm(formData: FormData): { input?: RouteInput; error?: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the route a name." };
  const pattern = String(formData.get("pattern") ?? "").trim();
  const case_insensitive = formData.get("case_insensitive") === "on";
  const patternError = validatePattern(pattern, case_insensitive);
  if (patternError) return { error: `Pattern: ${patternError}` };

  const methods = formData.getAll("methods").map(String).filter((m) => (METHODS as readonly string[]).includes(m));
  const forward_url = String(formData.get("forward_url") ?? "").trim() || null;
  if (forward_url) {
    try {
      const probe = new URL(forward_url.replace(/\$(\d+|<[^>]+>)/g, "x"));
      if (probe.protocol !== "http:" && probe.protocol !== "https:") throw new Error();
    } catch {
      return { error: "Forward URL must be an absolute http(s) URL. $1, $2 or $<name> insert capture groups." };
    }
  }
  const statusRaw = String(formData.get("response_status") ?? "").trim();
  const response_status = statusRaw ? Number(statusRaw) : null;
  if (response_status != null && (!Number.isInteger(response_status) || response_status < 200 || response_status > 599)) {
    return { error: "Response status must be between 200 and 599, or empty to inherit." };
  }
  const priority = Number(formData.get("priority") ?? 100);
  const require_header_name = String(formData.get("require_header_name") ?? "").trim() || null;
  const require_header_value = String(formData.get("require_header_value") ?? "").trim() || null;
  if ((require_header_name && !require_header_value) || (!require_header_name && require_header_value)) {
    return { error: "Header secret needs both a header name and a value." };
  }
  const auto_tags = [...new Set(String(formData.get("auto_tags") ?? "").split(/[,\n]/).map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20);

  return {
    input: {
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      pattern,
      case_insensitive,
      methods: methods.length ? methods : null,
      enabled: formData.get("enabled") !== "off",
      priority: Number.isFinite(priority) ? Math.trunc(priority) : 100,
      forward_url,
      forward_headers: parseHeaderLines(String(formData.get("forward_headers") ?? "")),
      require_header_name,
      require_header_value,
      response_status,
      response_body: String(formData.get("response_body") ?? "").trim() || null,
      response_content_type: String(formData.get("response_content_type") ?? "").trim() || null,
      auto_tags,
    },
  };
}

/** Link existing unrouted requests that match a route, so history shows under it. */
async function backfillRoute(routeId: string, input: Pick<RouteInput, "pattern" | "case_insensitive" | "methods">): Promise<number> {
  const re = compile(input);
  if (!re) return 0;
  const candidates = await listUnroutedForBackfill();
  const ids = candidates
    .filter((r) => (!input.methods || input.methods.includes(r.method)) && re.test(fullPath(r.endpoint_slug, r.path)))
    .map((r) => r.id);
  return assignRoute(routeId, ids);
}

export async function createRouteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await guard();
  const { input, error } = routeInputFromForm(formData);
  if (!input) return { ok: false, error };
  const route = await createRoute(input);
  invalidateRouteCache();
  const linked = formData.get("backfill") === "on" ? await backfillRoute(route.id, input) : 0;
  revalidatePath("/", "layout");
  redirect(`/routes/${route.id}${linked ? `?linked=${linked}` : ""}`);
}

export async function updateRouteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await guard();
  const id = String(formData.get("id") ?? "");
  if (!(await getRoute(id))) return { ok: false, error: "Route not found." };
  const { input, error } = routeInputFromForm(formData);
  if (!input) return { ok: false, error };
  await updateRoute(id, input);
  invalidateRouteCache();
  revalidatePath("/", "layout");
  return { ok: true, message: "Route saved." };
}

export async function setRouteEnabledAction(id: string, enabled: boolean): Promise<void> {
  await guard();
  await updateRoute(id, { enabled });
  invalidateRouteCache();
  revalidatePath("/", "layout");
}

export async function deleteRouteAction(id: string): Promise<void> {
  await guard();
  await deleteRoute(id);
  invalidateRouteCache();
  revalidatePath("/", "layout");
  redirect("/routes");
}

export async function backfillRouteAction(id: string): Promise<ActionState> {
  await guard();
  const route = await getRoute(id);
  if (!route) return { ok: false, error: "Route not found." };
  const n = await backfillRoute(route.id, route);
  revalidatePath("/", "layout");
  return { ok: true, message: n ? `Linked ${n} existing request${n === 1 ? "" : "s"}.` : "No unrouted requests match this pattern." };
}
