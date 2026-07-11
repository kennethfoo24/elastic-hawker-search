/**
 * Relevance acceptance test: run every suggested-query chip through all 4
 * columns (keyword, semantic, combined, hybrid) and print the top hits so
 * each chip's intended story can be verified/tuned. Usage: npx tsx scripts/validate-chips.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { Client } from "@elastic/elasticsearch";
import { buildKeyword, buildSemantic, buildCombined, buildHybrid } from "../lib/queries";
import { findAreaPreset } from "../lib/geo";
import { SUGGESTED_QUERIES } from "../lib/suggested-queries";
import type { TierKey } from "../lib/types";
import type { AreaPreset } from "../lib/geo";

const ES_INDEX = process.env.ES_INDEX ?? "hawker-dishes";
const client = new Client({
  node: process.env.ELASTICSEARCH_URL!,
  auth: { apiKey: process.env.ELASTICSEARCH_API_KEY! },
  requestTimeout: 120_000,
});

const TIERS: TierKey[] = ["keyword", "semantic", "combined", "hybrid"];

function body(tier: TierKey, q: string, area: AreaPreset | null): object {
  switch (tier) {
    case "keyword":
      return buildKeyword(q, area);
    case "semantic":
      return buildSemantic(q, area);
    case "combined":
      return buildCombined(q, area);
    case "hybrid":
      return buildHybrid(q, area);
  }
}

async function main() {
  const top = Number(process.env.TOP ?? 5);
  for (const chip of SUGGESTED_QUERIES) {
    const area = findAreaPreset(chip.area);
    console.log(`\n━━━ "${chip.query}"  [${chip.archetype}]${area ? `  area=${area.label}` : ""}`);
    const results = await Promise.all(
      TIERS.map(async (tier) => {
        try {
          const res = await client.search({ index: ES_INDEX, ...body(tier, chip.query, area) });
          const names = (
            res.hits.hits as { _source?: { name?: string; region?: string }; _score?: number | null }[]
          )
            .slice(0, top)
            .map((h, i) => `${i + 1}.${h._source?.name}${area ? `[${h._source?.region}]` : ""}`);
          return `${tier}: ${names.join("  ") || "(no hits)"}`;
        } catch (err) {
          return `${tier}: ERROR ${(err as Error).message}`;
        }
      })
    );
    for (const line of results) console.log(`  ${line}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
