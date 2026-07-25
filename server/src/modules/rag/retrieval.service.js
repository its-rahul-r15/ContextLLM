import { cosineSimilaritySearch } from "../chunks/chunk.repository.js";

export const retrieve = async (queryEmbedding, notebookId, sourceIds = [], topK = 20) => {
  const results = await cosineSimilaritySearch(queryEmbedding, notebookId, sourceIds, topK);
  return results;
};
