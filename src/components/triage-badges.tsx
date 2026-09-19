import { Chip } from "@/components/triage-panel";
import { ATTENTION_TIERS, confidentSource, FLAG_MIN, needsAction, sourceLabel, TRIAGE_KINDS } from "@/lib/triage-meta";
import type { RequestInsight } from "@/lib/types";

/**
 * Compact triage for request rows: the sender and event name, plus a chip
 * only when something deserves the eye (needs action, failure, noise, test).
 */
export function TriageBadges({ insight }: { insight: RequestInsight | undefined }) {
  if (!insight || insight.status !== "ok") return null;
  const source = confidentSource(insight);
  const action = needsAction(insight);
  const failed = insight.failure != null && insight.failure >= FLAG_MIN;
  const quiet = insight.kind === "probe" || insight.kind === "test" || insight.kind === "handshake";
  return (
    <>
      {action ? (
        <Chip h={ATTENTION_TIERS.action.hue} className="h-auto px-1 tracking-wider">
          action
        </Chip>
      ) : failed ? (
        <Chip h={15} className="h-auto px-1 tracking-wider">
          failed
        </Chip>
      ) : null}
      {quiet && insight.kind && (
        <Chip h={TRIAGE_KINDS[insight.kind].hue} className="h-auto px-1 tracking-wider">
          {TRIAGE_KINDS[insight.kind].label}
        </Chip>
      )}
      {(source || insight.event) && (
        <span className="hidden min-w-0 shrink truncate text-[11px] sm:inline" title="AI triage: sender · event">
          {source && <span className="font-semibold">{sourceLabel(source)}</span>}
          {source && insight.event && <span className="text-muted-foreground"> · </span>}
          {insight.event && <span className="font-mono text-muted-foreground">{insight.event}</span>}
        </span>
      )}
    </>
  );
}
