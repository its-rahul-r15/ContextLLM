import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    notebookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notebook",
      required: true,
      index: true
    },
    title: {
      type: String,
      default: "Untitled Note",
      trim: true
    },
    content: {
      type: String, // Markdown text
      default: ""
    }
  },
  { timestamps: true }
);

export const Note = mongoose.model("Note", noteSchema);
