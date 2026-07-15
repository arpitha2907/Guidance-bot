// intent.js
// TASK 3 -- Intent Detection. Classifies a message into "health", "emotional",
// "legal", "general", or "unclear". This is classification, not RAG -- a
// single fast Groq call returning structured JSON. No retrieval/embeddings,
// so it stays well under the sub-1-second target. "unclear" -> the caller
// asks a clarifying question.
//
// "legal" and "general" were added post-MVP (see docs/PRD_Task_Breakdown.md
// Post-MVP Addendum) -- the original MVP only shipped health/emotional.
// Note this is unrelated to the safety gate in safety.js, which screens for
// abuse/violence/medical-emergency signals BEFORE this classifier ever runs,
// regardless of domain.

import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { llm } from "./llm.js";

const VALID = ["health", "emotional", "legal", "general", "unclear"];

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are an intent classifier for a guidance assistant with four domains:
- "health": physical health, symptoms, illness, injury, medication, nutrition, sleep, the body.
- "emotional": feelings, stress, anxiety, low mood, grief, relationships, mental wellbeing.
- "legal": general questions about legal processes, consumer complaints, tenancy/rental disputes, workplace disputes, contracts, or understanding legal terms and procedures. This is for informational legal-process questions, NOT for safety emergencies like abuse or violence -- those are screened out separately before this classifier ever runs.
- "general": everyday practical or life-admin questions that are not primarily about health, emotions, or legal matters -- e.g. budgeting, job interview preparation, or similar practical guidance.

Classify the user's message into exactly one of: "health", "emotional", "legal", "general", or "unclear".
Use "unclear" ONLY when the message is too vague or ambiguous to tell, or could equally fit more than one domain.

Respond with ONLY a JSON object, no other text, in exactly this form:
{{"domain":"health","confidence":0.0}}
where confidence is a number from 0 to 1.`,
  ],
  ["human", "{message}"],
]);

const chain = prompt.pipe(llm).pipe(new StringOutputParser());

export async function detectIntent(message) {
  let raw = "";
  try {
    raw = await chain.invoke({ message });
    const jsonStr = raw.replace(/```json|```/g, "").trim();
    const match = jsonStr.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : jsonStr);

    let domain = String(parsed.domain || "").toLowerCase();
    if (!VALID.includes(domain)) domain = "unclear";

    let confidence = Number(parsed.confidence);
    if (!Number.isFinite(confidence)) confidence = 0;

    if (domain !== "unclear" && confidence < 0.55) {
      return { domain: "unclear", confidence };
    }
    return { domain, confidence };
  } catch {
    return { domain: "unclear", confidence: 0, error: true };
  }
}