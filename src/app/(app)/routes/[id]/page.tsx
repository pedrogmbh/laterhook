import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FiltersBar } from "@/components/filters-bar";
import { MethodBadge } from "@/components/method-badge";
import { PageHeader } from "@/components/page-header";
import { RequestList } from "@/components/request-list";
import { triageEnabled } from "@/lib/triage";
import { RouteDangerZone, RouteEnabledSwitch } from "@/components/route-actions";
import { RouteForm } from "@/components/route-form";
import { SectionLabel } from "@/components/section-label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCachedIpInfoMany, ipLookupEnabled } from "@/lib/ipinfo";
import { getRoute, listEndpoints, listRequests, listTags, getInsightsMany } from "@/lib/repo";

export async function generateMetadata(props: PageProps<"/routes/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const r = await getRoute(id);
  return { title: r ? `Route · ${r.name}` : "Route" };
}

const PAGE = 50;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function RoutePage(props: PageProps<"/routes/[id]">) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const route = await getRoute(id);
  if (!route) notFound();
  const filters = {
    routeId: route.id,
    method: first(sp.method),
    starred: first(sp.starred) === "1",
    unread: first(sp.unread) === "1",
    rejected: first(sp.rejected) === "1",
    tag: first(sp.tag),
    needsAction: first(sp.action) === "1",
    hideNoise: first(sp.hidenoise) === "1",
    source: first(sp.source),
    search: first(sp.q),
    before: first(sp.before),
    limit: PAGE + 1,
  };
  const [rows, endpoints, tags] = await Promise.all([listRequests(filters), listEndpoints({ includeArchived: true }), listTags()]);
  const hasMore = rows.length > PAGE;
  const requests = hasMore ? rows.slice(0, PAGE) : rows;
  const byId = new Map(endpoints.map((e) => [e.id, e]));
  const ipInfo = ipLookupEnabled() ? await getCachedIpInfoMany(requests.map((r) => r.ip)) : undefined;
  const insights = await getInsightsMany(requests.map((r) => r.id));
  const tab = first(sp.tab) === "settings" ? "settings" : "requests";
  const linked = first(sp.linked);
  const nextParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "before" && k !== "linked") nextParams.set(k, v);
  if (hasMore) nextParams.set("before", requests[requests.length - 1].received_at);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<Link href="/routes" className="hover:underline">Routes</Link>}
        title={route.name}
        description={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <code className="font-mono text-xs text-foreground">{route.pattern}</code>
            {route.case_insensitive && <span className="border px-1 text-[10px] tracking-wider uppercase">i</span>}
            <span className="flex gap-1">{(route.methods ?? []).map((m) => <MethodBadge key={m} method={m} />)}</span>
            {route.forward_url && <span className="font-mono text-xs">→ {route.forward_url}</span>}
            {route.require_header_name && <span className="text-xs">requires <span className="font-mono">{route.require_header_name}</span></span>}
            {route.description && <span className="basis-full text-sm">{route.description}</span>}
          </div>
        }
        actions={
          <label className="flex items-center gap-2 text-xs">
            <RouteEnabledSwitch route={route} />
            {route.enabled ? "Enabled" : "Disabled"}
          </label>
        }
      />
      {linked && (
        <p className="border border-l-4 border-l-primary px-3 py-2 text-xs">
          Route created. <span className="font-semibold">{linked}</span> existing request{linked === "1" ? "" : "s"} now belong to it.
        </p>
      )}

      <Tabs value={tab}>
        <TabsList variant="line" className="w-full justify-start border-b">
          <TabsTrigger value="requests" nativeButton={false} render={<Link href={`/routes/${route.id}`} />}>
            Matched <span className="ml-1 font-mono text-[10px] text-muted-foreground tabular">{route.match_count}</span>
          </TabsTrigger>
          <TabsTrigger value="settings" nativeButton={false} render={<Link href={`/routes/${route.id}?tab=settings`} />}>
            Settings
          </TabsTrigger>
        </TabsList>
        <TabsContent value="requests" className="space-y-5 pt-2">
          <Suspense>
            <FiltersBar endpoints={endpoints} tags={tags} showRouted={false} triage={triageEnabled()} />
          </Suspense>
          <RequestList requests={requests} endpointsById={byId} ipInfo={ipInfo} insights={insights} emptyTitle="Nothing matched yet" emptyBody="Requests whose path matches this pattern will be listed here as they arrive." />
          {hasMore && (
            <div className="flex justify-center">
              <Button nativeButton={false} render={<Link href={`/routes/${route.id}?${nextParams}`} />} variant="outline" size="sm">
                Older requests
              </Button>
            </div>
          )}
        </TabsContent>
        <TabsContent value="settings" className="space-y-10 pt-4">
          <RouteForm route={route} />
          <section className="space-y-4 border border-destructive/30 p-5">
            <SectionLabel>Maintenance</SectionLabel>
            <RouteDangerZone route={route} />
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
