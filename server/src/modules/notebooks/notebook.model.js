import mongoose from "mongoose";

const notebookSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    sourceCount: {
      type: Number,
      default: 0,
    },
    collaborators: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        role: { type: String, enum: ["editor", "viewer"], default: "editor" }
      }
    ],
  },
  { timestamps: true }
);

notebookSchema.index({ ownerId: 1, createdAt: -1 });

export const Notebook = mongoose.model("Notebook", notebookSchema);
