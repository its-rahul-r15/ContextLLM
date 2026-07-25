import mongoose from "mongoose";

const chunkSchema = new mongoose.Schema(
  {
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Source",
      required: true,
      index: true,
    },
    notebookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notebook",
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    parentChunkId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chunk",
      default: null,
    },
    text: {
      type: String,
      required: true,
    },
    embedding: {
      type: [Number],
      default: [],
    },
    location: {
      pageNumber: { type: Number, default: null },
      timestamp: { type: Number, default: null },
      paragraphIndex: { type: Number, default: null },
      // YouTube: timestamp range for cited video segment (seconds)
      startTime: { type: Number, default: null },
      endTime: { type: Number, default: null },
    },
    tokenCount: {
      type: Number,
      default: 0,
    },
    isParent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

chunkSchema.index({ notebookId: 1, sourceId: 1 });
chunkSchema.index({ notebookId: 1, embedding: 1 });

export const Chunk = mongoose.model("Chunk", chunkSchema);
