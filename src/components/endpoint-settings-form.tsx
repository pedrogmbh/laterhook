"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { updateEndpointAction, type ActionState } from "@/app/actions";
import { hueStyle } from "@/components/endpoint-dot";
import { SectionLabel } from "@/components/section-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ENDPOINT_COLORS, type EndpointColor } from "@/lib/palette";
import type { Endpoint } from "@/lib/types";
import { cn } from "@/lib/utils";

export function EndpointSettingsForm({ endpoint }: { endpoint: Endpoint }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateEndpointAction, { ok: true });
  const [color, setColor] = useState<EndpointColor>(endpoint.color);
  const [forwardEnabled, setForwardEnabled] = useState(endpoint.forward_enabled);

  useEffect(() => {
    if (state.message) toast.success(state.message);
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="grid gap-8 lg:grid-cols-2">
      <input type="hidden" name="id" value={endpoint.id} />
      <input type="hidden" name="color" value={color} />

      <section className="space-y-5">
        <SectionLabel>Identity</SectionLabel>
        <div className="space-y-2">
          <Label htmlFor="name">Display name</Label>
          <Input id="name" name="name" defaultValue={endpoint.name ?? ""} placeholder={endpoint.slug} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={3} defaultValue={endpoint.description ?? ""} placeholder="What sends here? e.g. Stripe events for Product X" />
        </div>
        <div className="space-y-2">
          <Label>Colour</Label>
          <div className="flex flex-wrap gap-2">
            {ENDPOINT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                aria-pressed={c === color}
                onClick={() => setColor(c)}
                style={hueStyle(c)}
                className={cn(
                  "hue-dot size-6 rounded-full border-2 border-transparent transition-transform",
                  c === color ? "scale-110 border-foreground" : "opacity-70 hover:opacity-100",
                )}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <SectionLabel>Forwarding</SectionLabel>
        <p className="text-xs text-muted-foreground">
          When enabled, every new request is re-sent to the target URL right after it is stored. The sub-path and query string are appended to the target.
        </p>
        <div className="space-y-2">
          <Label htmlFor="forward_url">Target URL</Label>
          <Input id="forward_url" name="forward_url" type="url" inputMode="url" defaultValue={endpoint.forward_url ?? ""} placeholder="https://api.myproduct.com/webhooks/stripe" className="font-mono" />
        </div>
        <label className="flex items-center gap-3 text-sm">
          <Switch name="forward_enabled" checked={forwardEnabled} onCheckedChange={setForwardEnabled} />
          <span>Forward new requests automatically</span>
        </label>
      </section>

      <section className="space-y-5">
        <SectionLabel>Response</SectionLabel>
        <p className="text-xs text-muted-foreground">What the sender gets back. Leave the body empty for the default JSON acknowledgement.</p>
        <div className="grid grid-cols-[8rem_1fr] gap-3">
          <div className="space-y-2">
            <Label htmlFor="response_status">Status</Label>
            <Input id="response_status" name="response_status" type="number" min={200} max={599} defaultValue={endpoint.response_status} className="font-mono" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="response_content_type">Content-Type</Label>
            <Input id="response_content_type" name="response_content_type" defaultValue={endpoint.response_content_type ?? ""} placeholder="application/json" className="font-mono" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="response_body">Body</Label>
          <Textarea id="response_body" name="response_body" rows={4} defaultValue={endpoint.response_body ?? ""} placeholder='{"received": true}' className="font-mono text-xs" />
        </div>
      </section>

      <div className="flex items-end justify-end lg:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
