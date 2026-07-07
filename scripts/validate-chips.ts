/**
 * Relevance acceptance test: run every suggested-query chip through all 4 tiers
 * under both embedding models and print the top hits so each chip's intended
 * story can be verified/tuned. Usage: npx tsx scripts/validate-chips.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { Client } from "@elastic/elasticsearch";
import { buildLexical, buildSemantic, buildNaiveHybrid, buildRrf } from "../lib/queries";
import { SUGGESTED_QUERIES } from "../lib/suggested-queries";
import type { SemModel, TierKey } from "../lib/types";

const ES_INDEX = process.env.ES_INDEX ?? "hawker-dishes";
const client = new Client({
  node: process.env.ELASTICSEARCH_URL!,
  auth: { apiKey: process.env.ELASTICSEARCH_API_KEY! },
  requestTimeout: 120_000,
});

const TIERS: TierKey[] = ["lexical", "semantic", "naiveHybrid", "rrf"];

function body(tier: TierKey, q: string, model: SemModel): object {
  switch (tier) {
    case "lexical":
      return buildLexical(q);
    case "semantic":
      return buildSemantic(q, model);
    case "naiveHybrid":
      return buildNaiveHybrid(q, model);
    case "rrf":
      return buildRrf(q, model);
  }
}

async function main() {
  const top = Number(process.env.TOP ?? 3);
  for (const chip of SUGGESTED_QUERIES) {
    console.log(`\n━━━ "${chip.query}"  [${chip.archetype}]`);
    for (const model of ["elser", "e5"] as SemModel[]) {
      const results = await Promise.all(
        TIERS.map(async (tier) => {
          try {
            const res = await client.search({ index: ES_INDEX, ...body(tier, chip.query, model) });
            const names = (res.hits.hits as { _source?: { name?: string }; _score?: number | null }[])
              .slice(0, top)
              .map((h, i) => `${i + 1}.${h._source?.name}`);
            return `${tier}: ${names.join("  ") || "(no hits)"}`;
          } catch (err) {
            return `${tier}: ERROR ${(err as Error).message}`;
          }
        })
      );
      console.log(`  [${model}]`);
      for (const line of results) console.log(`    ${line}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
