import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as notebookService from "./notebook.service.js";

export const createNotebook = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  if (!title) throw new ApiError(422, "Title is required");
  const notebook = await notebookService.createNotebook(req.user._id, { title, description });
  new ApiResponse(201, "Notebook created", notebook).send(res);
});

export const getNotebooks = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await notebookService.getUserNotebooks(req.user._id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  });
  new ApiResponse(200, "Notebooks fetched", result).send(res);
});

export const getNotebook = asyncHandler(async (req, res) => {
  const notebook = await notebookService.getNotebookById(req.params.id, req.user._id);
  new ApiResponse(200, "Notebook fetched", notebook).send(res);
});

export const updateNotebook = asyncHandler(async (req, res) => {
  const notebook = await notebookService.updateNotebook(req.params.id, req.user._id, req.body);
  new ApiResponse(200, "Notebook updated", notebook).send(res);
});

export const deleteNotebook = asyncHandler(async (req, res) => {
  await notebookService.deleteNotebook(req.params.id, req.user._id);
  new ApiResponse(200, "Notebook deleted").send(res);
});

export const addCollaborator = asyncHandler(async (req, res) => {
  const { email, role } = req.body;
  if (!email) throw new ApiError(422, "Collaborator email is required");
  const collaborator = await notebookService.addCollaborator(req.params.id, req.user._id, email, role);
  new ApiResponse(200, "Collaborator added successfully", collaborator).send(res);
});

export const removeCollaborator = asyncHandler(async (req, res) => {
  await notebookService.removeCollaborator(req.params.id, req.user._id, req.params.userId);
  new ApiResponse(200, "Collaborator removed successfully").send(res);
});

export const getCollaborators = asyncHandler(async (req, res) => {
  const collaborators = await notebookService.getCollaborators(req.params.id, req.user._id);
  new ApiResponse(200, "Collaborators fetched", collaborators).send(res);
});
