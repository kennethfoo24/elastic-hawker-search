"use client";

import type { SemModel } from "@/lib/types";

const OPTIONS: { value: SemModel; label: string; caption: string }[] = [
  { value: "elser", label: "ELSER", caption: "sparse · English" },
  { value: "e5", label: "e5", caption: "dense · multilingual" },
];

export function ModelToggle({ model, onChange }: { model: SemModel; onChange: (m: SemModel) => void }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted">Embedding model</span>
      <div role="radiogroup" aria-label="Embedding model" className="flex rounded-lg border border-line bg-surface p-1">
        {OPTIONS.map((opt) => {
          const active = model === opt.value;
          return (
            <button
              key={opt.value}
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={`rounded-md px-3 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-semantic ${
                active ? "bg-raised text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              <span className="block text-sm font-semibold">{opt.label}</span>
              <span className="block font-mono text-[10px] text-muted">{opt.caption}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
