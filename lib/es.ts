import { Client } from "@elastic/elasticsearch";

export const ES_INDEX = process.env.ES_INDEX ?? "hawker-dishes";

let client: Client | null = null;

/** Singleton ES client. 60s timeout survives cold ML-model scale-up on serverless. */
export function getEsClient(): Client {
  if (!client) {
    const node = process.env.ELASTICSEARCH_URL;
    const apiKey = process.env.ELASTICSEARCH_API_KEY;
    if (!node || !apiKey) {
      throw new Error(
        "Missing ELASTICSEARCH_URL / ELASTICSEARCH_API_KEY — copy .env.example to .env.local and fill in your Elastic Cloud Serverless project credentials."
      );
    }
    client = new Client({
      node,
      auth: { apiKey },
      requestTimeout: 60_000,
    });
  }
  return client;
}
