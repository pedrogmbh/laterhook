import { CodePre, JsonView } from "@/components/json-view";
import { KvTable } from "@/components/kv-table";
import { formatBytes } from "@/lib/format";
import type { WebhookRequest } from "@/lib/types";

function parseForm(text: string): [string, string][] {
  try {
    return [...new URLSearchParams(text).entries()];
  } catch {
    return [];
  }
}

export function BodyView({ request, className }: { request: WebhookRequest; className?: string }) {
  const { body, body_encoding, content_type } = request;
  if (body == null || body_encoding === "none") {
    return <p className="px-4 py-10 text-center text-xs text-muted-foreground">No body</p>;
  }
  if (body_encoding === "base64") {
    return (
      <div className="space-y-3 p-4">
        <p className="text-xs text-muted-foreground">
          Binary payload ({formatBytes(request.size)}{request.body_truncated ? ", truncated" : ""}). Shown as base64.
        </p>
        <CodePre className="max-h-72 break-all whitespace-pre-wrap">{body.length > 4000 ? body.slice(0, 4000) + "…" : body}</CodePre>
      </div>
    );
  }
  const ct = (content_type ?? "").toLowerCase();
  if (ct.includes("x-www-form-urlencoded")) {
    const entries = parseForm(body);
    return (
      <div className={className}>
        <KvTable entries={entries} />
        <details className="border-t">
          <summary className="cursor-pointer px-4 py-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Raw</summary>
          <CodePre className="whitespace-pre-wrap">{body}</CodePre>
        </details>
      </div>
    );
  }
  // JSON (declared or sniffed) gets highlighting; everything else is shown raw.
  return (
    <div className={className}>
      <JsonView text={body} className="max-h-[70vh]" />
      {request.body_truncated && (
        <p className="border-t px-4 py-2 text-[11px] text-amber-600 dark:text-amber-400">
          Body was truncated at storage time. Original size {formatBytes(request.size)}.
        </p>
      )}
    </div>
  );
}
