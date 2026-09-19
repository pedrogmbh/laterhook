import { LabelSkeleton, TabsSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function RequestLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading request">
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-36" />
      </div>
      <header className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-14" />
            <Skeleton className="h-7 w-64 max-w-full" />
          </div>
          <Skeleton className="h-3.5 w-80 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-8" />
        </div>
      </header>
      <Skeleton className="h-9 w-full" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
          <TabsSkeleton tabs={5} />
          <div className="space-y-2 border p-4">
            {["w-1/3", "w-1/2", "w-2/5", "w-3/4", "w-1/2", "w-2/3", "w-1/4", "w-3/5", "w-1/3"].map((w, i) => (
              <Skeleton key={i} className={`h-3.5 ${w}`} style={{ marginLeft: `${(i === 0 || i === 8 ? 0 : 1) * 1.25}rem` }} />
            ))}
          </div>
        </div>
        <aside className="space-y-6">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-3">
              <LabelSkeleton className="w-16" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
