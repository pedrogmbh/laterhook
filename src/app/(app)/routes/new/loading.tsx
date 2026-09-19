import { FormSkeleton, PageHeaderSkeleton } from "@/components/skeletons";

export default function NewRouteLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading form">
      <PageHeaderSkeleton actions={0} />
      <FormSkeleton fields={6} />
    </div>
  );
}
