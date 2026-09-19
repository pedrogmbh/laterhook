import { FiltersSkeleton, PageHeaderSkeleton, RequestListSkeleton } from "@/components/skeletons";

export default function InboxLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading inbox">
      <PageHeaderSkeleton />
      <FiltersSkeleton />
      <RequestListSkeleton rows={10} />
    </div>
  );
}
