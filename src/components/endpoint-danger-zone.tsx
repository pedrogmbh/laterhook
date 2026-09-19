"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { clearEndpointAction, deleteEndpointAction, setEndpointArchivedAction } from "@/app/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { SectionLabel } from "@/components/section-label";
import type { Endpoint } from "@/lib/types";

export function EndpointDangerZone({ endpoint }: { endpoint: Endpoint }) {
  const [pending, start] = useTransition();
  return (
    <section className="space-y-4 border border-destructive/30 p-5">
      <SectionLabel>Danger zone</SectionLabel>
      <div className="flex flex-wrap gap-2">
        <ConfirmButton
          label="Clear requests"
          title={`Delete all ${endpoint.request_count} requests?`}
          description="The endpoint stays configured, but every captured request and delivery is permanently removed."
          confirmLabel="Clear"
          disabled={pending}
          onConfirm={() =>
            start(async () => {
              await clearEndpointAction(endpoint.id);
              toast.success("Requests cleared");
            })
          }
        />
        <ConfirmButton
          label={endpoint.archived ? "Unarchive" : "Archive"}
          title={endpoint.archived ? "Unarchive this endpoint?" : "Archive this endpoint?"}
          description="Archived endpoints keep receiving and storing requests; they are just hidden from the sidebar and overview."
          confirmLabel={endpoint.archived ? "Unarchive" : "Archive"}
          variant="outline"
          disabled={pending}
          onConfirm={() =>
            start(async () => {
              await setEndpointArchivedAction(endpoint.id, !endpoint.archived);
              toast.success(endpoint.archived ? "Endpoint unarchived" : "Endpoint archived");
            })
          }
        />
        <ConfirmButton
          label="Delete endpoint"
          title={`Delete /webhooks/${endpoint.slug}?`}
          description="Removes the endpoint, its settings and all of its requests. The URL will start capturing again as a brand-new endpoint if anything hits it."
          confirmLabel="Delete everything"
          disabled={pending}
          onConfirm={() => start(() => deleteEndpointAction(endpoint.id))}
        />
      </div>
    </section>
  );
}
