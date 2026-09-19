"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { backfillRouteAction, deleteRouteAction, setRouteEnabledAction } from "@/app/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { Route } from "@/lib/types";

export function RouteEnabledSwitch({ route, size = "default" }: { route: Route; size?: "sm" | "default" }) {
  const [on, setOn] = useState(route.enabled);
  const [pending, start] = useTransition();
  return (
    <Switch
      size={size}
      checked={on}
      disabled={pending}
      aria-label={on ? "Disable route" : "Enable route"}
      onCheckedChange={(v) => {
        setOn(v);
        start(() => setRouteEnabledAction(route.id, v));
      }}
    />
  );
}

export function RouteDangerZone({ route }: { route: Route }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await backfillRouteAction(route.id);
            if (res.ok) toast.success(res.message ?? "Done");
            else toast.error(res.error ?? "Failed");
          })
        }
      >
        Link existing matches
      </Button>
      <ConfirmButton
        label="Delete route"
        title={`Delete route “${route.name}”?`}
        description="Requests it matched are kept and become unrouted again. Nothing will be forwarded by this route anymore."
        confirmLabel="Delete"
        disabled={pending}
        onConfirm={() => start(() => deleteRouteAction(route.id))}
      />
    </div>
  );
}
