export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDuration(ms: number | null): string {
  if (ms == null) return "–";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function shortContentType(ct: string | null): string {
  if (!ct) return "no body";
  const base = ct.split(";")[0].trim().toLowerCase();
  const map: Record<string, string> = {
    "application/json": "json",
    "application/x-www-form-urlencoded": "form",
    "multipart/form-data": "multipart",
    "text/plain": "text",
    "text/html": "html",
    "application/xml": "xml",
    "text/xml": "xml",
    "application/octet-stream": "binary",
  };
  return map[base] ?? base.replace(/^application\//, "");
}

export function statusTone(status: number | null): "ok" | "warn" | "bad" | "none" {
  if (status == null) return "none";
  if (status < 300) return "ok";
  if (status < 500) return "warn";
  return "bad";
}

/** Build a copy-pasteable curl for a stored request. */
export function toCurl(opts: {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
  bodyEncoding: "utf8" | "base64" | "none";
}): string {
  const parts = [`curl -X ${opts.method} ${shellQuote(opts.url)}`];
  const skip = new Set(["host", "content-length", "connection", "accept-encoding"]);
  for (const [k, v] of Object.entries(opts.headers)) {
    if (skip.has(k.toLowerCase()) || k.toLowerCase().startsWith("x-vercel") || k.toLowerCase().startsWith("x-forwarded")) continue;
    parts.push(`  -H ${shellQuote(`${k}: ${v}`)}`);
  }
  if (opts.body && opts.bodyEncoding === "utf8") parts.push(`  --data-raw ${shellQuote(opts.body)}`);
  else if (opts.body && opts.bodyEncoding === "base64") parts.push(`  --data-binary @<(echo ${shellQuote(opts.body)} | base64 -d)`);
  return parts.join(" \\\n");
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
