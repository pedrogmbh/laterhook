import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Building blocks for the route-level `loading.tsx` files. They mirror the
 * real page layout closely so the swap to content does not shift things.
 */

export function PageHeaderSkeleton({ eyebrow = true, description = true, actions = 1, className }: { eyebrow?: boolean; description?: boolean; actions?: number; className?: string }) {
  return (
    <header className={cn("flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-2">
        {eyebrow && <Skeleton className="h-2.5 w-20" />}
        <Skeleton className="h-8 w-56 sm:h-9" />
        {description && <Skeleton className="h-4 w-72 max-w-full" />}
      </div>
      {actions > 0 && (
        <div className="flex shrink-0 gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Skeleton key={i} className="h-8 w-28" />
          ))}
        </div>
      )}
    </header>
  );
}

export function LabelSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-2.5 w-24", className)} />;
}

export function FiltersSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Skeleton className="h-9 min-w-56 flex-1" />
      <Skeleton className="h-9 w-28" />
      <Skeleton className="h-9 w-44" />
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-8 w-24" />
    </div>
  );
}

export function TabsSkeleton({ tabs = 2 }: { tabs?: number }) {
  return (
    <div className="flex w-full gap-6 border-b pb-2.5">
      {Array.from({ length: tabs }, (_, i) => (
        <Skeleton key={i} className="h-4 w-20" />
      ))}
    </div>
  );
}

const PATH_WIDTHS = ["w-40", "w-56", "w-32", "w-48", "w-64", "w-36"];
const PREVIEW_WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-5/6", "w-3/5"];

/** Same grid as `RequestList` rows: method · path/preview · meta. */
export function RequestListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <ul className="divide-y border">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 border-l-2 border-l-transparent px-3 py-2.5 sm:px-4" style={{ opacity: 1 - i * (0.6 / rows) }}>
          <Skeleton className="h-5 w-12" />
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className={cn("h-3.5", PATH_WIDTHS[i % PATH_WIDTHS.length])} />
            </div>
            <Skeleton className={cn("h-3 max-w-full", PREVIEW_WIDTHS[i % PREVIEW_WIDTHS.length])} />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="hidden h-3 w-12 md:block" />
            <Skeleton className="h-3 w-14" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Rows shaped like the routes list. */
export function RouteListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="divide-y border">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3">
          <Skeleton className="h-4 w-7" />
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className={cn("h-3.5", PATH_WIDTHS[i % PATH_WIDTHS.length])} />
            </div>
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Label + input pairs, for settings/route forms. */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="max-w-3xl space-y-6">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <Skeleton className="h-8 w-28" />
    </div>
  );
}
