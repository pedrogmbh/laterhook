import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CopyButton } from "@/components/copy-button";
import { EndpointDangerZone } from "@/components/endpoint-danger-zone";
import { EndpointDot, hueStyle } from "@/components/endpoint-dot";
import { EndpointSettingsForm } from "@/components/endpoint-settings-form";
import { FiltersBar } from "@/components/filters-bar";
import { MarkAllReadButton } from "@/components/mark-all-read";
import { PageHeader } from "@/components/page-header";
import { RequestList } from "@/components/request-list";
import { Sparkline } from "@/components/sparkline";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBaseUrl } from "@/lib/base-url";
import { COLOR_OKLCH } from "@/lib/palette";
import { getEndpointBySlug, getEndpointSparklines, listRequests, listTags } from "@/lib/repo";
import { getDb } from "@/lib/db";
import { getCachedIpInfoMany, ipLookupEnabled } from "@/lib/ipinfo";

export async function generateMetadata(props: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  return { title: slug };
}

const PAGE = 50;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function EndpointPage(props: PageProps<"/e/[slug]">) {
  const [{ slug }, sp] = await Promise.all([props.params, props.searchParams]);
  const endpoint = await getEndpointBySlug(slug);
  if (!endpoint) notFound();

  const filters = {
    endpointId: endpoint.id,
    method: first(sp.method),
    starred: first(sp.starred) === "1",
    unread: first(sp.unread) === "1",
    tag: first(sp.tag),
    search: first(sp.q),
    before: first(sp.before),
    limit: PAGE + 1,
  };
  const db = await getDb();
  const [rows, tags, sparklines, baseUrl, unreadRow] = await Promise.all([
    listRequests(filters),
    listTags(),
    getEndpointSparklines(),
    getBaseUrl(),
    db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM requests WHERE endpoint_id = ? AND read = 0`, [endpoint.id]),
  ]);
  const unread = Number(unreadRow.rows[0]?.n ?? 0);
  const hasMore = rows.length > PAGE;
  const requests = hasMore ? rows.slice(0, PAGE) : rows;
  const byId = new Map([[endpoint.id, endpoint]]);
  const ipInfo = ipLookupEnabled() ? await getCachedIpInfoMany(requests.map((r) => r.ip)) : undefined;
  const ingestUrl = `${baseUrl}/webhooks/${endpoint.slug}`;
  const tab = first(sp.tab) === "settings" ? "settings" : "requests";

  const nextParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "before") nextParams.set(k, v);
  if (hasMore) nextParams.set("before", requests[requests.length - 1].received_at);

  return (
    <div className="space-y-6" style={hueStyle(endpoint.color)}>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <EndpointDot color={endpoint.color} size="sm" /> Endpoint {endpoint.archived && "· archived"}
          </span>
        }
        title={endpoint.name ?? endpoint.slug}
        description={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-xs text-foreground">{ingestUrl}</span>
            <CopyButton value={ingestUrl} label="Copy URL" />
            {endpoint.description && <span className="basis-full text-sm">{endpoint.description}</span>}
          </div>
        }
        actions={
          <>
            <MarkAllReadButton endpointId={endpoint.id} count={unread} />
            <div className="hidden w-40 sm:block">
              <Sparkline data={sparklines[endpoint.id] ?? new Array(24).fill(0)} hue={COLOR_OKLCH[endpoint.color].hue} height={28} />
            </div>
          </>
        }
      />

      {endpoint.forward_enabled && endpoint.forward_url && (
        <div className="flex flex-wrap items-center gap-2 border border-l-4 px-3 py-2 text-xs hue-accent-border border-y-border border-r-border">
          <span className="font-semibold tracking-widest uppercase hue-text">Forwarding</span>
          <span className="font-mono text-muted-foreground">→ {endpoint.forward_url}</span>
        </div>
      )}

      <Tabs value={tab}>
        <TabsList variant="line" className="border-b w-full justify-start">
          <TabsTrigger value="requests" nativeButton={false} render={<Link href={`/e/${endpoint.slug}`} />}>
            Requests <span className="ml-1 font-mono text-[10px] text-muted-foreground tabular">{endpoint.request_count}</span>
          </TabsTrigger>
          <TabsTrigger value="settings" nativeButton={false} render={<Link href={`/e/${endpoint.slug}?tab=settings`} />}>
            Settings
          </TabsTrigger>
        </TabsList>
        <TabsContent value="requests" className="space-y-5 pt-2">
          <Suspense>
            <FiltersBar endpoints={[]} tags={tags} showEndpoint={false} />
          </Suspense>
          <RequestList
            requests={requests}
            endpointsById={byId}
            ipInfo={ipInfo}
            showEndpoint={false}
            emptyTitle={filters.search || filters.method || filters.tag || filters.starred || filters.unread ? "No matches" : "Waiting for the first request"}
            emptyBody={
              <>
                Send anything to <span className="font-mono text-foreground">{ingestUrl}</span>. Deeper paths like <span className="font-mono">/{endpoint.slug}/stripe/live</span> are captured too.
              </>
            }
          />
          {hasMore && (
            <div className="flex justify-center">
              <Button nativeButton={false} render={<Link href={`/e/${endpoint.slug}?${nextParams}`} />} variant="outline" size="sm">
                Older requests
              </Button>
            </div>
          )}
        </TabsContent>
        <TabsContent value="settings" className="space-y-10 pt-4">
          <EndpointSettingsForm endpoint={endpoint} />
          <EndpointDangerZone endpoint={endpoint} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
