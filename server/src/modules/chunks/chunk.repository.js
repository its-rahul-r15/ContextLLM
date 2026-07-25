import mongoose from "mongoose";
import { Chunk } from "./chunk.model.js";

export const bulkInsertChunks = async (chunks) => {
  return Chunk.insertMany(chunks, { ordered: false });
};

export const getChunksBySource = async (sourceId) => {
  return Chunk.find({ sourceId }).lean();
};

export const getChunksWithoutEmbeddings = async (sourceId) => {
  return Chunk.find({ sourceId, embedding: { $size: 0 } }).lean();
};

export const updateChunkEmbedding = async (chunkId, embedding) => {
  return Chunk.findByIdAndUpdate(chunkId, { embedding });
};

export const deleteChunksBySource = async (sourceId) => {
  return Chunk.deleteMany({ sourceId });
};

export const cosineSimilaritySearch = async (queryEmbedding, notebookId, sourceIds, topK = 20) => {
  const notebookObjectId = typeof notebookId === "string" ? new mongoose.Types.ObjectId(notebookId) : notebookId;
  const matchStage = { 
    notebookId: notebookObjectId, 
    isParent: false, 
    embedding: { $exists: true, $not: { $size: 0 } } 
  };
  
  if (sourceIds && sourceIds.length > 0) {
    const objectIds = sourceIds.map(id => typeof id === "string" ? new mongoose.Types.ObjectId(id) : id);
    matchStage.sourceId = { $in: objectIds };
  }

  const chunks = await Chunk.find(matchStage)
    .select("text embedding location sourceId notebookId parentChunkId tokenCount")
    .lean();

  const scored = chunks
    .map((chunk) => ({
      ...chunk,
      score: cosine(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
};

const cosine = (a, b) => {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
};
