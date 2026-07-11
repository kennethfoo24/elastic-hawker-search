"use client";

import { useState } from "react";
import type { Hit, TierKey } from "@/lib/types";

function fmtScore(score: number | null, tier: TierKey): string {
  if (score == null) return "—";
  return tier === "hybrid" ? score.toFixed(4) : score.toFixed(2);
}

function TrailNode({ label, rank }: { label: string; rank: number | null }) {
  const hit = rank !== null;
  return (
    <span
      className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[10px] ${
        hit ? "border-primary/30 bg-primary-tint text-primary-dark" : "border-border bg-shell text-muted/70"
      }`}
    >
      <span className="font-semibold">{label}</span>
      <span>{hit ? `#${rank}` : "—"}</span>
    </span>
  );
}

function RouteDots() {
  return <span className="h-px w-2.5 shrink-0 border-t border-dashed border-border" aria-hidden="true" />;
}

/** Deterministic two-tone gradient + monogram — used whenever a dish has no photo, or its photo fails to load. */
function gradientFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return {
    background: `linear-gradient(135deg, hsl(${hue} 55% 55%), hsl(${(hue + 45) % 360} 55% 40%))`,
  };
}

function DishThumb({ name, url }: { name: string; url: string | null }) {
  const [errored, setErrored] = useState(false);
  const showPhoto = url && !errored;
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-shell"
      style={showPhoto ? undefined : gradientFor(name)}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- external hotlinked photos; avoids remotePatterns upkeep
        <img
          src={url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <span className="font-display text-sm font-semibold text-white/90">{name.charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}

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
      className={`flex gap-3 rounded-xl border p-3 transition-all duration-150 ${
        hovered ? "border-primary/40 bg-surface shadow-md" : "border-border bg-surface"
      } ${dimmed ? "opacity-35" : ""}`}
    >
      <DishThumb name={hit.name} url={hit.image_url} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-shell font-mono text-[11px] font-medium text-muted">
            {hit.rank}
          </span>
          <span className="min-w-0 flex-1 truncate font-semibold text-ink">{hit.name}</span>
          <span className="shrink-0 font-mono text-xs text-muted">{fmtScore(hit.score, tier)}</span>
        </div>

        <p className="mt-0.5 text-xs text-muted">
          {hit.stall.split(",")[0]} · {hit.region} · ${hit.price_sgd.toFixed(2)}
          {hit.distanceKm !== null && <span className="text-primary-dark"> · {hit.distanceKm} km away</span>}
        </p>

        <p
          className="snippet mt-1.5 line-clamp-2 text-[13px] leading-snug text-ink/75"
          dangerouslySetInnerHTML={{ __html: hit.snippet }}
        />

        {hit.legRanks && (
          <div className="mt-2 flex items-center gap-1" aria-label="Route to final rank">
            <TrailNode label="KEY" rank={hit.legRanks.keyword} />
            <RouteDots />
            <TrailNode label="SEM" rank={hit.legRanks.semantic} />
            <RouteDots />
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 font-mono text-[10px] font-bold text-white">
              #{hit.rank}
            </span>
          </div>
        )}
      </div>
    </li>
  );
}
