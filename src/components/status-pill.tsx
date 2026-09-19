import { cn } from "@/lib/utils";
import { statusTone } from "@/lib/format";

const HUE = { ok: 145, warn: 75, bad: 15, none: 240 } as const;

export function StatusPill({ status, error, className }: { status: number | null; error?: string | null; className?: string }) {
  const tone = error ? "bad" : statusTone(status);
  const label = status ?? (error ? "ERR" : "–");
  return (
    <span
      title={error ?? undefined}
      style={{ "--h": HUE[tone] } as React.CSSProperties}
      className={cn("hue-chip inline-flex h-5 items-center border px-1.5 font-mono text-[10px] font-bold tracking-widest", className)}
    >
      {label}
    </span>
  );
}
