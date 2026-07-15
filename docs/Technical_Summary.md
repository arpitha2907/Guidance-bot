# Multi-Domain Guidance Bot — Technical Implementation Summary

## 1. Project Overview

The Multi-Domain Guidance Bot is a conversational web application that
provides general guidance in two domains — health and emotional wellbeing —
grounded in a curated knowledge base using Retrieval-Augmented Generation
(RAG). Rather than answering from a language model's general knowledge, the
system retrieves vetted content from its own dataset and constrains the model
to answer only from that content, refusing when no relevant information is
found. This design ensures answers are specific, source-attributed, and
trustworthy.

The application detects the domain of a user's concern automatically, asks
dynamic follow-up questions to gather context, screens every message for
crisis signals before any processing, and then produces grounded guidance.
It includes a consent flow, editable answers, rate limiting, and is deployed
publicly over HTTPS.

## 2. System Architecture

The system is a two-tier application with a clear separation between a
stateless backend (holding all secrets and AI logic) and a frontend (the chat
interface). The frontend never contacts the AI providers directly; it only
calls the backend, which keeps all API keys server-side.

Request flow on the main endpoint runs in a fixed order: (1) a deterministic
safety gate, (2) intent detection, (3) dynamic questioning, and (4) RAG-based
guidance generation. The safety gate always runs first, so a crisis signal
short-circuits all downstream processing.

```
Frontend (Next.js / Vercel)
   |  HTTPS, JSON
   v
Backend (Node + Express / Render)
   |-- Safety gate (deterministic)
   |-- Intent detection (Groq LLM)
   |-- Dynamic questioning (Groq LLM)
   |-- RAG: Gemini embeddings + MongoDB Atlas Vector Search + Groq generation
```

## 3. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router, TypeScript), Tailwind CSS |
| Backend | Node.js, Express |
| Orchestration | LangChain.js (v1.x) |
| Generation model | Groq — llama-3.3-70b-versatile |
| Embedding model | Google Gemini — gemini-embedding-001 (3072 dimensions) |
| Vector store / DB | MongoDB Atlas with Atlas Vector Search |
| Backend hosting | Render (free tier, HTTPS) |
| Frontend hosting | Vercel (HTTPS) |
| Source control | GitHub (single repository, backend + frontend) |

Note on provider choice: Groq was selected for generation due to its speed
and low cost, which suits the latency targets and the multiple model calls
per turn. Because Groq does not offer an embeddings endpoint, Google Gemini
embeddings were used for the retrieval side. LangChain wraps both providers,
so either can be swapped with a one-line change.

## 4. The RAG Pipeline

### 4.1 Ingestion (offline)

Source documents (Markdown files, tagged by domain via filename convention)
are split into overlapping chunks of roughly 500 characters using a
recursive text splitter. Each chunk is embedded with Gemini and stored in
MongoDB Atlas as a document containing the text, its embedding vector, and
metadata (domain, source). Ingestion is re-run whenever the dataset changes.

### 4.2 Retrieval and generation (per query)

At query time, the user's accumulated input is embedded and used to search
the Atlas vector index for the nearest chunks, filtered by the detected
domain. The retrieved chunks are inserted into a strict prompt that instructs
the model to answer only from the provided context and to return a fixed
refusal message if the context is insufficient. This grounding is what
prevents generic or fabricated answers and enables source attribution.

### 4.3 Atlas Vector Search index

The vector index is defined on the embedding field with cosine similarity
and a domain filter. The dimension is set to 3072 to match the Gemini
`gemini-embedding-001` output.

```json
{ "fields": [
  { "type": "vector", "path": "embedding",
    "numDimensions": 3072, "similarity": "cosine" },
  { "type": "filter", "path": "domain" } ] }
```

## 5. Features Implemented (by PRD Task)

**Task 1 — Foundation & Infrastructure**
- Separate backend (Express) and frontend (Next.js) projects.
- Environment-based configuration with fail-fast validation of required secrets.
- MongoDB Atlas connection and health-check endpoint (now including a live DB ping).

**Task 2 — Chat Interface**
- Conversational chat UI with distinct user and assistant message styling, typing indicator, and auto-scroll.
- Calm, trust-oriented visual design (sage and paper palette).

**Task 3 — Intent Detection**
- Single structured LLM call classifies each concern as health, emotional, or unclear.
- Confidence threshold; ambiguous concerns trigger a clarifying question with selectable options rather than a guess.
- Robust JSON parsing with a safe fallback to 'unclear' on any malformed output.

**Task 4 — Dynamic Questioning**
- LLM-driven follow-up questions, one at a time, each building on previous answers.
- Hard-coded cap of 10 questions enforced in code, independent of the model.
- Conversation state held client-side and passed to the stateless backend each turn.
- Safety screening runs on every user answer, not just the first message.

**Task 5 — Guidance Generation**
- Grounded answer generation over the concern plus all collected answers.
- Source attribution shown with each answer; friendly refusal when no relevant content exists.

**Task 6 — Safety Layer**
- Deterministic, keyword-based crisis screening (not AI-judged) for predictability and testability, now covered by unit tests.
- Three categories: self-harm, abuse/violence, and medical emergency.
- Verified India-specific resources (emergency 112, Vandrevala Foundation, Tele-MANAS) shown in a prominent, distinct UI; normal flow halts on a trigger.

**Task 7 — UX & Consent**
- First-use consent screen with persisted acceptance; always-available disclaimer. Consent check no longer flashes the full app before localStorage is read.
- Edit-previous-answers with TRUE truncate-and-replay (editing an earlier answer discards all downstream Q&A and continues from that step) and a 'Conversation updated from step N' notification.
- Anonymous sessions (no authentication); conversation history now persists across page reloads/tab closes via a client-side cache (24-hour expiry), while the backend stays fully stateless.
- In-memory rate limiting at 20 requests per minute per client.
- Accessibility: WCAG AA text-contrast verified by measurement; accessible labels and semantic roles added.

## 6. Backend Module Map

| File | Responsibility |
|---|---|
| config.js | Loads and validates environment variables, including allowed CORS origins. |
| llm.js | Configures the Groq generation model and Gemini embedding model. |
| vectorstore.js | Connects LangChain to MongoDB Atlas Vector Search; exposes a client getter for health checks. |
| ingest.js | Ingestion pipeline: chunk, embed, store. |
| rag.js | Retrieval and grounded answer generation with refusal logic. |
| intent.js | Domain classification (health / emotional / unclear). |
| questioning.js | Dynamic follow-up question engine with 10-question cap. |
| safety.js | Deterministic crisis detection and resources. |
| ratelimit.js | In-memory per-IP rate limiter (20/min). |
| server.js | Express server; orchestrates the safety → intent → questioning → guidance flow; CORS restricted to configured origins; input length validation on all `/ask` fields. |

## 7. Deployment

- Code hosted in a single public GitHub repository containing both backend
  and frontend folders; secrets excluded via `.gitignore`.
- Backend deployed on Render as a Node web service (root directory set to
  `backend`), with secrets provided as environment variables in the Render
  dashboard rather than in code. `FRONTEND_ORIGIN` must be set to the deployed
  Vercel URL.
- Frontend deployed on Vercel (root directory set to `frontend`), configured
  with `NEXT_PUBLIC_API_BASE` pointing to the Render backend URL.
- Both platforms provide HTTPS automatically. MongoDB Atlas network access
  opened to allow the hosted backend; the database remains protected by
  credentials.
- CI (`.github/workflows/ci.yml`) runs backend unit tests and a frontend
  production build on every push/PR.

## 8. Implementation Status — Honest Assessment

All seven PRD tasks are implemented and the application is deployed and
functional end to end. The following items are characterised accurately
rather than claimed as fully complete:

- 'Conversation restarts when edited' is implemented as TRUE
  truncate-and-replay: editing an earlier answer discards every
  question/answer that came after it and the conversation continues from
  that step. (Previously this was patch-in-place; upgraded.)
- WCAG 2.1 AA: text-contrast ratios were measured and corrected to pass AA,
  and accessibility foundations (labels, roles, focus states) are in place; a
  full audit (keyboard and screen-reader testing) is pending.
- Response time under 2 seconds: typical turns are fast, but this should be
  measured on the deployed service and reported as measured values. The
  free-tier backend has a cold-start delay after idle periods.
- HTTPS is provided by the hosting platforms; no secrets are exposed
  client-side. CORS is now restricted to configured frontend origins rather
  than left open to all origins.

## 9. Known Limitations & Future Work

- Legal and general domains are out of MVP scope (as specified in the PRD,
  and now made explicit in `docs/PRD_Task_Breakdown.md`) and could be added
  by extending the intent classifier, dataset, and domain filter.
- Crisis detection is keyword-based and acts as a safety net, not a
  guarantee. Pattern lists were broadened (more self-harm, abuse/violence,
  and medical-emergency phrasings, including stroke FAST signs) and are
  unit-tested, but should keep expanding over time; a model-based second
  check remains future work.
- Conversation state now persists across page reloads/tab closes via a
  client-side (localStorage) cache with a 24-hour expiry -- the backend
  remains stateless; no server-side session store was introduced. A
  dedicated multi-conversation history browser (switching between past,
  separate conversations) was not built -- only the current conversation is
  resumable.
- The free-tier backend spins down when idle, causing a cold-start delay on
  the first request.
- No automated frontend tests yet (backend now has unit tests for the safety
  gate, rate limiter, and questioning helpers via CI). The truncate-and-replay
  edit flow was verified manually and via TypeScript type-checking rather
  than an automated component test.
