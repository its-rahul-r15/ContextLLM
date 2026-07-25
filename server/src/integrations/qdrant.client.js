import { genAI } from "./anthropic.client.js";
import { logger } from "../utils/logger.js";
const EMBEDDING_MODEL = "gemini-embedding-001";
const BATCH_SIZE = 20;
const RETRY_DELAY_MS = 2000;
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

let activeEmbeddingModel = EMBEDDING_MODEL;

export const embedBatch = async (texts, retries = 3) => {
  const results = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    let batchEmbeddings = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await genAI.models.embedContent({
          model: activeEmbeddingModel,
          contents: batch,
        });
        batchEmbeddings = result.embeddings.map((e) => e.values);
        break;
      } catch (err) {
        logger.warn(`Embedding batch attempt ${attempt} failed with model ${activeEmbeddingModel}`, { err: err.message });
        
        const isQuota = err.message?.includes("429") || err.message?.includes("RESOURCE_EXHAUSTED");
        if (isQuota && activeEmbeddingModel === "gemini-embedding-001") {
          logger.warn("gemini-embedding-001 quota exhausted, trying fallback to gemini-embedding-2...");
          activeEmbeddingModel = "gemini-embedding-2";
          attempt--;
          continue;
        }

        if (attempt === retries) throw err;
        
        if (isQuota) {
          logger.warn("Rate limit hit during embedding. Backing off for 15 seconds...");
          await sleep(15000);
        } else {
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }

    if (batchEmbeddings) {
      results.push(...batchEmbeddings);
    }

    if (i + BATCH_SIZE < texts.length) {
      await sleep(1000);
    }
  }
  return results;
};

export const embedText = async (text, retries = 3) => {
  const results = await embedBatch([text], retries);
  return results[0];
};
