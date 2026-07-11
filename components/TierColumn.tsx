"use client";

import type { TierMeta } from "@/lib/tiers";
import type { TierResult } from "@/lib/types";
import { ResultCard } from "./ResultCard";
import { TierIcon } from "./Icons";

export function TierColumn({
  meta,
  result,
  loading,
  hoverId,
  onHover,
}: {
  meta: TierMeta;
  result: TierResult | null;
  loading: boolean;
  hoverId: string | null;
  onHover: (id: string | null) => void;
}) {
  return (
    <section
      aria-label={`${meta.name} results`}
      className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_32px_-24px_rgba(15,23,42,0.18)]"
    >
      <header className="flex items-start gap-3 px-4 py-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
          <TierIcon tier={meta.key} className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-[15px] font-semibold text-ink">{meta.name}</h2>
            {result && !result.error && (
              <span className="shrink-0 font-mono text-[10px] text-muted">{result.tookMs}ms</span>
            )}
          </div>
        </div>
      </header>

      <p className="border-y border-border bg-shell px-4 py-2 text-xs leading-snug text-muted">
        {meta.how}
      </p>

      <div className="flex-1 p-2.5">
        {loading ? (
          <ul className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="skeleton h-20 rounded-xl bg-sunken" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </ul>
        ) : result?.error ? (
          <div className="m-1 rounded-xl border border-destructive/30 bg-destructive-tint p-3 text-xs leading-relaxed">
            <p className="font-mono text-[10px] uppercase tracking-widest text-destructive">Elasticsearch error</p>
            <p className="mt-1 break-words text-ink/85">{result.error}</p>
          </div>
        ) : result ? (
          result.hits.length === 0 ? (
            <p className="p-3 text-sm text-muted">
              {meta.key === "keyword" ? "No keyword overlap." : "No matches."}
            </p>
          ) : (
            <ul className="space-y-2">
              {result.hits.slice(0, 5).map((hit) => (
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
