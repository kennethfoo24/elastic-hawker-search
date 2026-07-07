"use client";

import { useCallback, useRef, useState } from "react";
import { ModelToggle } from "@/components/ModelToggle";
import { QueryChips } from "@/components/QueryChips";
import { SearchBar } from "@/components/SearchBar";
import { TierColumn } from "@/components/TierColumn";
import { TIERS } from "@/lib/tiers";
import type { SuggestedQuery } from "@/lib/suggested-queries";
import type { SearchResponse, SemModel } from "@/lib/types";

export default function Home() {
  const [query, setQuery] = useState("");
  const [model, setModel] = useState<SemModel>("elser");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeChip, setActiveChip] = useState<SuggestedQuery | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(async (q: string, m: SemModel) => {
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
        body: JSON.stringify({ query: q, model: m }),
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

  const handleModelChange = (m: SemModel) => {
    setModel(m);
    if (data) runSearch(data.query, m); // semantic tiers depend on the model
  };

  const handleChip = (sq: SuggestedQuery) => {
    setQuery(sq.query);
    setActiveChip(sq);
    runSearch(sq.query, model);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">
            Elasticsearch relevance demo
          </p>
          <h1 className="font-display text-5xl uppercase leading-none tracking-wide text-ink sm:text-6xl">
            Hawker Search
          </h1>
          {/* four-color stripe: one segment per retrieval strategy */}
          <div className="mt-2 flex h-1.5 w-56 overflow-hidden rounded-full">
            <div className="flex-1 bg-lexical" />
            <div className="flex-1 bg-semantic" />
            <div className="flex-1 bg-naive" />
            <div className="flex-1 bg-rrf" />
          </div>
          <p className="mt-2 max-w-xl text-sm text-muted">
            One query, four retrieval strategies, side by side — over a multilingual Singapore hawker
            guide on Elastic Cloud Serverless.
          </p>
        </div>
        <ModelToggle model={model} onChange={handleModelChange} />
      </header>

      <div className="flex flex-col gap-4">
        <SearchBar
          value={query}
          onChange={(v) => {
            setQuery(v);
            setActiveChip(null);
          }}
          onSearch={() => runSearch(query, model)}
          loading={loading}
        />
        <QueryChips active={activeChip} model={model} onPick={handleChip} />
      </div>

      {fatal && (
        <div className="rounded-lg border border-rrf/50 bg-rrf/10 p-4 text-sm">
          <p className="font-semibold text-rrf">Search failed</p>
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
            model={model}
            hoverId={hoverId}
            onHover={setHoverId}
          />
        ))}
      </main>

      <footer className="flex items-center justify-between text-[11px] text-muted/70">
        <span className="font-mono">index: hawker-dishes · ELSER + multilingual-e5 via semantic_text</span>
        <span>Hover a dish to trace it across all four strategies</span>
      </footer>
    </div>
  );
}
