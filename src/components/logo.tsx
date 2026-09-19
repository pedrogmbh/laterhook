import { cn } from "@/lib/utils";

/** The laterhook mark: an L with a dot, matching icon.svg and the social images. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center bg-primary", className)} aria-hidden>
      <svg viewBox="0 0 64 64" className="size-full">
        <path d="M18 12h10v30h18v10H18z" fill="var(--primary-foreground)" />
        <circle cx="49" cy="17" r="5" fill="var(--primary-foreground)" />
      </svg>
    </span>
  );
}
