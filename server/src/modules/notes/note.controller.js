import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import * as noteService from "./note.service.js";

export const getNotes = asyncHandler(async (req, res) => {
  const notes = await noteService.getNotesByNotebookId(req.notebook._id);
  new ApiResponse(200, "Notes fetched", notes).send(res);
});

export const createNote = asyncHandler(async (req, res) => {
  const { title, content } = req.body;
  const note = await noteService.createNote(req.notebook._id, { title, content });
  new ApiResponse(201, "Note created", note).send(res);
});

export const updateNote = asyncHandler(async (req, res) => {
  const { title, content } = req.body;
  const note = await noteService.updateNote(req.params.noteId, { title, content });
  new ApiResponse(200, "Note updated", note).send(res);
});

export const deleteNote = asyncHandler(async (req, res) => {
  await noteService.deleteNote(req.params.noteId);
  new ApiResponse(200, "Note deleted").send(res);
});
