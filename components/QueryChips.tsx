"use client";

import { SUGGESTED_QUERIES, type SuggestedQuery } from "@/lib/suggested-queries";

export function QueryChips({
  active,
  onPick,
}: {
  active: SuggestedQuery | null;
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
              className={`cursor-pointer rounded-full border px-4 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                isActive
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-surface text-muted hover:border-primary/40 hover:text-ink"
              }`}
            >
              {sq.label}
            </button>
          );
        })}
      </div>

      {active && (
        <div className="rounded-2xl border border-primary/25 bg-primary-tint px-4 py-3 text-sm leading-relaxed text-ink/90">
          <span className="mr-2 font-mono text-[10px] uppercase tracking-widest text-primary-dark">What to watch</span>
          {active.observe}
        </div>
      )}
    </div>
  );
}
