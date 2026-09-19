import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { DashboardSquare01Icon, InboxIcon, StarIcon, Logout03Icon, Link04Icon } from "@hugeicons/core-free-icons";
import { logoutAction } from "@/app/actions";
import { CopyButton } from "@/components/copy-button";
import { EndpointDot } from "@/components/endpoint-dot";
import { LivePoller } from "@/components/live-poller";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/nav-link";
import type { Endpoint } from "@/lib/types";

export function AppShell({
  endpoints,
  baseUrl,
  children,
}: {
  endpoints: Endpoint[];
  baseUrl: string;
  children: React.ReactNode;
}) {
  const now = new Date().toISOString();
  const nav = (
    <>
      <NavLink href="/" exact icon={<HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />}>
        Overview
      </NavLink>
      <NavLink href="/inbox" icon={<HugeiconsIcon icon={InboxIcon} strokeWidth={2} />}>
        Inbox
      </NavLink>
      <NavLink href="/inbox?starred=1" icon={<HugeiconsIcon icon={StarIcon} strokeWidth={2} />}>
        Starred
      </NavLink>
    </>
  );

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex md:h-screen">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <Brand />
          <ThemeToggle />
        </div>
        <nav className="flex flex-col gap-0.5 p-3">{nav}</nav>
        <div className="flex items-center justify-between px-5 pt-3 pb-1">
          <span className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">Endpoints</span>
          <span className="font-mono text-[10px] text-muted-foreground">{endpoints.length}</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          {endpoints.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              None yet. Send anything to <span className="font-mono">/webhooks/&lt;name&gt;</span>.
            </p>
          )}
          {endpoints.map((ep) => (
            <NavLink key={ep.id} href={`/e/${ep.slug}`} icon={<EndpointDot color={ep.color} />} trailing={<span className="font-mono text-[10px] text-muted-foreground tabular">{ep.request_count}</span>}>
              <span className="truncate">{ep.name ?? ep.slug}</span>
            </NavLink>
          ))}
        </nav>
        <div className="space-y-3 border-t p-4">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">Ingest URL</span>
              <CopyButton value={`${baseUrl}/webhooks/`} iconOnly size="icon-xs" label="Copy base URL" />
            </div>
            <p className="truncate font-mono text-[11px] text-muted-foreground" title={`${baseUrl}/webhooks/…`}>
              <HugeiconsIcon icon={Link04Icon} strokeWidth={2} className="mr-1 inline size-3 align-[-2px]" />
              {baseUrl.replace(/^https?:\/\//, "")}/webhooks/…
            </p>
          </div>
          <div className="flex items-center justify-between">
            <LivePoller initialSince={now} />
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="xs">
                <HugeiconsIcon icon={Logout03Icon} strokeWidth={2} data-icon="inline-start" />
                Log out
              </Button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Brand />
          <div className="flex items-center gap-1">
            <LivePoller initialSince={now} />
            <ThemeToggle />
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="icon-sm" aria-label="Log out">
                <HugeiconsIcon icon={Logout03Icon} strokeWidth={2} />
              </Button>
            </form>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {nav}
          {endpoints.map((ep) => (
            <NavLink key={ep.id} href={`/e/${ep.slug}`} icon={<EndpointDot color={ep.color} />} compact>
              {ep.name ?? ep.slug}
            </NavLink>
          ))}
        </nav>
      </div>

      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </main>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" className="group flex items-center gap-2">
      <span className="grid size-6 place-items-center bg-primary font-heading text-xs font-bold text-primary-foreground">L</span>
      <span className="font-heading text-sm font-bold tracking-[0.2em] uppercase">laterhook</span>
    </Link>
  );
}
