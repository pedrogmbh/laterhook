"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, StarIcon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { EndpointDot } from "@/components/endpoint-dot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { METHODS } from "@/lib/palette";
import type { Endpoint } from "@/lib/types";
import { cn } from "@/lib/utils";

const ALL = "__all__";

export function FiltersBar({ endpoints, tags, showEndpoint = true }: { endpoints: Endpoint[]; tags: string[]; showEndpoint?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  useEffect(() => setQ(params.get("q") ?? ""), [params]);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "" || v === ALL) next.delete(k);
      else next.set(k, v);
    }
    next.delete("before");
    start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`));
  };

  const starred = params.get("starred") === "1";
  const unread = params.get("unread") === "1";
  const active = ["q", "method", "endpoint", "tag", "starred", "unread"].some((k) => params.get(k));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        className="relative min-w-56 flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          set({ q });
        }}
      >
        <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => q !== (params.get("q") ?? "") && set({ q })} placeholder="Search body, path, headers…" className="h-9 pl-8 text-xs" />
      </form>

      <Select value={params.get("method") ?? ALL} onValueChange={(v) => set({ method: v as string })}>
        <SelectTrigger className="h-9 w-28 text-xs" size="sm">
          <SelectValue placeholder="Method" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any method</SelectItem>
          {METHODS.map((m) => (
            <SelectItem key={m} value={m}>
              <span className="font-mono">{m}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showEndpoint && (
        <Select value={params.get("endpoint") ?? ALL} onValueChange={(v) => set({ endpoint: v as string })}>
          <SelectTrigger className="h-9 w-44 text-xs" size="sm">
            <SelectValue placeholder="Endpoint" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All endpoints</SelectItem>
            {endpoints.map((ep) => (
              <SelectItem key={ep.id} value={ep.slug}>
                <span className="inline-flex items-center gap-2">
                  <EndpointDot color={ep.color} size="sm" />
                  {ep.name ?? ep.slug}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {tags.length > 0 && (
        <Select value={params.get("tag") ?? ALL} onValueChange={(v) => set({ tag: v as string })}>
          <SelectTrigger className="h-9 w-36 text-xs" size="sm">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any tag</SelectItem>
            {tags.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Button type="button" variant="outline" size="sm" aria-pressed={starred} className={cn(starred && "border-amber-500 text-amber-600 dark:text-amber-400")} onClick={() => set({ starred: starred ? null : "1" })}>
        <HugeiconsIcon icon={StarIcon} strokeWidth={2} data-icon="inline-start" fill={starred ? "currentColor" : "none"} />
        Starred
      </Button>
      <Button type="button" variant="outline" size="sm" aria-pressed={unread} className={cn(unread && "border-primary")} onClick={() => set({ unread: unread ? null : "1" })}>
        Unread
      </Button>
      {active && (
        <Button type="button" variant="ghost" size="sm" onClick={() => start(() => router.replace(pathname))}>
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} data-icon="inline-start" />
          Clear
        </Button>
      )}
    </div>
  );
}
