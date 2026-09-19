"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createRouteAction, updateRouteAction, type ActionState } from "@/app/actions";
import { MethodBadge } from "@/components/method-badge";
import { SectionLabel } from "@/components/section-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { METHODS } from "@/lib/palette";
import { expandTarget, hasPlaceholders, headerLines, validatePattern } from "@/lib/route-match";
import type { Route } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface RouteDraft {
  name?: string;
  description?: string;
  pattern?: string;
  case_insensitive?: boolean;
  methods?: string[];
  forward_url?: string;
  samplePath?: string;
}

export function RouteForm({ route, draft }: { route?: Route; draft?: RouteDraft }) {
  const isEdit = Boolean(route);
  const [state, action, pending] = useActionState<ActionState, FormData>(isEdit ? updateRouteAction : createRouteAction, { ok: true });
  const [pattern, setPattern] = useState(route?.pattern ?? draft?.pattern ?? "");
  const [ci, setCi] = useState(route?.case_insensitive ?? draft?.case_insensitive ?? false);
  const [methods, setMethods] = useState<string[]>(route?.methods ?? draft?.methods ?? []);
  const [enabled, setEnabled] = useState(route?.enabled ?? true);
  const [forwardUrl, setForwardUrl] = useState(route?.forward_url ?? draft?.forward_url ?? "");
  const [sample, setSample] = useState(draft?.samplePath ?? "");

  useEffect(() => {
    if (state.message) toast.success(state.message);
    if (state.error) toast.error(state.error);
  }, [state]);

  const patternError = validatePattern(pattern, ci);
  const test = useMemo(() => {
    if (patternError || !sample) return null;
    try {
      const m = new RegExp(pattern, ci ? "i" : "").exec(sample);
      if (!m) return { ok: false as const };
      return { ok: true as const, groups: m.slice(1), named: m.groups ?? {}, target: forwardUrl ? expandTarget(forwardUrl, m) : null };
    } catch {
      return null;
    }
  }, [pattern, ci, sample, forwardUrl, patternError]);

  return (
    <form action={action} className="grid gap-8 lg:grid-cols-2">
      {route && <input type="hidden" name="id" value={route.id} />}
      <input type="hidden" name="enabled" value={enabled ? "on" : "off"} />
      {methods.map((m) => (
        <input key={m} type="hidden" name="methods" value={m} />
      ))}

      <section className="space-y-5">
        <SectionLabel>Match</SectionLabel>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={route?.name ?? draft?.name ?? ""} placeholder="Stripe → Product X" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pattern">Path pattern (regular expression)</Label>
          <Input id="pattern" name="pattern" value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="^my-product/stripe(?:/(.*))?$" className="font-mono" spellCheck={false} aria-invalid={Boolean(patternError && pattern)} />
          <p className={cn("text-[11px]", patternError && pattern ? "text-destructive" : "text-muted-foreground")}>
            {patternError && pattern ? patternError : (
              <>
                Tested against the path after <span className="font-mono">/webhooks/</span>, e.g. <span className="font-mono">my-product/stripe/live</span>. Capture groups can be reused in the forward URL.
              </>
            )}
          </p>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <Switch name="case_insensitive" checked={ci} onCheckedChange={setCi} />
          <span>Case-insensitive</span>
        </label>
        <div className="space-y-2">
          <Label>Methods</Label>
          <div className="flex flex-wrap gap-1.5">
            {METHODS.map((m) => {
              const on = methods.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setMethods(on ? methods.filter((x) => x !== m) : [...methods, m])}
                  className={cn("border p-0.5 transition-opacity", on ? "border-foreground" : "border-transparent opacity-40 hover:opacity-80")}
                >
                  <MethodBadge method={m} />
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">{methods.length ? `Only ${methods.join(", ")}.` : "Any method."}</p>
        </div>
        <div className="grid grid-cols-[8rem_1fr] gap-3">
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Input id="priority" name="priority" type="number" defaultValue={route?.priority ?? 100} className="font-mono" />
          </div>
          <p className="self-end pb-2 text-[11px] text-muted-foreground">Lower runs first. The first enabled route that matches wins.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={2} defaultValue={route?.description ?? draft?.description ?? ""} placeholder="What this route is for" />
        </div>

        {/* Live tester */}
        <div className="space-y-2 border p-3">
          <Label htmlFor="sample" className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Try a path</Label>
          <Input id="sample" value={sample} onChange={(e) => setSample(e.target.value)} placeholder="my-product/stripe/live" className="h-8 font-mono text-xs" spellCheck={false} />
          {test && (
            <div className="text-[11px]">
              {test.ok ? (
                <div className="space-y-1">
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">Matches</p>
                  {test.groups.length > 0 && (
                    <p className="font-mono text-muted-foreground">
                      {test.groups.map((g, i) => (
                        <span key={i} className="mr-2">
                          ${i + 1}=<span className="text-foreground">{g ?? "∅"}</span>
                        </span>
                      ))}
                    </p>
                  )}
                  {test.target && (
                    <p className="font-mono break-all text-muted-foreground">
                      → <span className="text-foreground">{test.target}</span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="font-semibold text-destructive">No match</p>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-8">
        <div className="space-y-4">
          <SectionLabel>Forward</SectionLabel>
          <p className="text-xs text-muted-foreground">Every matching request is re-sent from this server with the same method, headers and body. Leave empty to only record.</p>
          <div className="space-y-2">
            <Label htmlFor="forward_url">Destination URL</Label>
            <Input id="forward_url" name="forward_url" value={forwardUrl} onChange={(e) => setForwardUrl(e.target.value)} placeholder="https://api.myproduct.com/webhooks/stripe/$1" className="font-mono" spellCheck={false} />
            <p className="text-[11px] text-muted-foreground">
              {hasPlaceholders(forwardUrl) ? "Placeholders are filled from the pattern's capture groups." : "Use $1, $2 or $<name> to insert capture groups. The original query string is merged in."}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="forward_headers">Extra headers</Label>
            <Textarea id="forward_headers" name="forward_headers" rows={3} defaultValue={route ? headerLines(route.forward_headers) : ""} placeholder={"X-Internal-Token: s3cr3t\nX-Source: laterhook"} className="font-mono text-xs" spellCheck={false} />
            <p className="text-[11px] text-muted-foreground">One per line, added on top of the original headers.</p>
          </div>
        </div>

        <div className="space-y-4">
          <SectionLabel>Require a header secret</SectionLabel>
          <p className="text-xs text-muted-foreground">Requests missing this header, or with a different value, are stored as rejected, answered with 401, and never forwarded.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="require_header_name">Header</Label>
              <Input id="require_header_name" name="require_header_name" defaultValue={route?.require_header_name ?? ""} placeholder="X-Webhook-Secret" className="font-mono" spellCheck={false} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="require_header_value">Expected value</Label>
              <Input id="require_header_value" name="require_header_value" defaultValue={route?.require_header_value ?? ""} placeholder="whsec_…" className="font-mono" spellCheck={false} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <SectionLabel>Response &amp; tags</SectionLabel>
          <div className="grid grid-cols-[8rem_1fr] gap-3">
            <div className="space-y-2">
              <Label htmlFor="response_status">Status</Label>
              <Input id="response_status" name="response_status" type="number" min={200} max={599} defaultValue={route?.response_status ?? ""} placeholder="inherit" className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="response_content_type">Content-Type</Label>
              <Input id="response_content_type" name="response_content_type" defaultValue={route?.response_content_type ?? ""} placeholder="application/json" className="font-mono" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="response_body">Body</Label>
            <Textarea id="response_body" name="response_body" rows={3} defaultValue={route?.response_body ?? ""} placeholder='{"received": true}' className="font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auto_tags">Auto-tags</Label>
            <Input id="auto_tags" name="auto_tags" defaultValue={route?.auto_tags.join(", ") ?? ""} placeholder="billing, stripe" />
            <p className="text-[11px] text-muted-foreground">Comma separated. Applied to every matching request.</p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-5 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <span>{enabled ? "Enabled" : "Disabled"}</span>
          </label>
          {!isEdit && (
            <label className="flex items-center gap-3 text-sm">
              <Switch name="backfill" defaultChecked />
              <span>Link existing matching requests</span>
            </label>
          )}
        </div>
        <Button type="submit" disabled={pending || Boolean(patternError)}>
          {pending ? "Saving…" : isEdit ? "Save route" : "Create route"}
        </Button>
      </div>
    </form>
  );
}
