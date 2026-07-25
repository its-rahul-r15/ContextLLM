import { Note } from "./note.model.js";
import { ApiError } from "../../utils/ApiError.js";

export const getNotesByNotebookId = async (notebookId) => {
  return Note.find({ notebookId }).sort({ updatedAt: -1 }).lean();
};

export const createNote = async (notebookId, { title, content } = {}) => {
  return Note.create({
    notebookId,
    title: title || "Untitled Note",
    content: content || ""
  });
};

export const updateNote = async (noteId, { title, content }) => {
  const note = await Note.findById(noteId);
  if (!note) throw new ApiError(404, "Note not found");

  if (title !== undefined) note.title = title;
  if (content !== undefined) note.content = content;
  
  await note.save();
  return note;
};

export const deleteNote = async (noteId) => {
  const note = await Note.findByIdAndDelete(noteId);
  if (!note) throw new ApiError(404, "Note not found");
  return note;
};
