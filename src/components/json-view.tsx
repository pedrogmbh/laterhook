import { cn } from "@/lib/utils";

/**
 * Server-renderable syntax highlighter for pretty-printed JSON. Works on the
 * string form so we never lose key order or big-int precision in display.
 */
export function highlightJson(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false)\b|\b(null)\b|([{}\[\],:])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      if (m[2] !== undefined) {
        out.push(<span key={i++} className="tok-key">{m[1]}</span>, <span key={i++} className="tok-punc">{m[2]}</span>);
      } else {
        out.push(<span key={i++} className="tok-str">{m[1]}</span>);
      }
    } else if (m[3] !== undefined) out.push(<span key={i++} className="tok-num">{m[3]}</span>);
    else if (m[4] !== undefined) out.push(<span key={i++} className="tok-bool">{m[4]}</span>);
    else if (m[5] !== undefined) out.push(<span key={i++} className="tok-null">{m[5]}</span>);
    else if (m[6] !== undefined) out.push(<span key={i++} className="tok-punc">{m[6]}</span>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function tryPrettyJson(raw: string): string | null {
  const t = raw.trim();
  if (!t || (t[0] !== "{" && t[0] !== "[" && t[0] !== '"')) return null;
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return null;
  }
}

export function CodePre({ children, className, lineNumbers = false }: { children: React.ReactNode; className?: string; lineNumbers?: boolean }) {
  return (
    <pre
      className={cn(
        "code-surface overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre",
        lineNumbers && "[counter-reset:line]",
        className,
      )}
    >
      {children}
    </pre>
  );
}

export function JsonView({ text, className }: { text: string; className?: string }) {
  const pretty = tryPrettyJson(text);
  if (pretty == null) return <CodePre className={className}>{text}</CodePre>;
  // Skip highlighting for very large payloads to keep the page snappy.
  if (pretty.length > 200_000) return <CodePre className={className}>{pretty}</CodePre>;
  return <CodePre className={className}>{highlightJson(pretty)}</CodePre>;
}
