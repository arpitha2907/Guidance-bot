# Multi-Domain Guidance Bot

A conversational web app that gives general guidance across four domains —
**health**, **emotional wellbeing**, **legal**, and **general/practical**
guidance — grounded in a curated knowledge base using Retrieval-Augmented
Generation (RAG). Answers come only from the project's own vetted dataset;
the bot refuses when nothing relevant is found rather than falling back on a
model's generic knowledge. (The original MVP shipped with health and
emotional only; legal and general were added post-MVP -- see the Post-MVP
Addendum in `docs/PRD_Task_Breakdown.md`.)

This repo has two independently deployable parts:

```
Guidance-Bot/
├── backend/    Node + Express API: safety gate, intent detection,
│               dynamic questioning, RAG-based guidance generation.
│               See backend/README.md for setup.
├── frontend/   Next.js chat UI. See frontend/README.md for setup.
└── docs/       PRD task breakdown and technical summary.
```

## How a request flows

```
User message
   │
   ▼
Frontend (Next.js)  ──HTTPS/JSON──▶  Backend (Express)
                                        │
                                        ├─ 1. Safety gate (deterministic keyword match)
                                        │     — crisis signal short-circuits everything below
                                        ├─ 2. Intent detection (Groq LLM)
                                        │     — classifies health / emotional / unclear
                                        ├─ 3. Dynamic questioning (Groq LLM)
                                        │     — up to 10 follow-up questions, one at a time
                                        └─ 4. RAG guidance generation
                                              — Gemini embeddings + MongoDB Atlas Vector
                                                Search retrieve chunks, Groq writes the
                                                grounded answer from those chunks only
```

The safety gate always runs first: a crisis signal in the message halts all
downstream processing and returns emergency resources instead.

## Quick start

1. `cd backend && npm install` then follow `backend/README.md` to configure
   `.env`, create the Atlas Vector Search index, and run `npm run ingest`.
2. `cd frontend && npm install` then follow `frontend/README.md` to configure
   `.env.local` and point it at the backend.
3. Run both (`npm run dev` in each folder) and open the frontend at
   `http://localhost:3000`.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router, TypeScript), Tailwind CSS |
| Backend | Node.js, Express |
| Orchestration | LangChain.js |
| Generation model | Groq — llama-3.3-70b-versatile |
| Embedding model | Google Gemini — gemini-embedding-001 (3072 dimensions) |
| Vector store | MongoDB Atlas Vector Search |
| Source control | GitHub |

## Project docs

- [`docs/PRD_Task_Breakdown.md`](docs/PRD_Task_Breakdown.md) — the 7-task PRD
  breakdown this MVP was built against, with a scope-consistency note on the
  domain list (see below).
- [`docs/Technical_Summary.md`](docs/Technical_Summary.md) — architecture,
  module map, honest implementation-status assessment, and known limitations.

### PRD scope history

Task 3 of the original PRD listed domain detection completion criteria for
"Health, Emotional, and General" queries, while the MVP Scope Verification
section only explicitly included Health and Emotional (and excluded Legal)
-- General was never implemented in the original MVP. This inconsistency was
resolved by making the MVP boundary explicit in `docs/PRD_Task_Breakdown.md`,
and Legal + General have since been implemented post-MVP (see that file's
Post-MVP Addendum) rather than left as an ambiguous gap.

## Current status

All 7 MVP PRD tasks are implemented and deployable end to end. See
`docs/Technical_Summary.md` section 8 for an honest, itemized assessment of
what's fully done vs. partially done, and section 9 for known limitations.
Since the original MVP, the following have been added: conversation
persistence across reloads, true truncate-and-replay on edit, expanded
crisis-detection patterns, a keyboard/screen-reader accessibility pass with
automated `jsx-a11y` linting in CI, and legal + general domain support (see
`docs/PRD_Task_Breakdown.md`'s Post-MVP Addendum -- note this requires
re-running `npm run ingest` to embed the new datasets). Remaining: a live
assistive-technology testing session (real screen reader, not just
automated linting).

## License

MIT — see [LICENSE](LICENSE).
