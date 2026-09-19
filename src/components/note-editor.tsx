"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setNoteAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function NoteEditor({ requestId, initial }: { requestId: string; initial: string | null }) {
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [pending, start] = useTransition();
  const dirty = value !== saved;
  return (
    <div className="space-y-2">
      <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={4} placeholder="Why does this one matter? Anything to remember…" className="text-xs" />
      {dirty && (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="xs" onClick={() => setValue(saved)}>
            Discard
          </Button>
          <Button
            type="button"
            size="xs"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await setNoteAction(requestId, value);
                setSaved(value);
                toast.success("Note saved");
              })
            }
          >
            Save note
          </Button>
        </div>
      )}
    </div>
  );
}
