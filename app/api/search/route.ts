import { NextResponse } from "next/server";
import { getEsClient, ES_INDEX } from "@/lib/es";
import { buildLexical, buildSemantic, buildNaiveHybrid, buildRrf, SEM_FIELD } from "@/lib/queries";
import type { Hit, SearchResponse, SemModel, TierKey, TierResult } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface EsHitSource {
  name: string;
  stall: string;
  region: string;
  cuisine: string;
  price_sgd: number;
  tags: string[];
  description: string;
}

// Loose shape of what we consume from the ES response
interface EsHit {
  _id: string;
  _score: number | null;
  _source: EsHitSource;
  highlight?: Record<string, string[]>;
  matched_queries?: string[];
}

function toHits(hits: EsHit[], semField: string): Hit[] {
  return hits.map((h, i) => {
    const highlight = h.highlight?.[semField]?.[0] ?? h.highlight?.description?.[0];
    const snippet = highlight ?? truncate(h._source.description, 160);
    return {
      id: h._id,
      rank: i + 1,
      score: h._score,
      name: h._source.name,
      stall: h._source.stall,
      region: h._source.region,
      cuisine: h._source.cuisine,
      price_sgd: h._source.price_sgd,
      tags: h._source.tags ?? [],
      snippet,
      ...(h.matched_queries ? { matchedLegs: h.matched_queries } : {}),
    };
  });
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, "") + "…";
}

function esErrorMessage(err: unknown): string {
  const e = err as { meta?: { body?: { error?: { reason?: string; type?: string } } }; message?: string };
  const es = e.meta?.body?.error;
  if (es?.reason) return `${es.type ?? "error"}: ${es.reason}`;
  return e.message ?? String(err);
}

export async function POST(req: Request) {
  const { query, model } = (await req.json()) as { query?: string; model?: SemModel };
  if (!query?.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }
  const semModel: SemModel = model === "e5" ? "e5" : "elser";
  const semField = SEM_FIELD[semModel];
  const q = query.trim();

  const bodies: Record<TierKey, object> = {
    lexical: buildLexical(q),
    semantic: buildSemantic(q, semModel),
    naiveHybrid: buildNaiveHybrid(q, semModel),
    rrf: buildRrf(q, semModel),
  };

  const es = getEsClient();
  const keys = Object.keys(bodies) as TierKey[];

  const settled = await Promise.allSettled(
    keys.map(async (key) => {
      const started = performance.now();
      const res = await es.search({ index: ES_INDEX, ...bodies[key] });
      const tookMs = Math.round(performance.now() - started);
      const total = res.hits.total;
      const totalHits = typeof total === "number" ? total : (total?.value ?? 0);
      return {
        key,
        tookMs,
        esTookMs: res.took ?? null,
        totalHits,
        hits: toHits(res.hits.hits as unknown as EsHit[], semField),
      } satisfies TierResult;
    })
  );

  const tiers = {} as Record<TierKey, TierResult>;
  keys.forEach((key, i) => {
    const s = settled[i];
    tiers[key] =
      s.status === "fulfilled"
        ? s.value
        : { key, tookMs: 0, esTookMs: null, totalHits: 0, hits: [], error: esErrorMessage(s.reason) };
  });

  // RRF per-leg attribution: the RRF legs are the exact tier-1/tier-2 queries,
  // so each fused hit's constituent ranks come from an _id lookup — no explain:true needed.
  if (!tiers.rrf.error) {
    const rankOf = (tier: TierResult, id: string) => tier.hits.find((h) => h.id === id)?.rank ?? null;
    tiers.rrf.hits = tiers.rrf.hits.map((h) => ({
      ...h,
      legRanks: { lexical: rankOf(tiers.lexical, h.id), semantic: rankOf(tiers.semantic, h.id) },
    }));
  }

  const payload: SearchResponse = { query: q, model: semModel, tiers };
  return NextResponse.json(payload);
}
