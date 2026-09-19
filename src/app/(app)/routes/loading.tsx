import { PageHeaderSkeleton, RouteListSkeleton } from "@/components/skeletons";

export default function RoutesLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading routes">
      <PageHeaderSkeleton actions={2} />
      <RouteListSkeleton />
    </div>
  );
}
