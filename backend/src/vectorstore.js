// vectorstore.js
// Bridges LangChain to your MongoDB Atlas collection. LangChain handles the
// embedding + search calls; Atlas stores the vectors and does the actual
// nearest-neighbour math.

import { MongoClient } from "mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { embeddings } from "./llm.js";
import { config } from "./config.js";

const client = new MongoClient(config.mongoUri);
let connected = false;

async function ensureConnected() {
  if (!connected) {
    await client.connect();
    connected = true;
  }
  return client;
}

// Exposed so callers (e.g. the /health endpoint) can run a lightweight ping
// without duplicating connection setup.
export async function getMongoClient() {
  return ensureConnected();
}

let collection;
async function getCollection() {
  if (!collection) {
    await ensureConnected();
    collection = client.db(config.mongoDb).collection(config.mongoCollection);
  }
  return collection;
}

export async function getVectorStore() {
  const coll = await getCollection();
  return new MongoDBAtlasVectorSearch(embeddings, {
    collection: coll,
    indexName: config.atlasVectorIndex,
    textKey: "text",
    embeddingKey: "embedding",
  });
}

export async function closeConnection() {
  await client.close();
  connected = false;
}
