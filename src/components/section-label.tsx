import { cn } from "@/lib/utils";

export function SectionLabel({ children, className, right }: { children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <span className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">{children}</span>
      {right}
    </div>
  );
}
