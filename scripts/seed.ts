/**
 * Recreate the hawker-dishes index and bulk-ingest data/*.json.
 * First run auto-deploys ELSER + multilingual-e5 on the serverless project — budget 5–10 min.
 * Usage: npm run seed
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@elastic/elasticsearch";

const ES_INDEX = process.env.ES_INDEX ?? "hawker-dishes";

const client = new Client({
  node: process.env.ELASTICSEARCH_URL!,
  auth: { apiKey: process.env.ELASTICSEARCH_API_KEY! },
  requestTimeout: 300_000, // inference runs at index time; first run also deploys models
});

interface RawDish {
  id: string;
  notes?: string; // authoring-only field, stripped before indexing
  [k: string]: unknown;
}

function loadDishes(): RawDish[] {
  const files = ["dishes.core.json", "dishes.extra.json"];
  const dishes: RawDish[] = [];
  for (const f of files) {
    const p = join(process.cwd(), "data", f);
    if (!existsSync(p)) {
      console.warn(`⚠ ${f} not found, skipping`);
      continue;
    }
    const docs = JSON.parse(readFileSync(p, "utf8")) as RawDish[];
    console.log(`Loaded ${docs.length} docs from ${f}`);
    dishes.push(...docs);
  }
  const ids = new Set<string>();
  for (const d of dishes) {
    if (ids.has(d.id)) throw new Error(`Duplicate id: ${d.id}`);
    ids.add(d.id);
  }
  return dishes;
}

async function recreateIndex() {
  if (await client.indices.exists({ index: ES_INDEX })) {
    console.log(`Deleting existing index ${ES_INDEX}`);
    await client.indices.delete({ index: ES_INDEX });
  }
  console.log(`Creating index ${ES_INDEX}`);
  await client.indices.create({
    index: ES_INDEX,
    mappings: {
      properties: {
        name: {
          type: "text",
          fields: { keyword: { type: "keyword" } },
          copy_to: ["semantic_elser", "semantic_e5"],
        },
        aliases: { type: "text", copy_to: ["semantic_elser", "semantic_e5"] },
        description: { type: "text", copy_to: ["semantic_elser", "semantic_e5"] },
        stall: { type: "text" },
        region: { type: "keyword" },
        cuisine: { type: "keyword" },
        price_sgd: { type: "float" },
        tags: { type: "text", fields: { keyword: { type: "keyword" } } },
        semantic_elser: { type: "semantic_text", inference_id: ".elser-2-elasticsearch" },
        semantic_e5: { type: "semantic_text", inference_id: ".multilingual-e5-small-elasticsearch" },
      },
    },
  });
}

async function ingest(dishes: RawDish[]) {
  console.log(`Bulk ingesting ${dishes.length} docs (inference at index time — be patient)…`);
  const started = Date.now();
  const result = await client.helpers.bulk({
    datasource: dishes,
    concurrency: 1,
    flushBytes: 50_000,
    onDocument(doc) {
      const { id, notes: _notes, ...source } = doc;
      return [{ index: { _index: ES_INDEX, _id: id } }, source] as never;
    },
    onDrop(doc) {
      console.error("✗ dropped doc", doc.document?.id, JSON.stringify(doc.error));
    },
  });
  console.log(
    `Ingested ${result.successful} docs, ${result.failed} failed, in ${Math.round((Date.now() - started) / 1000)}s`
  );
  if (result.failed > 0) process.exit(1);
  await client.indices.refresh({ index: ES_INDEX });
}

async function smokeTest() {
  const count = await client.count({ index: ES_INDEX });
  console.log(`Index ${ES_INDEX} now holds ${count.count} docs`);
  for (const field of ["semantic_elser", "semantic_e5"] as const) {
    const res = await client.search({
      index: ES_INDEX,
      size: 1,
      query: { match: { [field]: "spicy noodles" } },
      _source: ["name"],
    });
    const top = res.hits.hits[0];
    console.log(`Smoke test ${field}: top hit = ${(top?._source as { name?: string })?.name} (score ${top?._score})`);
    if (!top) throw new Error(`Semantic field ${field} returned no hits — model deployment may have failed`);
  }
}

async function main() {
  const dishes = loadDishes();
  await recreateIndex();
  await ingest(dishes);
  await smokeTest();
  console.log("✓ Seed complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
