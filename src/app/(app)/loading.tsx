import { LabelSkeleton, PageHeaderSkeleton, RequestListSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function OverviewLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading overview">
      <PageHeaderSkeleton />
      <section className="grid grid-cols-2 gap-px border bg-border md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-2 bg-background p-4 sm:p-5">
            <LabelSkeleton className="w-20" />
            <Skeleton className="h-9 w-16 sm:h-10" />
          </div>
        ))}
      </section>
      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3 border p-4">
          <LabelSkeleton />
          <Skeleton className="h-[72px] w-full" />
        </div>
        <div className="space-y-3 border p-4">
          <LabelSkeleton />
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-1.5 flex-1" />
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <LabelSkeleton />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col gap-4 border border-t-2 bg-card p-4">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <LabelSkeleton />
        <RequestListSkeleton rows={6} />
      </section>
    </div>
  );
}
