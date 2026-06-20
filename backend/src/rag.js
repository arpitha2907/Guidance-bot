// rag.js
// THE QUERY PIPELINE. Given a question:
//   1. Retrieve the top matching chunks from YOUR dataset (Gemini embeds the
//      question, Atlas finds nearest vectors).
//   2. Build a prompt giving the model ONLY those chunks, with a strict rule:
//      answer only from the context, never from your own knowledge, and refuse
//      if the context doesn't cover it. This is what kills generic answers.
//   3. Groq writes the grounded answer.

import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { llm } from "./llm.js";
import { getVectorStore } from "./vectorstore.js";

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a careful guidance assistant. Answer the user's question using ONLY the context below.
Rules:
- Use ONLY facts from the context. Do NOT use outside knowledge.
- If the context lacks enough information, reply exactly: "I don't have specific vetted guidance on that. For reliable information you may want to consult a trusted source such as your doctor or a recognised health service. If this feels urgent or distressing, please reach out to a professional." Do not guess.
- Use plain, clear language.
- Give general guidance only; do not give a diagnosis or definitive medical/legal advice.

Context:
{context}`,
  ],
  ["human", "{question}"],
]);

const chain = prompt.pipe(llm).pipe(new StringOutputParser());

export async function answerQuestion(question, domain = null) {
  const store = await getVectorStore();

  const filter = domain ? { preFilter: { domain: { $eq: domain } } } : undefined;
  const results = await store.similaritySearchWithScore(question, 4, filter);

  if (results.length === 0) {
    return {
      answer:
        "I don't have specific vetted guidance on that. For reliable information you may want to consult a trusted source such as your doctor or a recognised health service. If this feels urgent or distressing, please reach out to a professional.",
      sources: [],
    };
  }

  const context = results.map(([doc]) => doc.pageContent).join("\n\n---\n\n");
  const sources = [
    ...new Set(results.map(([doc]) => doc.metadata?.source).filter(Boolean)),
  ];

  const answer = await chain.invoke({ context, question });
  return { answer, sources };
}
