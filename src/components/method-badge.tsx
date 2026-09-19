import { cn } from "@/lib/utils";
import { METHOD_HUE } from "@/lib/palette";

export function MethodBadge({ method, className }: { method: string; className?: string }) {
  const m = method.toUpperCase();
  const hue = METHOD_HUE[m] ?? 240;
  return (
    <span
      style={{ "--h": hue } as React.CSSProperties}
      className={cn(
        "hue-chip inline-flex h-5 min-w-14 items-center justify-center border px-1.5 font-mono text-[10px] font-bold tracking-widest",
        className,
      )}
    >
      {m}
    </span>
  );
}
