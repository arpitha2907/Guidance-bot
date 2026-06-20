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
};
