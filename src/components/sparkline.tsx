import { cn } from "@/lib/utils";

/** Tiny bar chart. `hue` optional; defaults to the primary brand colour. */
export function Sparkline({
  data,
  className,
  hue,
  height = 28,
}: {
  data: number[];
  className?: string;
  hue?: number;
  height?: number;
}) {
  const max = Math.max(1, ...data);
  return (
    <div
      className={cn("flex items-end gap-px", className)}
      style={{ height, ...(hue != null ? ({ "--h": hue } as React.CSSProperties) : {}) }}
      aria-hidden
    >
      {data.map((v, i) => {
        const h = v === 0 ? 2 : Math.max(3, Math.round((v / max) * height));
        return (
          <span
            key={i}
            title={`${v}`}
            className={cn("flex-1 min-w-0.5 transition-all", hue != null ? "hue-bar" : "bg-primary", v === 0 && "opacity-25")}
            style={{ height: h }}
          />
        );
      })}
    </div>
  );
}
