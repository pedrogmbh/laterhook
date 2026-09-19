import type { Metadata } from "next";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ArrowUpRight01Icon, LockKeyIcon } from "@hugeicons/core-free-icons";
import { EmptyState } from "@/components/empty-state";
import { MethodBadge } from "@/components/method-badge";
import { PageHeader } from "@/components/page-header";
import { RouteEnabledSwitch } from "@/components/route-actions";
import { TimeAgo } from "@/components/time-ago";
import { Button } from "@/components/ui/button";
import { countUnrouted, listRoutes } from "@/lib/repo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Routes" };

export default async function RoutesPage() {
  const [routes, unrouted] = await Promise.all([listRoutes(), countUnrouted()]);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Routes"
        title="Permanent webhooks"
        description="Regex rules over the incoming path. A match can forward, require a secret, shape the response and tag requests. First match by priority wins."
        actions={
          <>
            {unrouted > 0 && (
              <Button nativeButton={false} render={<Link href="/inbox?unrouted=1" />} variant="outline" size="sm">
                {unrouted} unrouted
              </Button>
            )}
            <Button nativeButton={false} render={<Link href="/routes/new" />} size="sm">
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
              New route
            </Button>
          </>
        }
      />

      {routes.length === 0 ? (
        <EmptyState title="No routes yet">
          Open any captured request and use <span className="font-semibold text-foreground">Register a route like this</span>, or create one from scratch.
        </EmptyState>
      ) : (
        <ul className="divide-y border">
          {routes.map((r) => (
            <li key={r.id} className={cn("grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3", !r.enabled && "opacity-60")}>
              <RouteEnabledSwitch route={r} size="sm" />
              <Link href={`/routes/${r.id}`} className="group min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold group-hover:underline">{r.name}</span>
                  <code className="truncate font-mono text-xs text-muted-foreground">{r.pattern}</code>
                  {r.case_insensitive && <span className="border px-1 text-[10px] tracking-wider text-muted-foreground uppercase">i</span>}
                  <span className="flex gap-1">{(r.methods ?? []).map((m) => <MethodBadge key={m} method={m} />)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  {r.forward_url ? (
                    <span className="inline-flex items-center gap-1 font-mono">
                      <HugeiconsIcon icon={ArrowUpRight01Icon} strokeWidth={2} className="size-3" />
                      {r.forward_url}
                    </span>
                  ) : (
                    <span>record only</span>
                  )}
                  {r.require_header_name && (
                    <span className="inline-flex items-center gap-1">
                      <HugeiconsIcon icon={LockKeyIcon} strokeWidth={2} className="size-3" />
                      requires <span className="font-mono">{r.require_header_name}</span>
                    </span>
                  )}
                  {r.auto_tags.length > 0 && <span>tags: {r.auto_tags.join(", ")}</span>}
                  <span className="font-mono">prio {r.priority}</span>
                </div>
              </Link>
              <div className="text-right text-[11px] text-muted-foreground tabular">
                <div>
                  <span className="font-mono text-base font-semibold text-foreground">{r.match_count}</span> matched
                </div>
                <div>{r.last_matched_at ? <TimeAgo iso={r.last_matched_at} className="font-mono" /> : "never"}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
