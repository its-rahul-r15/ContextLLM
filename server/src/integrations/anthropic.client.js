import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export const genAI = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

const isQuotaError = (err) => {
  const msg = err.message || "";
  return msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429") || msg.includes("quota");
};

export const generateContentWithFallback = async (params) => {
  const modelToTry = params.model || "gemini-2.5-flash";
  try {
    return await genAI.models.generateContent({
      ...params,
      model: modelToTry,
    });
  } catch (error) {
    if (isQuotaError(error) && modelToTry === "gemini-2.5-flash") {
      logger.warn("gemini-2.5-flash quota exhausted, falling back to gemini-flash-latest");
      return await genAI.models.generateContent({
        ...params,
        model: "gemini-flash-latest",
      });
    }
    throw error;
  }
};

export const generateContentStreamWithFallback = async (params) => {
  const modelToTry = params.model || "gemini-2.5-flash";
  try {
    return await genAI.models.generateContentStream({
      ...params,
      model: modelToTry,
    });
  } catch (error) {
    if (isQuotaError(error) && modelToTry === "gemini-2.5-flash") {
      logger.warn("gemini-2.5-flash stream quota exhausted, falling back to gemini-flash-latest");
      return await genAI.models.generateContentStream({
        ...params,
        model: "gemini-flash-latest",
      });
    }
    throw error;
  }
};
