import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FiltersBar } from "@/components/filters-bar";
import { MarkAllReadButton } from "@/components/mark-all-read";
import { PageHeader } from "@/components/page-header";
import { RequestList } from "@/components/request-list";
import { triageEnabled } from "@/lib/triage";
import { sourceLabel } from "@/lib/triage-meta";
import { Button } from "@/components/ui/button";
import { getCachedIpInfoMany, ipLookupEnabled } from "@/lib/ipinfo";
import { getEndpointBySlug, getStats, listEndpoints, listRequests, listRoutes, listTags, getInsightsMany } from "@/lib/repo";

export const metadata: Metadata = { title: "Inbox" };

const PAGE = 50;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function InboxPage(props: PageProps<"/inbox">) {
  const sp = await props.searchParams;
  const endpointSlug = first(sp.endpoint);
  const endpoint = endpointSlug ? await getEndpointBySlug(endpointSlug) : null;
  const filters = {
    endpointId: endpoint?.id,
    method: first(sp.method),
    starred: first(sp.starred) === "1",
    unread: first(sp.unread) === "1",
    unrouted: first(sp.unrouted) === "1",
    rejected: first(sp.rejected) === "1",
    tag: first(sp.tag),
    needsAction: first(sp.action) === "1",
    hideNoise: first(sp.hidenoise) === "1",
    source: first(sp.source),
    search: first(sp.q),
    before: first(sp.before),
    limit: PAGE + 1,
  };
  const [rows, endpoints, tags, stats, routes] = await Promise.all([listRequests(filters), listEndpoints({ includeArchived: true }), listTags(), getStats(), listRoutes()]);
  const routesById = new Map(routes.map((r) => [r.id, r]));
  const hasMore = rows.length > PAGE;
  const requests = hasMore ? rows.slice(0, PAGE) : rows;
  const byId = new Map(endpoints.map((e) => [e.id, e]));
  const ipInfo = ipLookupEnabled() ? await getCachedIpInfoMany(requests.map((r) => r.ip)) : undefined;
  const insights = await getInsightsMany(requests.map((r) => r.id));

  const nextParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "before") nextParams.set(k, v);
  if (hasMore) nextParams.set("before", requests[requests.length - 1].received_at);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inbox"
        title={filters.needsAction ? "Needs action" : filters.source ? `From ${sourceLabel(filters.source)}` : filters.starred ? "Starred" : filters.unrouted ? "Unrouted" : filters.rejected ? "Rejected" : "Everything"}
        description={`${stats.total} requests across ${stats.endpoints} endpoints`}
        actions={<MarkAllReadButton count={stats.unread} />}
      />
      <Suspense>
        <FiltersBar endpoints={endpoints} tags={tags} triage={triageEnabled()} />
      </Suspense>
      <RequestList
        requests={requests}
        endpointsById={byId}
        ipInfo={ipInfo}
        insights={insights}
        routesById={routesById}
        emptyTitle={filters.search || filters.method || filters.tag || filters.starred || filters.unread || filters.unrouted || filters.rejected || filters.needsAction || filters.hideNoise || filters.source || endpoint ? "No matches" : "Nothing captured yet"}
        emptyBody={filters.search ? `Nothing contains “${filters.search}”.` : undefined}
      />
      {hasMore && (
        <div className="flex justify-center">
          <Button nativeButton={false} render={<Link href={`/inbox?${nextParams}`} />} variant="outline" size="sm">
            Older requests
          </Button>
        </div>
      )}
    </div>
  );
}
