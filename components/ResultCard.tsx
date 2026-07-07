"use client";

import type { Hit, TierKey } from "@/lib/types";

function fmtScore(score: number | null, tier: TierKey): string {
  if (score == null) return "—";
  return tier === "rrf" ? score.toFixed(4) : score.toFixed(2);
}

const LEG_BADGE = {
  lexical: "bg-lexical/15 text-lexical",
  semantic: "bg-semantic/15 text-semantic",
} as const;

export function ResultCard({
  hit,
  tier,
  hovered,
  dimmed,
  onHover,
}: {
  hit: Hit;
  tier: TierKey;
  hovered: boolean;
  dimmed: boolean;
  onHover: (id: string | null) => void;
}) {
  return (
    <li
      onMouseEnter={() => onHover(hit.id)}
      onMouseLeave={() => onHover(null)}
      className={`rounded-lg border p-3 transition-all duration-150 ${
        hovered ? "border-ink/50 bg-raised shadow-lg" : "border-line bg-surface"
      } ${dimmed ? "opacity-35" : ""}`}
    >
      <div className="flex items-baseline gap-2">
        <span className="w-6 shrink-0 font-mono text-sm font-medium text-muted">{hit.rank}</span>
        <span className="min-w-0 flex-1 truncate font-semibold text-ink">{hit.name}</span>
        <span className="shrink-0 font-mono text-xs text-muted">{fmtScore(hit.score, tier)}</span>
      </div>

      <p className="mt-0.5 pl-8 text-xs text-muted">
        {hit.stall.split(",")[0]} · {hit.region} · ${hit.price_sgd.toFixed(2)}
      </p>

      <p
        className="snippet mt-1.5 line-clamp-2 pl-8 text-[13px] leading-snug text-ink/75"
        dangerouslySetInnerHTML={{ __html: hit.snippet }}
      />

      {(hit.matchedLegs || hit.legRanks) && (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-8">
          {/* naive hybrid: which bool legs fired */}
          {hit.matchedLegs?.includes("lexical_leg") && (
            <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${LEG_BADGE.lexical}`}>LEX matched</span>
          )}
          {hit.matchedLegs?.includes("semantic_leg") && (
            <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${LEG_BADGE.semantic}`}>SEM matched</span>
          )}
          {/* rrf: constituent ranks in the standalone tiers */}
          {hit.legRanks && (
            <>
              <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${LEG_BADGE.lexical}`}>
                lex {hit.legRanks.lexical ? `#${hit.legRanks.lexical}` : "—"}
              </span>
              <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${LEG_BADGE.semantic}`}>
                sem {hit.legRanks.semantic ? `#${hit.legRanks.semantic}` : "—"}
              </span>
            </>
          )}
        </div>
      )}
    </li>
  );
}
