// config.js
// Loads .env and exposes all settings as one object. Fails fast with a clear
// message if a required secret is missing, so you never debug a vague error.

import dotenv from "dotenv";
dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Did you copy .env.example to .env and fill it in?`
    );
  }
  return value;
}

export const config = {
  groqApiKey: required("GROQ_API_KEY"),
  googleApiKey: required("GOOGLE_API_KEY"),
  mongoUri: required("MONGODB_URI"),
  mongoDb: process.env.MONGODB_DB || "guidance_bot",
  mongoCollection: process.env.MONGODB_COLLECTION || "guidance_chunks",
  atlasVectorIndex: process.env.ATLAS_VECTOR_INDEX || "guidance_vector_index",
  port: parseInt(process.env.PORT || "4000", 10),
  // Comma-separated list of allowed frontend origins for CORS. Defaults to
  // common local dev ports so `npm run dev` keeps working out of the box;
  // set this explicitly in production (e.g. your Vercel URL).
  frontendOrigins: (
    process.env.FRONTEND_ORIGIN || "http://localhost:3000,http://127.0.0.1:3000"
  )
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
};
