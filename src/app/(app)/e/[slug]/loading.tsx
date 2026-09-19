import { FiltersSkeleton, PageHeaderSkeleton, RequestListSkeleton, TabsSkeleton } from "@/components/skeletons";

export default function EndpointLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading endpoint">
      <PageHeaderSkeleton actions={2} />
      <TabsSkeleton />
      <FiltersSkeleton />
      <RequestListSkeleton rows={10} />
    </div>
  );
}
