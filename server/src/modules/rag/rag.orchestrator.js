import { generateContentStreamWithFallback } from "../../integrations/anthropic.client.js";
import { rewriteQuery } from "./queryRewrite.service.js";
import { embedText } from "./embedding.service.js";
import { retrieve } from "./retrieval.service.js";
import { rerank } from "./rerank.service.js";
import { buildCitationMap, parseCitations } from "./citation.service.js";
import { Message } from "../chat/message.model.js";
import { logger } from "../../utils/logger.js";

const MODEL = "gemini-2.5-flash";

const buildSystemPrompt = (context, citationMap) => {
  const contextText = Object.entries(citationMap)
    .map(([ref, data]) => `[${ref}] ${data.text}`)
    .join("\n\n");

  return `You are a knowledgeable research assistant. Answer the user's question using ONLY the provided source context below.
Cite every fact or claim using inline references like [1], [2], etc. corresponding to the source passages.
If the answer cannot be found in the provided context, say so explicitly — do not hallucinate.
Be concise, accurate, and well-structured.

SOURCE CONTEXT:
${contextText}`;
};

export const orchestrateRag = async ({
  query,
  notebookId,
  sourceIds,
  conversationHistory,
  conversationId,
  userId,
  onToken,
  onComplete,
}) => {
  try {
    const rewrittenQuery = await rewriteQuery(query, conversationHistory);
    logger.info("RAG execution details:", { originalQuery: query, rewrittenQuery, notebookId, sourceIds });

    const queryEmbedding = await embedText(rewrittenQuery);

    const candidates = await retrieve(queryEmbedding, notebookId, sourceIds, 20);
    logger.info(`Retrieved ${candidates.length} candidates. Sources found:`, {
      sources: [...new Set(candidates.map(c => c.sourceId?.toString()))]
    });

    if (candidates.length === 0) {
      const noContextMsg = "I couldn't find relevant information in the selected sources to answer your question.";
      onToken(noContextMsg);
      onComplete({ text: noContextMsg, citations: [] });
      return;
    }

    const topChunks = await rerank(rewrittenQuery, candidates, 5);

    const citationMap = buildCitationMap(topChunks);

    const systemPrompt = buildSystemPrompt(topChunks, citationMap);

    const contents = [
      ...conversationHistory.slice(-6).map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.text }],
      })),
      { role: "user", parts: [{ text: query }] },
    ];

    let fullText = "";

    const stream = await generateContentStreamWithFallback({
      model: MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    for await (const chunk of await stream) {
      const token = chunk.text ?? "";
      fullText += token;
      onToken(token);
    }

    const citations = parseCitations(fullText, citationMap);

    await Message.create({
      conversationId,
      role: "user",
      text: query,
      citations: [],
    });

    const assistantMsg = await Message.create({
      conversationId,
      role: "assistant",
      text: fullText,
      citations: citations.map((c) => ({
        chunkId: c.chunkId,
        sourceId: c.sourceId,
        text: c.text,
        location: c.location,
        ref: c.ref,
      })),
    });

    onComplete({ text: fullText, citations, messageId: assistantMsg._id });
  } catch (err) {
    logger.error("RAG orchestration failed", { err: err.message });
    throw err;
  }
};
