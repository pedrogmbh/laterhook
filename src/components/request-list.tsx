import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { StarIcon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { EndpointDot } from "@/components/endpoint-dot";
import { MethodBadge } from "@/components/method-badge";
import { StatusPill } from "@/components/status-pill";
import { TimeAgo } from "@/components/time-ago";
import { EmptyState } from "@/components/empty-state";
import { formatBytes, shortContentType } from "@/lib/format";
import type { Endpoint, WebhookRequest } from "@/lib/types";
import { cn } from "@/lib/utils";

function bodyPreview(r: WebhookRequest): string | null {
  if (!r.body || r.body_encoding !== "utf8") return null;
  const t = r.body.replace(/\s+/g, " ").trim();
  return t.length > 140 ? t.slice(0, 140) + "…" : t;
}

export function RequestList({
  requests,
  endpointsById,
  showEndpoint = true,
  emptyTitle = "Nothing captured yet",
  emptyBody,
  highlightSince,
}: {
  requests: WebhookRequest[];
  endpointsById: Map<string, Endpoint>;
  showEndpoint?: boolean;
  emptyTitle?: string;
  emptyBody?: React.ReactNode;
  highlightSince?: string;
}) {
  if (!requests.length) return <EmptyState title={emptyTitle}>{emptyBody}</EmptyState>;
  return (
    <ul className="divide-y border">
      {requests.map((r) => {
        const ep = endpointsById.get(r.endpoint_id);
        const preview = bodyPreview(r);
        const isNew = highlightSince ? r.received_at > highlightSince : false;
        return (
          <li key={r.id} className={cn(isNew && "row-new")}>
            <Link
              href={`/r/${r.id}`}
              className={cn(
                "group grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 transition-colors hover:bg-muted/50 sm:px-4",
                !r.read && "border-l-2 border-l-primary",
                r.read && "border-l-2 border-l-transparent",
              )}
            >
              <MethodBadge method={r.method} />
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  {showEndpoint && ep && (
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold">
                      <EndpointDot color={ep.color} size="sm" />
                      {ep.name ?? ep.slug}
                    </span>
                  )}
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    /{r.endpoint_slug}
                    {r.path ? `/${r.path}` : ""}
                  </span>
                  {r.starred && <HugeiconsIcon icon={StarIcon} strokeWidth={2.5} className="size-3 shrink-0 text-amber-500" fill="currentColor" />}
                  {r.tags.slice(0, 3).map((t) => (
                    <span key={t} className="hidden shrink-0 border px-1 text-[10px] tracking-wider text-muted-foreground uppercase md:inline">
                      {t}
                    </span>
                  ))}
                </div>
                {preview ? (
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground/80">{preview}</p>
                ) : (
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground/60 italic">no body</p>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground tabular">
                {(r.forward_status != null || r.forward_error) && (
                  <span className="hidden items-center gap-1 sm:inline-flex" title="Forward result">
                    <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3" />
                    <StatusPill status={r.forward_status} error={r.forward_error} />
                  </span>
                )}
                <span className="hidden w-14 text-right font-mono uppercase lg:inline">{shortContentType(r.content_type)}</span>
                <span className="hidden w-14 text-right font-mono md:inline">{r.size ? formatBytes(r.size) : "–"}</span>
                <TimeAgo iso={r.received_at} className="w-16 text-right font-mono" />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
