"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon, SparklesIcon } from "@hugeicons/core-free-icons";
import { retriageAction, triageBacklogAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function RetriageButton({ requestId }: { requestId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label="Run triage again"
      title="Run triage again"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await retriageAction(requestId);
          if (res.ok) toast.success(res.message ?? "Triaged");
          else toast.error(res.error ?? "Triage failed");
        })
      }
    >
      <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} className={pending ? "animate-spin" : undefined} />
    </Button>
  );
}

export function TriageBacklogButton({ count }: { count: number }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await triageBacklogAction();
          if (res.ok) toast.success(res.message ?? "Triaged");
          else toast.error(res.error ?? "Triage failed");
        })
      }
    >
      <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} data-icon="inline-start" className={pending ? "animate-pulse" : undefined} />
      {pending ? "Triaging…" : `Triage ${count > 100 ? "latest 100" : count}`}
    </Button>
  );
}
