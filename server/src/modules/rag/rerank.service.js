import { generateContentWithFallback } from "../../integrations/anthropic.client.js";

const MODEL = "gemini-2.5-flash";

export const rerank = async (query, chunks, topN = 5) => {
  if (chunks.length === 0) return [];
  if (chunks.length <= topN) return chunks;

  const scoringPrompt = `Score each passage's relevance to the query on a scale of 1-10.
Query: "${query}"

${chunks.map((c, i) => `[${i}] ${c.text.slice(0, 300)}`).join("\n\n")}

Respond with ONLY a JSON array of scores in the same order, e.g. [7,3,9,2,8]`;

  try {
    const result = await generateContentWithFallback({
      model: MODEL,
      contents: scoringPrompt,
      config: { responseMimeType: "application/json" },
    });

    const text = (result.text || "").trim();
    const scores = text ? JSON.parse(text) : [];

    return chunks
      .map((c, i) => ({ ...c, rerankScore: scores[i] ?? 0 }))
      .sort((a, b) => b.rerankScore - a.rerankScore)
      .slice(0, topN);
  } catch {
    return chunks.slice(0, topN);
  }
};
