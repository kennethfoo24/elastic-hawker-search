/**
 * Sanity-check the semantic query end to end. No longer required before a
 * demo — semantic_e5 runs on the Elastic Inference Service (EIS), which is
 * shared and always-warm (no per-project ML allocation, no cold start).
 * Kept as a quick connectivity check: npm run warm
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
  const started = Date.now();
  await client.search({
    index: ES_INDEX,
    size: 1,
    query: { match: { semantic_e5: "warm up" } },
    _source: false,
  });
  console.log(`✓ semantic_e5 query OK (${Date.now() - started}ms)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
