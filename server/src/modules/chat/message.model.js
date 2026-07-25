import mongoose from "mongoose";

const citationSchema = new mongoose.Schema(
  {
    ref: Number,
    chunkId: { type: mongoose.Schema.Types.ObjectId, ref: "Chunk" },
    sourceId: { type: mongoose.Schema.Types.ObjectId, ref: "Source" },
    text: { type: String, default: null },
    location: {
      pageNumber: { type: Number, default: null },
      timestamp: { type: Number, default: null },
      paragraphIndex: { type: Number, default: null },
    },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    citations: [citationSchema],
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

export const Message = mongoose.model("Message", messageSchema);
