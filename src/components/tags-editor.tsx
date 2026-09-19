"use client";

import { useState, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { setTagsAction } from "@/app/actions";
import { Input } from "@/components/ui/input";

export function TagsEditor({ requestId, initial, suggestions }: { requestId: string; initial: string[]; suggestions: string[] }) {
  const [tags, setTags] = useState(initial);
  const [draft, setDraft] = useState("");
  const [, start] = useTransition();

  const commit = (next: string[]) => {
    setTags(next);
    start(() => setTagsAction(requestId, next));
  };
  const add = (raw: string) => {
    const t = raw.trim().toLowerCase();
    if (!t || tags.includes(t)) return;
    commit([...tags, t]);
    setDraft("");
  };
  const unused = suggestions.filter((s) => !tags.includes(s)).slice(0, 8);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 border bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
            {t}
            <button type="button" aria-label={`Remove ${t}`} className="text-muted-foreground hover:text-foreground" onClick={() => commit(tags.filter((x) => x !== t))}>
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2.5} className="size-2.5" />
            </button>
          </span>
        ))}
        {tags.length === 0 && <span className="text-xs text-muted-foreground">No tags</span>}
      </div>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && tags.length) {
            commit(tags.slice(0, -1));
          }
        }}
        onBlur={() => draft && add(draft)}
        placeholder="Add tag, press Enter"
        className="h-8 text-xs"
      />
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {unused.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="border border-dashed px-1.5 py-0.5 text-[10px] tracking-wider text-muted-foreground uppercase hover:border-foreground hover:text-foreground">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
