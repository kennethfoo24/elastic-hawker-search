"use client";

import type { TierMeta } from "@/lib/tiers";
import type { SemModel, TierResult } from "@/lib/types";
import { ResultCard } from "./ResultCard";

export function TierColumn({
  meta,
  result,
  loading,
  model,
  hoverId,
  onHover,
}: {
  meta: TierMeta;
  result: TierResult | null;
  loading: boolean;
  model: SemModel;
  hoverId: string | null;
  onHover: (id: string | null) => void;
}) {
  return (
    <section
      aria-label={`${meta.name} results`}
      className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-kopi"
      style={{ "--tier-color": meta.cssColor } as React.CSSProperties}
    >
      {/* signboard header */}
      <div className={`h-1.5 ${meta.barClass}`} />
      <header className="border-b border-line px-3 pb-2.5 pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className={`font-display text-lg uppercase tracking-wide ${meta.textClass}`}>{meta.name}</h2>
          {result && !result.error && (
            <span className="font-mono text-[10px] text-muted">{result.tookMs}ms</span>
          )}
        </div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted">{meta.tech(model)}</p>
        <p className="mt-1 text-xs leading-snug text-muted">{meta.how(model)}</p>
      </header>

      <div className="flex-1 p-2">
        {loading ? (
          <ul className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="skeleton h-20 rounded-lg bg-surface" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </ul>
        ) : result?.error ? (
          <div className="m-1 rounded-lg border border-rrf/40 bg-rrf/10 p-3 text-xs leading-relaxed">
            <p className="font-mono text-[10px] uppercase tracking-widest text-rrf">Elasticsearch error</p>
            <p className="mt-1 break-words text-ink/85">{result.error}</p>
          </div>
        ) : result ? (
          result.hits.length === 0 ? (
            <p className="p-3 text-sm text-muted">
              No hits — this strategy found nothing it could match for this query.
            </p>
          ) : (
            <ul className="space-y-2">
              {result.hits.map((hit) => (
                <ResultCard
                  key={hit.id}
                  hit={hit}
                  tier={meta.key}
                  hovered={hoverId === hit.id}
                  dimmed={hoverId !== null && hoverId !== hit.id}
                  onHover={onHover}
                />
              ))}
            </ul>
          )
        ) : (
          <p className="p-3 text-sm text-muted/70">Awaiting a search.</p>
        )}
      </div>
    </section>
  );
}
