# Guidance Bot — Frontend

Next.js (App Router, TypeScript, Tailwind) chat interface for the Multi-Domain
Guidance Bot. Talks only to the backend API — it never calls Groq/Gemini/Atlas
directly, so no AI provider keys are ever exposed client-side.

## Setup

```bash
npm install
cp .env.example .env.local   # then edit NEXT_PUBLIC_API_BASE if needed
npm run dev
```

Open http://localhost:3000. By default it talks to a backend running at
`http://localhost:4000` (see `backend/README.md` to get that running first).

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE` | No | `http://localhost:4000` | Base URL of the deployed backend API. Must be set to the production backend URL when deploying the frontend (e.g. on Vercel). |

## What's implemented here

- Consent gate (first-use disclaimer, persisted in `localStorage`) with an
  always-visible disclaimer link in the footer.
- Chat UI with distinct user/bot bubbles, typing indicator, auto-scroll.
- Dynamic follow-up question flow driven entirely by backend responses.
- Domain clarification buttons when the backend can't confidently classify
  the concern.
- Edit-previous-answer flow ("Edit" on any prior answer patches history in
  place and shows a "Conversation updated from step N" notice).
- Crisis/emergency resource display (`role="alert"`) when the backend's
  safety gate is triggered.

## Deployment

Deployed on Vercel with the project root set to `frontend/` and
`NEXT_PUBLIC_API_BASE` set to the Render backend URL as an environment
variable in the Vercel dashboard (not committed to the repo).

## Build

```bash
npm run build
```
