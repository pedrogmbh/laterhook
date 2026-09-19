import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { BodyView } from "@/components/body-view";
import { CopyButton } from "@/components/copy-button";
import { EndpointDot, hueStyle } from "@/components/endpoint-dot";
import { CodePre, JsonView } from "@/components/json-view";
import { KvTable } from "@/components/kv-table";
import { MethodBadge } from "@/components/method-badge";
import { NoteEditor } from "@/components/note-editor";
import { RequestActions } from "@/components/request-actions";
import { SectionLabel } from "@/components/section-label";
import { StatusPill } from "@/components/status-pill";
import { TagsEditor } from "@/components/tags-editor";
import { LocalTime, TimeAgo } from "@/components/time-ago";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBytes, formatDuration, shortContentType, toCurl } from "@/lib/format";
import { flagEmoji, ipLookupEnabled, lookupIp } from "@/lib/ipinfo";
import { getEndpointById, getRequest, listDeliveries, listTags, updateRequest } from "@/lib/repo";
import { IpPanel } from "@/components/ip-panel";

export async function generateMetadata(props: PageProps<"/r/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const r = await getRequest(id);
  return { title: r ? `${r.method} /${r.endpoint_slug}${r.path ? "/" + r.path : ""}` : "Request" };
}

const NOISY_HEADER = /^(x-vercel-|x-forwarded-|forwarded$|x-real-ip$|x-matched-path$|cf-|cdn-loop$|x-invoke-)/i;

export default async function RequestPage(props: PageProps<"/r/[id]">) {
  const { id } = await props.params;
  const request = await getRequest(id);
  if (!request) notFound();
  // lookupIp is cached per IP; the network call only happens the first time an address is seen.
  const [endpoint, deliveries, tags, ipInfo] = await Promise.all([getEndpointById(request.endpoint_id), listDeliveries(request.id), listTags(), lookupIp(request.ip)]);
  const ipEnabled = ipLookupEnabled();
  if (!request.read) after(() => updateRequest(request.id, { read: true }));

  const headerEntries = Object.entries(request.headers).sort(([a], [b]) => a.localeCompare(b));
  const primary = headerEntries.filter(([k]) => !NOISY_HEADER.test(k));
  const infra = headerEntries.filter(([k]) => NOISY_HEADER.test(k));
  const queryEntries: [string, string][] = Object.entries(request.query).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x] as [string, string]) : [[k, v] as [string, string]]));
  const curl = toCurl({ method: request.method, url: request.url, headers: request.headers, body: request.body, bodyEncoding: request.body_encoding });
  const rawJson = JSON.stringify(
    { id: request.id, method: request.method, url: request.url, received_at: request.received_at, ip: request.ip, headers: request.headers, query: request.query, body: request.body_encoding === "utf8" ? request.body : request.body ? `<base64:${request.size} bytes>` : null },
    null,
    2,
  );

  return (
    <div className="space-y-6" style={endpoint ? hueStyle(endpoint.color) : undefined}>
      <nav className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Link href="/inbox" className="hover:text-foreground">
          Inbox
        </Link>
        <span>/</span>
        {endpoint ? (
          <Link href={`/e/${endpoint.slug}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
            <EndpointDot color={endpoint.color} size="sm" />
            {endpoint.name ?? endpoint.slug}
          </Link>
        ) : (
          <span>{request.endpoint_slug}</span>
        )}
        <span>/</span>
        <span className="font-mono">{request.id}</span>
      </nav>

      <header className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <MethodBadge method={request.method} className="h-6 text-xs" />
            <h1 className="truncate font-mono text-xl font-semibold sm:text-2xl">
              /{request.endpoint_slug}
              {request.path && <span className="text-muted-foreground">/{request.path}</span>}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Received <TimeAgo iso={request.received_at} className="text-foreground" /> · <LocalTime iso={request.received_at} />
            {request.ip && (
              <>
                {" "}
                · from <span className="font-mono text-foreground">{request.ip}</span>
                {ipInfo?.status === "success" && (
                  <span className="text-foreground">
                    {" "}
                    <span aria-hidden>{flagEmoji(ipInfo.data.countryCode)}</span> {[ipInfo.data.city, ipInfo.data.country].filter(Boolean).join(", ")}
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        <RequestActions request={request} defaultTarget={endpoint?.forward_url ?? null} curl={curl} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-6">
          <Tabs defaultValue="body">
            <TabsList variant="line" className="w-full justify-start border-b">
              <TabsTrigger value="body">
                Body <span className="ml-1 font-mono text-[10px] text-muted-foreground">{shortContentType(request.content_type)}</span>
              </TabsTrigger>
              <TabsTrigger value="headers">
                Headers <span className="ml-1 font-mono text-[10px] text-muted-foreground tabular">{headerEntries.length}</span>
              </TabsTrigger>
              <TabsTrigger value="query">
                Query <span className="ml-1 font-mono text-[10px] text-muted-foreground tabular">{queryEntries.length}</span>
              </TabsTrigger>
              <TabsTrigger value="deliveries">
                Deliveries <span className="ml-1 font-mono text-[10px] text-muted-foreground tabular">{deliveries.length}</span>
              </TabsTrigger>
              <TabsTrigger value="raw">Raw</TabsTrigger>
            </TabsList>

            <TabsContent value="body" className="relative border">
              {request.body && request.body_encoding === "utf8" && <CopyButton value={request.body} iconOnly size="icon-xs" label="Copy body" className="absolute top-2 right-2 z-10" />}
              <BodyView request={request} />
            </TabsContent>

            <TabsContent value="headers" className="space-y-4">
              <div className="border">
                <KvTable entries={primary} emptyLabel="No headers" />
              </div>
              {infra.length > 0 && (
                <details className="border">
                  <summary className="cursor-pointer px-4 py-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                    Infrastructure headers ({infra.length})
                  </summary>
                  <KvTable entries={infra} />
                </details>
              )}
            </TabsContent>

            <TabsContent value="query" className="border">
              <KvTable entries={queryEntries} emptyLabel="No query parameters" />
            </TabsContent>

            <TabsContent value="deliveries" className="space-y-3">
              {deliveries.length === 0 ? (
                <p className="border px-4 py-10 text-center text-xs text-muted-foreground">
                  Not delivered anywhere yet. Use <span className="font-semibold text-foreground">Replay</span> to send it to a target, or enable forwarding on the endpoint.
                </p>
              ) : (
                <ul className="divide-y border">
                  {deliveries.map((d) => (
                    <li key={d.id} className="space-y-2 p-4">
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <StatusPill status={d.status_code} error={d.error} />
                        <span className="border px-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{d.kind}</span>
                        <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground">{d.target_url}</span>
                        <span className="font-mono text-muted-foreground tabular">{formatDuration(d.duration_ms)}</span>
                        <TimeAgo iso={d.created_at} className="font-mono text-muted-foreground" />
                      </div>
                      {d.error && <p className="text-xs text-destructive">{d.error}</p>}
                      {d.response_body && (
                        <details>
                          <summary className="cursor-pointer text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Response body</summary>
                          <JsonView text={d.response_body} className="mt-2 max-h-72 border" />
                        </details>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="raw" className="relative border">
              <CopyButton value={rawJson} iconOnly size="icon-xs" label="Copy JSON" className="absolute top-2 right-2 z-10" />
              <JsonView text={rawJson} className="max-h-[70vh]" />
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <SectionLabel right={<CopyButton value={curl} label="Copy" />}>Reproduce with curl</SectionLabel>
            <CodePre className="border whitespace-pre-wrap">{curl}</CodePre>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="space-y-3">
            <SectionLabel>Details</SectionLabel>
            <dl className="divide-y border text-xs">
              <Row k="ID" v={request.id} mono />
              <Row k="Content-Type" v={request.content_type ?? "–"} mono />
              <Row k="Size" v={request.size ? formatBytes(request.size) + (request.body_truncated ? " (truncated)" : "") : "0 B"} mono />
              <Row k="Encoding" v={request.body_encoding} mono />
              <Row k="User-Agent" v={request.user_agent ?? "–"} />
              {(request.forward_status != null || request.forward_error) && (
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <dt className="text-muted-foreground">Auto-forward</dt>
                  <dd>
                    <StatusPill status={request.forward_status} error={request.forward_error} />
                  </dd>
                </div>
              )}
            </dl>
          </div>
          <IpPanel ip={request.ip} info={ipInfo} enabled={ipEnabled} requestId={request.id} />
          <div className="space-y-3">
            <SectionLabel>Tags</SectionLabel>
            <TagsEditor requestId={request.id} initial={request.tags} suggestions={tags} />
          </div>
          <div className="space-y-3">
            <SectionLabel>Note</SectionLabel>
            <NoteEditor requestId={request.id} initial={request.note} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2">
      <dt className="shrink-0 text-muted-foreground">{k}</dt>
      <dd className={`min-w-0 text-right break-all ${mono ? "font-mono" : ""}`}>{v}</dd>
    </div>
  );
}
