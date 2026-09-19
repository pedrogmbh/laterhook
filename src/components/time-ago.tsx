"use client";

import { useEffect, useState } from "react";
import { formatDateTime, relativeTime } from "@/lib/format";

/**
 * Relative time that ticks. The absolute tooltip is filled in after mount so
 * the server (UTC, its own locale) and the browser never disagree at hydration.
 */
export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => tick((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, []);
  return (
    <time dateTime={iso} title={mounted ? formatDateTime(iso) : iso} className={className} suppressHydrationWarning>
      {relativeTime(iso)}
    </time>
  );
}

/** Absolute timestamp in the viewer's locale and timezone; ISO until mounted. */
export function LocalTime({ iso, className }: { iso: string; className?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {mounted ? formatDateTime(iso) : iso.replace("T", " ").replace(/\.\d+Z$/, " UTC")}
    </time>
  );
}
