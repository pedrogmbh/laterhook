"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const KEY = "laterhook:live";

/**
 * Polls for new requests and refreshes the server-rendered tree when any
 * arrive. Lives in the shell so every page stays fresh while you watch.
 */
export function LivePoller({ initialSince, intervalMs = 3000 }: { initialSince: string; intervalMs?: number }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(true);
  const [pulse, setPulse] = useState(false);
  const since = useRef(initialSince);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored != null) setEnabled(stored !== "0");
    } catch {}
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (document.visibilityState === "visible") {
        try {
          const res = await fetch(`/api/requests/latest?since=${encodeURIComponent(since.current)}`, { cache: "no-store" });
          if (res.ok) {
            const data = (await res.json()) as { count: number; latest: string; items: { endpoint_slug: string; method: string }[] };
            if (!cancelled && data.count > 0) {
              since.current = data.latest;
              setPulse(true);
              setTimeout(() => setPulse(false), 1200);
              const first = data.items[0];
              toast(data.count === 1 ? `${first.method} → ${first.endpoint_slug}` : `${data.count} new requests`, {
                description: data.count === 1 ? "New webhook captured" : `Latest: ${first.method} → ${first.endpoint_slug}`,
              });
              router.refresh();
            }
          }
        } catch {}
      }
      if (!cancelled) timer = setTimeout(poll, intervalMs);
    };
    timer = setTimeout(poll, intervalMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, intervalMs, router]);

  return (
    <button
      type="button"
      onClick={() => {
        const next = !enabled;
        setEnabled(next);
        try {
          localStorage.setItem(KEY, next ? "1" : "0");
        } catch {}
      }}
      className={cn(
        "group inline-flex h-7 items-center gap-2 border px-2.5 text-[10px] font-semibold tracking-widest uppercase transition-colors",
        enabled ? "border-primary/60 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
      )}
      title={enabled ? "Live updates on. Click to pause." : "Live updates paused. Click to resume."}
    >
      <span className="relative inline-flex size-2">
        <span
          className={cn(
            "absolute inset-0 rounded-full",
            enabled ? "bg-primary text-primary live-ping" : "bg-muted-foreground/50",
            pulse && "scale-125",
          )}
        />
        <span className={cn("relative inline-flex size-2 rounded-full", enabled ? "bg-primary" : "bg-muted-foreground/50")} />
      </span>
      {enabled ? "Live" : "Paused"}
    </button>
  );
}
