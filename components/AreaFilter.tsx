"use client";

import { AREA_PRESETS } from "@/lib/geo";
import { PinIcon } from "./Icons";

export function AreaFilter({
  active,
  onPick,
}: {
  active: string | null;
  onPick: (area: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1 pr-1 font-mono text-[10px] uppercase tracking-widest text-muted">
        <PinIcon className="h-3.5 w-3.5" />
        Area
      </span>
      <button
        onClick={() => onPick(null)}
        className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          active === null
            ? "border-primary bg-primary text-white"
            : "border-border bg-surface text-muted hover:border-primary/40 hover:text-ink"
        }`}
      >
        Anywhere SG
      </button>
      {AREA_PRESETS.map((a) => (
        <button
          key={a.key}
          onClick={() => onPick(a.key)}
          className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
            active === a.key
              ? "border-primary bg-primary text-white"
              : "border-border bg-surface text-muted hover:border-primary/40 hover:text-ink"
          }`}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
