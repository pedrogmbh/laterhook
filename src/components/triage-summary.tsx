import Link from "next/link";
import { SectionLabel } from "@/components/section-label";
import { TriageBacklogButton } from "@/components/triage-buttons";
import { Chip } from "@/components/triage-panel";
import type { TriageSummary } from "@/lib/repo";
import { ATTENTION_TIERS, sourceLabel, TRIAGE_KINDS } from "@/lib/triage-meta";

/** Overview strip: what AI triage made of the last 24h of traffic. */
export function TriageSummaryPanel({ summary, untriaged }: { summary: TriageSummary; untriaged: number }) {
  const probes = summary.kinds.find((k) => k.kind === "probe")?.count ?? 0;
  const kindTotal = summary.kinds.reduce((n, k) => n + k.count, 0);
  return (
    <section className="border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <SectionLabel>Triage, last 24h</SectionLabel>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-muted-foreground">
            {summary.triaged}/{summary.requests} triaged · TypeSafe Jev
          </span>
          {untriaged > 0 && <TriageBacklogButton count={untriaged} />}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
        <Figure label="Needs action" value={summary.needsAction} href="/inbox?action=1" hue={summary.needsAction > 0 ? ATTENTION_TIERS.action.hue : undefined} />
        <Figure label="Report a failure" value={summary.failures} />
        <Figure label="Probes & bots" value={probes} href={probes > 0 ? "/inbox?hidenoise=1" : undefined} hint="hide" />
        <Figure label="Personal data" value={summary.sensitive} />
      </div>

      <div className="grid gap-6 border-t p-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">What arrived</p>
          {kindTotal === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing triaged yet.</p>
          ) : (
            <>
              <div className="flex h-2 gap-px bg-muted">
                {summary.kinds.map((k) => (
                  <div key={k.kind} style={{ "--h": TRIAGE_KINDS[k.kind].hue, width: `${(k.count / kindTotal) * 100}%` } as React.CSSProperties} className="hue-bar h-full" title={`${TRIAGE_KINDS[k.kind].label}: ${k.count}`} />
                ))}
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {summary.kinds.map((k) => (
                  <li key={k.kind} className="inline-flex items-center gap-1.5">
                    <span style={{ "--h": TRIAGE_KINDS[k.kind].hue } as React.CSSProperties} className="hue-dot inline-block size-1.5 rounded-full" />
                    {TRIAGE_KINDS[k.kind].label}
                    <span className="font-mono text-muted-foreground tabular">{k.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Senders</p>
          {summary.sources.length === 0 ? (
            <p className="text-xs text-muted-foreground">No senders identified yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {summary.sources.map((s) => (
                <li key={s.source}>
                  <Link href={`/inbox?source=${s.source}`} className="inline-flex h-6 items-center gap-1.5 border px-2 text-xs transition-colors hover:bg-muted/60">
                    <span className="font-semibold">{sourceLabel(s.source)}</span>
                    <span className="font-mono text-[10px] text-muted-foreground tabular">{s.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Figure({ label, value, href, hue, hint }: { label: string; value: number; href?: string; hue?: number; hint?: string }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        {label}
        {href && hint && <span className="tracking-widest opacity-60">{hint} →</span>}
      </div>
      <div className="mt-1 font-heading text-2xl font-semibold tabular">{hue != null ? <Chip h={hue} className="h-auto px-1.5 font-heading text-2xl tracking-normal">{value}</Chip> : value}</div>
    </>
  );
  return href ? (
    <Link href={href} className="bg-background p-4 transition-colors hover:bg-muted/40">
      {body}
    </Link>
  ) : (
    <div className="bg-background p-4">{body}</div>
  );
}
