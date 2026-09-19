import { headers } from "next/headers";
import { env } from "@/lib/env";

/** Public origin of this deployment, for showing copy-pasteable webhook URLs. */
export async function getBaseUrl(): Promise<string> {
  if (env.publicBaseUrl) return env.publicBaseUrl.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
