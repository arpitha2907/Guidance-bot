import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";
import { config } from "./config.js";

export const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: config.googleApiKey,
  model: "gemini-embedding-001",
});

export const llm = new ChatGroq({
  apiKey: config.groqApiKey,
  model: "llama-3.3-70b-versatile",
  temperature: 0.2,
});