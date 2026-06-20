// ingest.js
// THE INGESTION PIPELINE. Run once, and again whenever your data changes:
//     npm run ingest
//
// Steps:
//   1. Read every .txt / .md file from data/ (YOUR dataset).
//   2. Split each into ~500-char overlapping chunks (overlap avoids cutting
//      sentences in half; smaller chunks retrieve more precisely).
//   3. Tag each chunk with metadata (domain, source filename).
//   4. addDocuments() embeds each chunk via Gemini and stores
//      {text, embedding, domain, source} documents in Atlas.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { getVectorStore, closeConnection } from "./vectorstore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

// Infer domain from filename: "health_*.md" -> "health", "emotional_*" -> ...
function inferDomain(filename) {
  const lower = filename.toLowerCase();
  if (lower.startsWith("health")) return "health";
  if (lower.startsWith("emotional")) return "emotional";
  return "general";
}

async function main() {
  console.log("Reading dataset from:", DATA_DIR);

  const files = (await readdir(DATA_DIR)).filter(
    (f) => f.endsWith(".txt") || f.endsWith(".md")
  );

  if (files.length === 0) {
    console.log("No .txt/.md files in data/. Add your dataset files first.");
    return;
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  });

  const allDocs = [];
  for (const file of files) {
    const raw = await readFile(path.join(DATA_DIR, file), "utf-8");
    const domain = inferDomain(file);
    const chunks = await splitter.createDocuments(
      [raw],
      [{ domain, source: file }]
    );
    console.log(`  ${file}: ${chunks.length} chunks (domain=${domain})`);
    allDocs.push(...chunks);
  }

  console.log(`Embedding + storing ${allDocs.length} chunks in Atlas...`);
  const store = await getVectorStore();
  await store.addDocuments(allDocs);

  console.log("Done. Ingestion complete.");
  await closeConnection();
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
