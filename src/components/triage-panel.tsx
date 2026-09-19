import Link from "next/link";
import { SectionLabel } from "@/components/section-label";
import { RetriageButton } from "@/components/triage-buttons";
import { ATTENTION_TIERS, attentionTier, choiceProbability, FLAG_MIN, isRateLimited, sourceLabel, TRIAGE_KINDS } from "@/lib/triage-meta";
import type { RequestInsight } from "@/lib/types";
import { cn } from "@/lib/utils";

const hue = (h: number) => ({ "--h": h }) as React.CSSProperties;
const pct = (p: number | null | undefined) => (p == null ? "–" : `${Math.round(p * 100)}%`);

export function Chip({ h, children, className, title }: { h: number; children: React.ReactNode; className?: string; title?: string }) {
  return (
    <span style={hue(h)} title={title} className={cn("hue-chip inline-flex h-5 shrink-0 items-center border px-1.5 text-[10px] font-semibold tracking-widest uppercase", className)}>
      {children}
    </span>
  );
}

/**
 * AI triage for one request: sender, kind, attention and risk flags, with the
 * probabilities Jev returned. Three states like the origin panel: off, failed,
 * and a full card.
 */
export function TriagePanel({ insight, enabled, requestId }: { insight: RequestInsight | null; enabled: boolean; requestId: string }) {
  return (
    <div className="space-y-3">
      <SectionLabel right={enabled ? <RetriageButton requestId={requestId} /> : undefined}>Triage</SectionLabel>
      {!enabled && !insight ? (
        <div className="space-y-1 border border-dashed p-3 text-xs text-muted-foreground">
          <p>
            Set <span className="font-mono">AI_GATEWAY_API_KEY</span> and <span className="font-mono">TYPESAFE_AI_ENABLED=true</span> to have TypeSafe Jev identify the sender, spot failures and flag scanner noise on every
            request.
          </p>
        </div>
      ) : !insight || insight.status !== "ok" ? (
        <div className="space-y-1 border p-3 text-xs">
          {isRateLimited(insight) ? (
            <>
              <p className="font-semibold">Rate-limited by AI Gateway.</p>
              <p className="text-muted-foreground">It will be retried when you open this request again in a few minutes, or run it now with ↻. Paid Gateway credits lift the limit.</p>
            </>
          ) : (
            <>
              <p className="font-semibold">Couldn’t triage this request.</p>
              <p className="break-words text-muted-foreground">{insight?.error ?? "Not triaged yet."}</p>
            </>
          )}
        </div>
      ) : (
        <InsightCard insight={insight} />
      )}
    </div>
  );
}

function InsightCard({ insight }: { insight: RequestInsight }) {
  const tier = attentionTier(insight.attention);
  const kind = insight.kind ? TRIAGE_KINDS[insight.kind] : null;
  const sourceP = choiceProbability(insight, "source");
  const kindP = choiceProbability(insight, "kind");
  const levels = insight.probabilities.attention ?? {};
  const unsure = (id: string) => insight.confidence[id] != null && insight.confidence[id] < 0.5;

  return (
    <div className="border">
      <div className="space-y-2 border-b p-3">
        <div className="flex items-baseline justify-between gap-3">
          {insight.source ? (
            <Link href={`/inbox?source=${insight.source}`} className="truncate text-sm font-semibold hover:underline" title="All requests from this sender">
              {sourceLabel(insight.source)}
            </Link>
          ) : (
            <span className="text-sm font-semibold">Unknown sender</span>
          )}
          <span className={cn("shrink-0 font-mono text-[10px] text-muted-foreground tabular", unsure("source") && "text-amber-600 dark:text-amber-400")} title="Probability of this sender">
            {pct(sourceP)}
            {unsure("source") && " · unsure"}
          </span>
        </div>
        {insight.event && <p className="truncate font-mono text-[11px] text-muted-foreground" title="Event name read from the request">{insight.event}</p>}
        <div className="flex flex-wrap items-center gap-1.5">
          {kind && (
            <Chip h={kind.hue} title={`${kind.description} (${pct(kindP)})`}>
              {kind.label}
            </Chip>
          )}
          {/* Same rule as the inbox filter: probes are noise, never "needs action". */}
          {tier && insight.kind !== "probe" && <Chip h={ATTENTION_TIERS[tier].hue}>{ATTENTION_TIERS[tier].label}</Chip>}
        </div>
      </div>

      {insight.attention != null && (
        <div className="space-y-1.5 border-b p-3">
          <div className="flex items-baseline justify-between text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            <span>Attention</span>
            <span className="font-mono tabular">{insight.attention.toFixed(2)} / 2</span>
          </div>
          {/* One row per level, each bar filled by its probability. */}
          <ul className="space-y-1">
            {(["routine", "notable", "action"] as const).map((t, i) => (
              <li key={t} className="grid grid-cols-[5.5rem_1fr_2.25rem] items-center gap-2 text-[10px] text-muted-foreground">
                <span className="truncate">{ATTENTION_TIERS[t].label}</span>
                <div className="h-1.5 bg-muted">
                  <div style={{ ...hue(ATTENTION_TIERS[t].hue), width: `${Math.round((levels[String(i)] ?? 0) * 100)}%` }} className="hue-bar h-full" />
                </div>
                <span className="text-right font-mono tabular">{pct(levels[String(i)])}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <dl className="divide-y text-xs">
        <Signal label="Reports a failure" p={insight.failure} h={15} />
        <Signal label="Personal data or secrets" p={insight.sensitive} h={295} />
      </dl>

      <p className="border-t px-3 py-2 font-mono text-[10px] text-muted-foreground">
        {insight.model ?? "jev"}
        {insight.duration_ms != null && ` · ${insight.duration_ms}ms`}
        {insight.input_tokens != null && ` · ${insight.input_tokens} tok`}
      </p>
    </div>
  );
}

function Signal({ label, p, h }: { label: string; p: number | null; h: number }) {
  const on = p != null && p >= FLAG_MIN;
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{on ? <Chip h={h}>yes · {pct(p)}</Chip> : <span className="font-mono text-[10px] text-muted-foreground tabular">no · {pct(p == null ? null : 1 - p)}</span>}</dd>
    </div>
  );
}
