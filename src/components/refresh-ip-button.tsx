"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon } from "@hugeicons/core-free-icons";
import { refreshIpInfoAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function RefreshIpButton({ requestId }: { requestId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label="Refresh IP lookup"
      title="Refresh IP lookup"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await refreshIpInfoAction(requestId);
          if (res.ok) toast.success(res.message ?? "Updated");
          else toast.error(res.error ?? "Lookup failed");
        })
      }
    >
      <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} className={pending ? "animate-spin" : undefined} />
    </Button>
  );
}
