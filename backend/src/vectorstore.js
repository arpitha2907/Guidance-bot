// vectorstore.js
// Bridges LangChain to your MongoDB Atlas collection. LangChain handles the
// embedding + search calls; Atlas stores the vectors and does the actual
// nearest-neighbour math.

import { MongoClient } from "mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { embeddings } from "./llm.js";
import { config } from "./config.js";

const client = new MongoClient(config.mongoUri);

let collection;
async function getCollection() {
  if (!collection) {
    await client.connect();
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
}
