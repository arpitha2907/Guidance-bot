# Guidance Bot — Backend (RAG: Groq + Gemini embeddings + MongoDB Atlas)

Loads your dataset, stores it as searchable vectors in MongoDB Atlas, and
answers questions using ONLY your data (grounded RAG — no generic answers).

## Pipeline

```
Your dataset (data/*.md)
   └─ npm run ingest ──> chunk ──> embed (Gemini) ──> store in Atlas

User question
   └─ POST /ask ──> embed question (Gemini) ──> find matching chunks in Atlas
                 ──> give chunks to Groq ──> grounded answer
```

Two providers, both via API, both wrapped by LangChain:
- **Groq** (llama-3.3-70b-versatile) — writes the answers (fast, cheap)
- **Gemini** (text-embedding-004, 768-dim) — embeddings for search

## Setup

### 1. Install
```bash
cd backend
npm install
```

### 2. Get your keys (both free)
- **Groq:** https://console.groq.com/keys  (starts with `gsk_`)
- **Gemini:** https://aistudio.google.com/app/apikey
- **Atlas:** your cluster → Connect → Drivers → copy the connection string

### 3. Configure
```bash
cp .env.example .env
```
Fill in `GROQ_API_KEY`, `GOOGLE_API_KEY`, and `MONGODB_URI` (replace `<password>`).

### 4. Create the Atlas Vector Search index (one time, in Atlas UI)
Atlas Search → Create Index → JSON Editor. Target `guidance_bot.guidance_chunks`.
Name it `guidance_vector_index`. Paste:
```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 768, "similarity": "cosine" },
    { "type": "filter", "path": "domain" }
  ]
}
```
numDimensions MUST be **768** (matches Gemini text-embedding-004). Wait until
the index status is **Active** (~1 min).

### 5. Add data
Drop `.md`/`.txt` files in `data/`, named by domain (`health_*`, `emotional_*`).
Two samples are included so you can test immediately.

### 6. Ingest
```bash
npm run ingest
```

### 7. Run
```bash
npm run dev
```
Test:
```bash
curl http://localhost:4000/health

curl -X POST http://localhost:4000/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What should I do for a mild fever?","domain":"health"}'
```
Ask something NOT in your data (e.g. tax advice) → it should refuse. That proves
answers come from your dataset, not the model's general knowledge.

## Switching the generation model later
Edit only `src/llm.js`. The rest of the code is untouched.
