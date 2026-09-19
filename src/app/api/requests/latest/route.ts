import type { NextRequest } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { listRequestsSince } from "@/lib/repo";

/** Lightweight poll used by the live indicator: "anything new since <ts>?" */
export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const since = request.nextUrl.searchParams.get("since");
  if (!since) return Response.json({ error: "since is required" }, { status: 400 });
  const rows = await listRequestsSince(since, 20);
  return Response.json(
    {
      count: rows.length,
      latest: rows[0]?.received_at ?? since,
      items: rows.map((r) => ({
        id: r.id,
        endpoint_slug: r.endpoint_slug,
        method: r.method,
        path: r.path,
        received_at: r.received_at,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
