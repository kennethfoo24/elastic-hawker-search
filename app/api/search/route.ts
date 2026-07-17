import { NextResponse } from "next/server";
import { getEsClient, ES_INDEX } from "@/lib/es";
import { buildQuery } from "@/lib/queries";
import { findAreaPreset, haversineKm } from "@/lib/geo";
import type { GeoPoint, Hit, SearchResponse, TierKey, TierResult } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface EsHitSource {
  name: string;
  stall: string;
  region: string;
  price_sgd: number;
  tags: string[];
  description: string;
  image_url?: string;
  location?: GeoPoint;
}

// Loose shape of what we consume from the ES response
interface EsHit {
  _id: string;
  _score: number | null;
  _source: EsHitSource;
  highlight?: Record<string, string[]>;
}

function toHits(hits: EsHit[], highlightField: string, areaCenter: GeoPoint | null): Hit[] {
  return hits.map((h, i) => {
    const highlight = h.highlight?.[highlightField]?.[0] ?? h.highlight?.description?.[0];
    // semantic_text chunks include the copied name/aliases; a fragment that's just
    // the dish name reads as broken — fall back to the description instead
    const useful = highlight && highlight.replace(/<\/?em>/g, "").trim().length > 40;
    const snippet = useful ? highlight : truncate(h._source.description, 160);
    const location = h._source.location ?? null;
    return {
      id: h._id,
      rank: i + 1,
      score: h._score,
      name: h._source.name,
      stall: h._source.stall,
      region: h._source.region,
      price_sgd: h._source.price_sgd,
      tags: h._source.tags ?? [],
      snippet,
      image_url: h._source.image_url ?? null,
      location,
      distanceKm: areaCenter && location ? haversineKm(areaCenter, location) : null,
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

// Which highlighted field to read back per column.
const HIGHLIGHT_FIELD: Record<TierKey, string> = {
  keyword: "description",
  semantic: "semantic_e5",
  hybrid: "semantic_e5",
};

export async function POST(req: Request) {
  const { query, area: areaKey } = (await req.json()) as { query?: string; area?: string };
  if (!query?.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }
  const q = query.trim();
  const area = findAreaPreset(areaKey);
  const areaCenter: GeoPoint | null = area ? { lat: area.lat, lon: area.lon } : null;

  const keys: TierKey[] = ["keyword", "semantic", "hybrid"];
  const bodies: Record<TierKey, object> = Object.fromEntries(
    keys.map((key) => [key, buildQuery(key, q, area)])
  ) as Record<TierKey, object>;

  const es = getEsClient();

  const settled = await Promise.allSettled(
    keys.map(async (key) => {
      const started = performance.now();
      const res = await es.search({ index: ES_INDEX, ...bodies[key] });
      const tookMs = Math.round(performance.now() - started);
      return {
        key,
        tookMs,
        hits: toHits(res.hits.hits as unknown as EsHit[], HIGHLIGHT_FIELD[key], areaCenter),
      } satisfies TierResult;
    })
  );

  const tiers = {} as Record<TierKey, TierResult>;
  keys.forEach((key, i) => {
    const s = settled[i];
    tiers[key] =
      s.status === "fulfilled" ? s.value : { key, tookMs: 0, hits: [], error: esErrorMessage(s.reason) };
  });

  // Hybrid attribution: both legs are the exact keyword/semantic queries from
  // columns 1 & 2, so each fused hit's constituent ranks come from an _id
  // lookup — no explain:true needed.
  const rankOf = (tier: TierResult, id: string) => tier.hits.find((h) => h.id === id)?.rank ?? null;
  if (!tiers.hybrid.error) {
    tiers.hybrid.hits = tiers.hybrid.hits.map((h) => ({
      ...h,
      legRanks: {
        keyword: rankOf(tiers.keyword, h.id),
        semantic: rankOf(tiers.semantic, h.id),
      },
    }));
  }

  const payload: SearchResponse = { query: q, area: area?.key ?? null, tiers };
  return NextResponse.json(payload);
}
