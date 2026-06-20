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

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.post("/ask", rateLimit, async (req, res) => {
  try {
    const { concern, domain, history = [], latestAnswer } = req.body || {};

    if (!concern || typeof concern !== "string") {
      return res.status(400).json({ error: "Provide a 'concern' string." });
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
});