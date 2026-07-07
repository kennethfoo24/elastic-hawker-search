/**
 * Warm both inference endpoints before a live demo — serverless ML allocations
 * scale to zero when idle and a cold first query can stall 30s+.
 * Run ~5 minutes before demoing: npm run warm
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { Client } from "@elastic/elasticsearch";

const ES_INDEX = process.env.ES_INDEX ?? "hawker-dishes";

const client = new Client({
  node: process.env.ELASTICSEARCH_URL!,
  auth: { apiKey: process.env.ELASTICSEARCH_API_KEY! },
  requestTimeout: 120_000,
});

async function main() {
  for (const field of ["semantic_elser", "semantic_e5"]) {
    const started = Date.now();
    await client.search({
      index: ES_INDEX,
      size: 1,
      query: { match: { [field]: "warm up" } },
      _source: false,
    });
    console.log(`✓ ${field} warm (${Date.now() - started}ms)`);
  }
  console.log("Both inference endpoints are warm — demo away.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
