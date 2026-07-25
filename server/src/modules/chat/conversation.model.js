import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    notebookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notebook",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      default: "New Conversation",
      trim: true,
      maxlength: 200,
    },
  },
  { timestamps: true }
);

conversationSchema.index({ notebookId: 1, userId: 1, createdAt: -1 });

export const Conversation = mongoose.model("Conversation", conversationSchema);
