// server.js
// Flow on /ask (multi-turn): SAFETY -> INTENT -> QUESTIONING -> GUIDANCE
// The CLIENT holds conversation state and sends it each turn:
//   { concern, domain?, history?: [{question, answer}], latestAnswer? }

import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { answerQuestion } from "./rag.js";
import { screenForCrisis } from "./safety.js";
import { detectIntent } from "./intent.js";
import { nextStep, buildGuidanceQuery } from "./questioning.js";
import { rateLimit } from "./ratelimit.js";
import { getMongoClient } from "./vectorstore.js";

// Limits on user-supplied text so a single request can't blow up token
// costs or hang the process on a pathological payload.
const MAX_FIELD_LENGTH = 2000;
const MAX_HISTORY_ITEMS = 20;

const app = express();

// CORS is restricted to known frontend origins (see config.js /
// FRONTEND_ORIGIN env var) rather than left open to any origin.
app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser requests (no Origin header, e.g. curl/health checks).
      if (!origin || config.frontendOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json({ limit: "100kb" }));

app.get("/health", async (req, res) => {
  let dbStatus = "unknown";
  try {
    const client = await getMongoClient();
    await client.db().command({ ping: 1 });
    dbStatus = "ok";
  } catch {
    dbStatus = "unreachable";
  }
  const status = dbStatus === "ok" ? "ok" : "degraded";
  res.status(status === "ok" ? 200 : 503).json({
    status,
    db: dbStatus,
    time: new Date().toISOString(),
  });
});

function isValidText(value, maxLength = MAX_FIELD_LENGTH) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

app.post("/ask", rateLimit, async (req, res) => {
  try {
    const { concern, domain, history = [], latestAnswer } = req.body || {};

    if (!isValidText(concern)) {
      return res.status(400).json({
        error: `Provide a 'concern' string (1-${MAX_FIELD_LENGTH} characters).`,
      });
    }
    if (latestAnswer !== undefined && !isValidText(latestAnswer)) {
      return res.status(400).json({
        error: `'latestAnswer' must be a string (1-${MAX_FIELD_LENGTH} characters).`,
      });
    }
    if (!Array.isArray(history) || history.length > MAX_HISTORY_ITEMS) {
      return res.status(400).json({
        error: `'history' must be an array of at most ${MAX_HISTORY_ITEMS} items.`,
      });
    }

    // 1. SAFETY GATE -- screen original concern AND the latest typed answer.
    const crisis =
      screenForCrisis(concern) ||
      (latestAnswer ? screenForCrisis(latestAnswer) : null);
    if (crisis) {
      return res.json(crisis);
    }

    // 2. INTENT -- only if domain not yet known.
    let resolvedDomain = domain;
    if (!resolvedDomain) {
      const intent = await detectIntent(concern);
      if (intent.domain === "unclear") {
        return res.json({
          clarify: true,
          message:
            "I want to make sure I point you in the right direction. Is your question more about a physical health concern, or about how you're feeling emotionally?",
          options: [
            { label: "Physical health", domain: "health" },
            { label: "Emotional wellbeing", domain: "emotional" },
          ],
        });
      }
      resolvedDomain = intent.domain;
    }

    // 3. QUESTIONING -- ask another, or proceed.
    const step = await nextStep({ concern, history, domain: resolvedDomain });
    if (step.action === "ask") {
      return res.json({
        ask: true,
        question: step.question,
        count: step.count,
        domain: resolvedDomain,
      });
    }

    // 4. GUIDANCE -- RAG over concern + all answers.
    const query = buildGuidanceQuery({ concern, history });
    const result = await answerQuestion(query, resolvedDomain);
    res.json({ ...result, domain: resolvedDomain, done: true });
  } catch (err) {
    console.error("/ask failed:", err);
    res.status(500).json({ error: "Something went wrong answering that." });
  }
});

app.listen(config.port, () => {
  console.log(`Backend running at http://localhost:${config.port}`);
  console.log(`Health check: http://localhost:${config.port}/health`);
  console.log(`Allowed frontend origins: ${config.frontendOrigins.join(", ")}`);
});
