"use client";

import { useTransition } from "react";
import { markAllReadAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function MarkAllReadButton({ endpointId, count }: { endpointId?: string; count: number }) {
  const [pending, start] = useTransition();
  if (count === 0) return null;
  return (
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => start(() => markAllReadAction(endpointId))}>
      Mark {count} read
    </Button>
  );
}
