// questioning.js
// TASK 4 -- Dynamic Questioning (LLM-driven). Given the conversation so far,
// decide to either ask ONE more follow-up question or signal "ready" for
// guidance. Hard cap of 10 questions is enforced in code, not by the model.

import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { llm } from "./llm.js";

export const MAX_QUESTIONS = 10;

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a careful {domain} guidance assistant gathering information before giving guidance.
You ask ONE short, relevant follow-up question at a time, building on what the user already told you.
Do not give advice yet. Do not ask more than one question. Keep questions plain and easy to answer.

Decide whether you have enough information to give helpful general guidance.
- If you need more, respond with the next single question.
- If you have enough, respond that you are ready.

Respond with ONLY a JSON object, no other text, in exactly this form:
{{"action":"ask","question":"<your single question>"}}
or
{{"action":"ready"}}`,
  ],
  [
    "human",
    `Original concern: {concern}

Conversation so far:
{history}

What is your next step?`,
  ],
]);

const chain = prompt.pipe(llm).pipe(new StringOutputParser());

function formatHistory(history) {
  if (!history || history.length === 0) return "(no questions asked yet)";
  return history
    .map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`)
    .join("\n");
}

export async function nextStep({ concern, history = [], domain }) {
  if (history.length >= MAX_QUESTIONS) {
    return { action: "ready" };
  }
  try {
    const raw = await chain.invoke({
      domain,
      concern,
      history: formatHistory(history),
    });
    const jsonStr = raw.replace(/```json|```/g, "").trim();
    const match = jsonStr.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : jsonStr);

    if (parsed.action === "ask" && typeof parsed.question === "string" && parsed.question.trim()) {
      return { action: "ask", question: parsed.question.trim(), count: history.length + 1 };
    }
    return { action: "ready" };
  } catch {
    return { action: "ready" };
  }
}

export function buildGuidanceQuery({ concern, history = [] }) {
  const qa = (history || []).map((qa) => `${qa.question} ${qa.answer}`).join(" ");
  return `${concern} ${qa}`.trim();
}