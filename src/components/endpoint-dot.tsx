import { COLOR_OKLCH, type EndpointColor } from "@/lib/palette";
import { cn } from "@/lib/utils";

export function hueStyle(color: EndpointColor): React.CSSProperties {
  return { "--h": COLOR_OKLCH[color].hue } as React.CSSProperties;
}

export function EndpointDot({ color, className, size = "md" }: { color: EndpointColor; className?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      style={hueStyle(color)}
      className={cn(
        "hue-dot inline-block shrink-0 rounded-full",
        size === "sm" && "size-1.5",
        size === "md" && "size-2",
        size === "lg" && "size-3",
        className,
      )}
    />
  );
}
