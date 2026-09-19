import { RefreshIpButton } from "@/components/refresh-ip-button";
import { SectionLabel } from "@/components/section-label";
import { flagEmoji } from "@/lib/ipinfo";
import type { IpInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

function Flag({ on, label, hue }: { on: boolean | undefined; label: string; hue: number }) {
  return (
    <span
      style={{ "--h": hue } as React.CSSProperties}
      className={cn(
        "inline-flex h-5 items-center border px-1.5 text-[10px] font-semibold tracking-widest uppercase",
        on ? "hue-chip" : "border-border text-muted-foreground/60 line-through decoration-muted-foreground/40",
      )}
      title={on ? `${label}: yes` : `${label}: no`}
    >
      {label}
    </span>
  );
}

/**
 * Where a request came from. Renders three states: lookups disabled, no data
 * (reserved IP or failed), and a full origin card.
 */
export function IpPanel({ ip, info, enabled, requestId }: { ip: string | null; info: IpInfo | null; enabled: boolean; requestId: string }) {
  return (
    <div className="space-y-3">
      <SectionLabel right={enabled && ip ? <RefreshIpButton requestId={requestId} /> : undefined}>Origin</SectionLabel>
      {!ip ? (
        <p className="text-xs text-muted-foreground">No source IP was recorded.</p>
      ) : !enabled ? (
        <div className="space-y-1 border border-dashed p-3 text-xs text-muted-foreground">
          <p className="font-mono text-foreground">{ip}</p>
          <p>
            Set <span className="font-mono">IP_API_KEY</span> to see location, network and risk flags for every sender.
          </p>
        </div>
      ) : !info || info.status !== "success" ? (
        <div className="space-y-1 border p-3 text-xs">
          <p className="font-mono">{ip}</p>
          <p className="text-muted-foreground">{info?.message === "reserved range" ? "Private or reserved address, nothing to geolocate." : info?.message ? `Lookup failed: ${info.message}` : "Not looked up yet."}</p>
        </div>
      ) : (
        <OriginCard info={info} />
      )}
    </div>
  );
}

function OriginCard({ info }: { info: IpInfo }) {
  const d = info.data;
  const place = [d.city, d.regionName, d.country].filter(Boolean).join(", ");
  const maps = d.lat != null && d.lon != null ? `https://www.openstreetmap.org/?mlat=${d.lat}&mlon=${d.lon}#map=11/${d.lat}/${d.lon}` : null;
  return (
    <div className="border">
      <div className="flex items-start gap-3 border-b p-3">
        <span className="text-3xl leading-none" aria-hidden>
          {flagEmoji(d.countryCode)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{place || d.country || "Unknown place"}</p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {info.ip}
            {d.reverse ? ` · ${d.reverse}` : ""}
          </p>
        </div>
      </div>
      <dl className="divide-y text-xs">
        {d.isp && <Row k="ISP" v={d.isp} />}
        {d.org && d.org !== d.isp && <Row k="Org" v={d.org} />}
        {d.as && <Row k="AS" v={d.as} mono />}
        {d.timezone && <Row k="Timezone" v={`${d.timezone}${d.offset != null ? ` (UTC${d.offset >= 0 ? "+" : ""}${d.offset / 3600})` : ""}`} mono />}
        {d.currency && <Row k="Currency" v={d.currency} mono />}
        {d.zip && <Row k="Postal" v={d.zip} mono />}
        {maps && (
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <dt className="text-muted-foreground">Coordinates</dt>
            <dd>
              <a href={maps} target="_blank" rel="noreferrer" className="font-mono underline-offset-2 hover:underline">
                {d.lat}, {d.lon}
              </a>
            </dd>
          </div>
        )}
      </dl>
      <div className="flex flex-wrap items-center gap-1.5 border-t p-3">
        <Flag on={d.proxy} label="proxy / vpn" hue={15} />
        <Flag on={d.hosting} label="datacenter" hue={75} />
        <Flag on={d.mobile} label="mobile" hue={242} />
      </div>
    </div>
  );
}

function Row({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2">
      <dt className="shrink-0 text-muted-foreground">{k}</dt>
      <dd className={cn("min-w-0 text-right break-words", mono && "font-mono")}>{v}</dd>
    </div>
  );
}
