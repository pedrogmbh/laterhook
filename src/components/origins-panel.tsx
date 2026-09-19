import { SectionLabel } from "@/components/section-label";
import { flagEmoji } from "@/lib/ipinfo";

export function OriginsPanel({ origins, total }: { origins: { countryCode: string; country: string; count: number; cities: string[] }[]; total: number }) {
  return (
    <div className="border p-4">
      <SectionLabel className="mb-3" right={<span className="font-mono text-[10px] text-muted-foreground">by sender IP</span>}>
        Origins, last 24h
      </SectionLabel>
      {origins.length === 0 ? (
        <p className="py-4 text-xs text-muted-foreground">No traffic yet.</p>
      ) : (
        <ul className="space-y-2">
          {origins.map((o) => {
            const pct = Math.round((o.count / Math.max(1, total)) * 100);
            const local = o.countryCode === "LOCAL" || o.countryCode === "??";
            return (
              <li key={o.countryCode} className="flex items-center gap-3 text-xs">
                <span className="w-6 text-center text-base leading-none" aria-hidden>
                  {local ? "·" : flagEmoji(o.countryCode)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{o.country}</span>
                    <span className="shrink-0 font-mono text-muted-foreground tabular">
                      {o.count} · {pct}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 bg-muted">
                    <div className="h-full bg-foreground/70" style={{ width: `${pct}%` }} />
                  </div>
                  {o.cities.length > 0 && <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{o.cities.join(" · ")}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
