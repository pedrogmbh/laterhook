import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { EndpointDot, hueStyle } from "@/components/endpoint-dot";
import { Sparkline } from "@/components/sparkline";
import { TimeAgo } from "@/components/time-ago";
import { COLOR_OKLCH } from "@/lib/palette";
import type { Endpoint } from "@/lib/types";

export function EndpointCard({ endpoint, sparkline, unread = 0 }: { endpoint: Endpoint; sparkline: number[]; unread?: number }) {
  const last24 = sparkline.reduce((a, b) => a + b, 0);
  return (
    <Link
      href={`/e/${endpoint.slug}`}
      style={hueStyle(endpoint.color)}
      className="group relative flex flex-col gap-4 border border-t-2 bg-card p-4 transition-colors hover:bg-muted/40 hue-accent-border border-x-border border-b-border"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <EndpointDot color={endpoint.color} />
            <h3 className="truncate text-base font-semibold">{endpoint.name ?? endpoint.slug}</h3>
          </div>
          <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">/webhooks/{endpoint.slug}</p>
        </div>
        {unread > 0 && (
          <span className="shrink-0 bg-primary px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary-foreground">{unread} new</span>
        )}
      </div>
      <Sparkline data={sparkline} hue={COLOR_OKLCH[endpoint.color].hue} height={32} />
      <div className="flex items-end justify-between gap-2 text-[11px] text-muted-foreground">
        <div className="space-y-0.5">
          <div>
            <span className="font-mono text-lg font-semibold text-foreground tabular">{endpoint.request_count}</span>{" "}
            <span className="tracking-wider uppercase">total</span>
            <span className="mx-1.5 opacity-50">·</span>
            <span className="font-mono text-foreground tabular">{last24}</span> <span className="tracking-wider uppercase">24h</span>
          </div>
          <div className="flex items-center gap-2">
            {endpoint.last_received_at ? (
              <>
                last <TimeAgo iso={endpoint.last_received_at} className="font-mono" />
              </>
            ) : (
              <span>never received</span>
            )}
            {endpoint.forward_enabled && endpoint.forward_url && (
              <span className="inline-flex items-center gap-0.5 border px-1 text-[10px] tracking-wider uppercase hue-text">
                <HugeiconsIcon icon={ArrowUpRight01Icon} strokeWidth={2} className="size-3" />
                forwarding
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
