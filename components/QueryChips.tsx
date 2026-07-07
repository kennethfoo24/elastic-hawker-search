"use client";

import { SUGGESTED_QUERIES, type SuggestedQuery } from "@/lib/suggested-queries";
import type { SemModel } from "@/lib/types";
import { MODEL_LABEL } from "@/lib/tiers";

export function QueryChips({
  active,
  model,
  onPick,
}: {
  active: SuggestedQuery | null;
  model: SemModel;
  onPick: (q: SuggestedQuery) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_QUERIES.map((sq) => {
          const isActive = active?.query === sq.query;
          return (
            <button
              key={sq.query}
              onClick={() => onPick(sq)}
              className={`group rounded-lg border px-3 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-rrf ${
                isActive
                  ? "border-rrf/70 bg-rrf/15 text-ink"
                  : "border-line bg-surface text-muted hover:border-muted/60 hover:text-ink"
              }`}
            >
              <span className="block font-mono text-[9px] uppercase tracking-widest opacity-70">{sq.archetype}</span>
              <span className="block text-sm">{sq.label}</span>
            </button>
          );
        })}
      </div>

      {active && (
        <div className="rounded-r-lg border-l-4 border-rrf bg-surface px-4 py-3 text-sm leading-relaxed text-ink/90">
          <span className="mr-2 font-mono text-[10px] uppercase tracking-widest text-rrf">What to watch</span>
          {active.observe}
          {active.suggestedModel && active.suggestedModel !== model && (
            <span className="mt-1 block text-muted">
              Tip: run it here with {MODEL_LABEL[model]} first, then flip the toggle to {MODEL_LABEL[active.suggestedModel]}.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
