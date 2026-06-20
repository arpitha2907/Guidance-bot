// intent.js
// TASK 3 -- Intent Detection. Classifies a message into "health", "emotional",
// or "unclear". This is classification, not RAG -- a single fast Groq call
// returning structured JSON. No retrieval/embeddings, so it stays well under
// the sub-1-second target. "unclear" -> the caller asks a clarifying question.

import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { llm } from "./llm.js";

const VALID = ["health", "emotional", "unclear"];

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are an intent classifier for a guidance assistant with two domains:
- "health": physical health, symptoms, illness, injury, medication, nutrition, sleep, the body.
- "emotional": feelings, stress, anxiety, low mood, grief, relationships, mental wellbeing.

Classify the user's message into exactly one of: "health", "emotional", or "unclear".
Use "unclear" ONLY when the message is too vague or ambiguous to tell, or could equally be either.

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