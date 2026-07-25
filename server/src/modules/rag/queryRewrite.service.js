import { generateContentWithFallback } from "../../integrations/anthropic.client.js";

const MODEL = "gemini-2.5-flash";

export const rewriteQuery = async (query, conversationHistory = []) => {
  const historyText = conversationHistory
    .slice(-4)
    .map((m) => `${m.role}: ${m.text}`)
    .join("\n");

  const prompt = `You are a query optimizer for a document retrieval system.
Given the conversation history and the user's latest question, rewrite the question as a precise, standalone search query that will retrieve the most relevant document chunks.
Output ONLY the rewritten query, nothing else.

Conversation history:
${historyText || "None"}

User question: ${query}

Rewritten search query:`;

  const result = await generateContentWithFallback({
    model: MODEL,
    contents: prompt,
  });

  return (result.text || "").trim();
};
