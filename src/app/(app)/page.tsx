import Link from "next/link";
import { CodePre } from "@/components/json-view";
import { CopyButton } from "@/components/copy-button";
import { EndpointCard } from "@/components/endpoint-card";
import { MethodBadge } from "@/components/method-badge";
import { PageHeader } from "@/components/page-header";
import { RequestList } from "@/components/request-list";
import { SectionLabel } from "@/components/section-label";
import { Sparkline } from "@/components/sparkline";
import { Button } from "@/components/ui/button";
import { getBaseUrl } from "@/lib/base-url";
import { countUnrouted, countUntriaged, getEndpointSparklines, getInsightsMany, getStats, getTriageSummary, listEndpoints, listRequests, listRoutes } from "@/lib/repo";
import { triageEnabled } from "@/lib/triage";
import { TriageSummaryPanel } from "@/components/triage-summary";
import { getDb } from "@/lib/db";
import { getCachedIpInfoMany, ipLookupEnabled, topOrigins } from "@/lib/ipinfo";
import { OriginsPanel } from "@/components/origins-panel";

async function unreadByEndpoint(): Promise<Record<string, number>> {
  const db = await getDb();
  const { rows } = await db.query<{ endpoint_id: string; n: number }>(`SELECT endpoint_id, COUNT(*) AS n FROM requests WHERE read = 0 GROUP BY endpoint_id`);
  return Object.fromEntries(rows.map((r) => [r.endpoint_id, Number(r.n)]));
}

export default async function OverviewPage() {
  const [stats, endpoints, sparklines, recent, unread, baseUrl, origins, routes, unroutedCount] = await Promise.all([
    getStats(),
    listEndpoints(),
    getEndpointSparklines(),
    listRequests({ limit: 12 }),
    unreadByEndpoint(),
    getBaseUrl(),
    topOrigins(24),
    listRoutes(),
    countUnrouted(),
  ]);
  const triageOn = triageEnabled();
  const [insights, triage, untriaged] = await Promise.all([
    getInsightsMany(recent.map((r) => r.id)),
    triageOn ? getTriageSummary(24) : null,
    triageOn ? countUntriaged() : 0,
  ]);
  const routesById = new Map(routes.map((r) => [r.id, r]));
  const ipEnabled = ipLookupEnabled();
  const ipInfo = ipEnabled ? await getCachedIpInfoMany(recent.map((r) => r.ip)) : undefined;
  const byId = new Map(endpoints.map((e) => [e.id, e]));
  const example = `curl -X POST ${baseUrl}/webhooks/my-product/stripe \\\n  -H 'content-type: application/json' \\\n  -d '{"event":"payment.succeeded","amount":4200}'`;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title="All quiet, or not."
        description="Everything that hits an ingest URL lands here instantly. Name it, route it, and replay it whenever you like."
        actions={
          <Button nativeButton={false} render={<Link href="/inbox" />} variant="outline" size="sm">
            Open inbox
          </Button>
        }
      />

      {/* Stats */}
      <section className="grid grid-cols-2 gap-px border bg-border md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Total captured" value={stats.total} />
        <Stat label="Last 24 hours" value={stats.last24h} />
        <Stat label="Endpoints" value={stats.endpoints} />
        <Stat label="Routes" value={routes.filter((r) => r.enabled).length} href="/routes" />
        <Stat label="Unrouted" value={unroutedCount} href="/inbox?unrouted=1" />
        <Stat label="Unread" value={stats.unread} accent={stats.unread > 0} />
      </section>

      <section className={ipEnabled ? "grid gap-6 lg:grid-cols-[2fr_1fr_1fr]" : "grid gap-6 lg:grid-cols-[2fr_1fr]"}>
        <div className="border p-4">
          <SectionLabel className="mb-3" right={<span className="font-mono text-[10px] text-muted-foreground">hourly · UTC</span>}>
            Traffic, last 24h
          </SectionLabel>
          <Sparkline data={stats.hourly} height={72} />
        </div>
        <div className="border p-4">
          <SectionLabel className="mb-3">Methods, last 24h</SectionLabel>
          {stats.methods.length === 0 ? (
            <p className="py-4 text-xs text-muted-foreground">No traffic yet.</p>
          ) : (
            <ul className="space-y-2">
              {stats.methods.map((m) => {
                const pct = Math.round((m.count / Math.max(1, stats.last24h)) * 100);
                return (
                  <li key={m.method} className="flex items-center gap-3 text-xs">
                    <MethodBadge method={m.method} />
                    <div className="h-1.5 flex-1 bg-muted">
                      <div className="h-full bg-foreground/70" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-14 text-right font-mono text-muted-foreground tabular">
                      {m.count} · {pct}%
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {ipEnabled && <OriginsPanel origins={origins} total={stats.last24h} />}
      </section>

      {triage && <TriageSummaryPanel summary={triage} untriaged={untriaged} />}

      {/* Endpoints */}
      <section className="space-y-3">
        <SectionLabel>Endpoints</SectionLabel>
        {endpoints.length === 0 ? (
          <div className="grid-paper border border-dashed p-6 sm:p-10">
            <h2 className="text-xl font-semibold">Zero setup. Send something.</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Any request to <span className="font-mono text-foreground">{baseUrl}/webhooks/&lt;name&gt;</span> creates the endpoint on the fly and stores the full request. Deeper paths work too.
            </p>
            <div className="relative mt-5 max-w-2xl">
              <CodePre className="border bg-background">{example}</CodePre>
              <CopyButton value={example} className="absolute top-2 right-2" iconOnly size="icon-xs" label="Copy example" />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {endpoints.map((ep) => (
              <EndpointCard key={ep.id} endpoint={ep} sparkline={sparklines[ep.id] ?? new Array(24).fill(0)} unread={unread[ep.id] ?? 0} />
            ))}
          </div>
        )}
      </section>

      {/* Recent */}
      <section className="space-y-3">
        <SectionLabel
          right={
            <Link href="/inbox" className="text-[10px] font-semibold tracking-widest uppercase hover:underline">
              View all
            </Link>
          }
        >
          Recent
        </SectionLabel>
        <RequestList requests={recent} endpointsById={byId} ipInfo={ipInfo} routesById={routesById} insights={insights} emptyTitle="No requests yet" emptyBody="The first webhook you send will show up here within a few seconds." />
      </section>
    </div>
  );
}

function Stat({ label, value, accent = false, href }: { label: string; value: number; accent?: boolean; href?: string }) {
  const body = (
    <>
      <div className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">{label}</div>
      <div className={`mt-1 font-heading text-3xl font-semibold tabular sm:text-4xl ${accent ? "text-primary-foreground" : ""}`}>
        {accent ? <span className="bg-primary px-1">{value}</span> : value}
      </div>
    </>
  );
  return href ? (
    <Link href={href} className="bg-background p-4 transition-colors hover:bg-muted/40 sm:p-5">
      {body}
    </Link>
  ) : (
    <div className="bg-background p-4 sm:p-5">{body}</div>
  );
}
