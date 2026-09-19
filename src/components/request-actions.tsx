"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { StarIcon, Delete02Icon, SentIcon } from "@hugeicons/core-free-icons";
import { deleteRequestAction, replayAction, toggleStarAction } from "@/app/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WebhookRequest } from "@/lib/types";

export function RequestActions({ request, defaultTarget, curl }: { request: WebhookRequest; defaultTarget: string | null; curl: string }) {
  const [pending, start] = useTransition();
  const [starred, setStarred] = useState(request.starred);
  const [replayOpen, setReplayOpen] = useState(false);
  const [target, setTarget] = useState(defaultTarget ?? "");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        aria-pressed={starred}
        onClick={() => {
          const next = !starred;
          setStarred(next);
          start(() => toggleStarAction(request.id, next));
        }}
      >
        <HugeiconsIcon icon={StarIcon} strokeWidth={2} data-icon="inline-start" className={starred ? "text-amber-500" : undefined} fill={starred ? "currentColor" : "none"} />
        {starred ? "Starred" : "Star"}
      </Button>

      <Button type="button" variant="default" size="sm" onClick={() => setReplayOpen(true)}>
        <HugeiconsIcon icon={SentIcon} strokeWidth={2} data-icon="inline-start" />
        Replay
      </Button>
      <Dialog open={replayOpen} onOpenChange={setReplayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replay this request</DialogTitle>
            <DialogDescription>
              Re-send the exact method, headers and body to a target URL. The sub-path and query string are appended. The result is recorded under Deliveries.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="replay-target">Target URL</Label>
            <Input id="replay-target" type="url" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="https://localhost.example/webhooks" className="font-mono" autoFocus />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReplayOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || !target}
              onClick={() =>
                start(async () => {
                  const res = await replayAction(request.id, target);
                  setReplayOpen(false);
                  if (res.ok) toast.success(res.message ?? "Replayed");
                  else toast.error(res.error ?? "Replay failed");
                })
              }
            >
              {pending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CopyButton value={curl} label="Copy as curl" size="sm" variant="outline" />

      <ConfirmButton
        label={
          <>
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} data-icon="inline-start" />
            Delete
          </>
        }
        title="Delete this request?"
        description="This removes the request and its delivery history permanently."
        confirmLabel="Delete"
        disabled={pending}
        onConfirm={() => start(() => deleteRequestAction(request.id, `/e/${request.endpoint_slug}`))}
      />
    </div>
  );
}
