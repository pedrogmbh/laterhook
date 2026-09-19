"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkPassword, clearSessionCookie, isAuthenticated, setSessionCookie } from "@/lib/auth";
import { deliver } from "@/lib/forward";
import { ipLookupEnabled, lookupIp } from "@/lib/ipinfo";
import { isEndpointColor } from "@/lib/palette";
import {
  clearEndpointRequests,
  deleteEndpoint,
  deleteRequest,
  getEndpointById,
  getRequest,
  markAllRead,
  updateEndpoint,
  updateRequest,
} from "@/lib/repo";

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
  if (!target) {
    const ep = await getEndpointById(req.endpoint_id);
    target = ep?.forward_url ?? undefined;
  }
  if (!target) return { ok: false, error: "No target URL. Set a forward URL on the endpoint or provide one." };
  try {
    new URL(target);
  } catch {
    return { ok: false, error: "Target must be an absolute URL." };
  }
  const d = await deliver(req, target, "replay");
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
