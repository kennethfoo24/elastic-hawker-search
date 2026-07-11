"use client";

import { useCallback, useRef, useState } from "react";
import { QueryChips } from "@/components/QueryChips";
import { AreaFilter } from "@/components/AreaFilter";
import { SearchBar } from "@/components/SearchBar";
import { TierColumn } from "@/components/TierColumn";
import { TierIcon } from "@/components/Icons";
import { HeroCollage } from "@/components/HeroCollage";
import { TIERS } from "@/lib/tiers";
import type { SuggestedQuery } from "@/lib/suggested-queries";
import type { SearchResponse } from "@/lib/types";

export default function Home() {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeChip, setActiveChip] = useState<SuggestedQuery | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(async (q: string, areaKey: string | null) => {
    if (!q.trim()) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setFatal(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, area: areaKey }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setData((await res.json()) as SearchResponse);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setFatal((err as Error).message);
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }, []);

  const handleChip = (sq: SuggestedQuery) => {
    const areaKey = sq.area ?? null;
    setQuery(sq.query);
    setActiveChip(sq);
    setArea(areaKey);
    runSearch(sq.query, areaKey);
  };

  const handleAreaPick = (areaKey: string | null) => {
    setArea(areaKey);
    setActiveChip(null);
    if (query.trim()) runSearch(query, areaKey);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-4 pb-6 sm:px-6">
      <header className="relative -mx-4 overflow-hidden bg-brand px-4 py-12 sm:-mx-6 sm:rounded-b-[28px] sm:px-10 sm:py-16">
        <div className="relative flex items-center justify-between gap-10">
          <div className="flex flex-col items-start gap-7">
            <h1 className="font-hero text-5xl font-bold leading-none tracking-tight text-white sm:text-7xl">
              Hawker Food
            </h1>

            <div className="flex flex-wrap items-center gap-2">
              {TIERS.map((meta, i) => (
                <div key={meta.key} className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                    <TierIcon tier={meta.key} className="h-3.5 w-3.5 text-white" />
                    {meta.name}
                  </span>
                  {i < TIERS.length - 1 && <span className="text-white/40">→</span>}
                </div>
              ))}
            </div>
          </div>

          <HeroCollage />
        </div>
      </header>

      <div className="flex flex-col gap-4">
        <SearchBar
          value={query}
          onChange={(v) => {
            setQuery(v);
            setActiveChip(null);
          }}
          onSearch={() => runSearch(query, area)}
          loading={loading}
        />
        <AreaFilter active={area} onPick={handleAreaPick} />
        <QueryChips active={activeChip} onPick={handleChip} />
      </div>

      {fatal && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive-tint p-4 text-sm">
          <p className="font-semibold text-destructive">Search failed</p>
          <p className="mt-1 text-ink/85">{fatal}</p>
        </div>
      )}

      <main className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {TIERS.map((meta) => (
          <TierColumn
            key={meta.key}
            meta={meta}
            result={data?.tiers[meta.key] ?? null}
            loading={loading}
            hoverId={hoverId}
            onHover={setHoverId}
          />
        ))}
      </main>

      <footer className="flex items-center justify-between text-[11px] text-muted/70">
        <span className="font-mono">hawker-dishes · multilingual-e5</span>
        <span>Hover a dish to trace it across columns</span>
      </footer>
    </div>
  );
}
