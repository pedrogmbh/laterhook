import { FiltersSkeleton, PageHeaderSkeleton, RequestListSkeleton, TabsSkeleton } from "@/components/skeletons";

export default function RouteLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading route">
      <PageHeaderSkeleton />
      <TabsSkeleton />
      <FiltersSkeleton />
      <RequestListSkeleton rows={8} />
    </div>
  );
}
