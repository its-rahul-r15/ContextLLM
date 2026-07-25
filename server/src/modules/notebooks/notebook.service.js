import { Notebook } from "./notebook.model.js";
import { User } from "../users/user.model.js";
import { ApiError } from "../../utils/ApiError.js";

export const createNotebook = async (ownerId, { title, description }) => {
  const notebook = await Notebook.create({ ownerId, title, description });
  return notebook;
};

export const getUserNotebooks = async (ownerId, { page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;
  const filter = {
    $or: [
      { ownerId },
      { "collaborators.userId": ownerId }
    ]
  };
  const [notebooks, total] = await Promise.all([
    Notebook.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notebook.countDocuments(filter),
  ]);
  return { notebooks, total, page, totalPages: Math.ceil(total / limit) };
};

export const getNotebookById = async (notebookId, userId) => {
  const notebook = await Notebook.findById(notebookId).lean();
  if (!notebook) throw new ApiError(404, "Notebook not found");

  const isOwner = notebook.ownerId.toString() === userId.toString();
  const isCollaborator = notebook.collaborators?.some(c => c.userId.toString() === userId.toString());
  if (!isOwner && !isCollaborator) {
    throw new ApiError(403, "Access denied to this notebook");
  }
  return notebook;
};

export const updateNotebook = async (notebookId, userId, updates) => {
  const notebook = await Notebook.findById(notebookId);
  if (!notebook) throw new ApiError(404, "Notebook not found");

  const isOwner = notebook.ownerId.toString() === userId.toString();
  const collaborator = notebook.collaborators?.find(c => c.userId.toString() === userId.toString());
  if (!isOwner && (!collaborator || collaborator.role !== "editor")) {
    throw new ApiError(403, "Write permission required for this notebook");
  }

  if (updates.title) notebook.title = updates.title;
  if (updates.description !== undefined) notebook.description = updates.description;
  await notebook.save();
  return notebook;
};

export const deleteNotebook = async (notebookId, userId) => {
  const notebook = await Notebook.findById(notebookId);
  if (!notebook) throw new ApiError(404, "Notebook not found");

  const isOwner = notebook.ownerId.toString() === userId.toString();
  if (!isOwner) {
    throw new ApiError(403, "Only the notebook owner can delete it");
  }

  await Notebook.findByIdAndDelete(notebookId);
  return notebook;
};

export const incrementSourceCount = async (notebookId, delta = 1) => {
  await Notebook.findByIdAndUpdate(notebookId, { $inc: { sourceCount: delta } });
};

export const addCollaborator = async (notebookId, userId, collaboratorEmail, role = "editor") => {
  const notebook = await Notebook.findById(notebookId);
  if (!notebook) throw new ApiError(404, "Notebook not found");

  if (notebook.ownerId.toString() !== userId.toString()) {
    throw new ApiError(403, "Only the owner can share this notebook");
  }

  const userToShare = await User.findOne({ email: collaboratorEmail });
  if (!userToShare) throw new ApiError(404, "User with this email not found");

  if (notebook.ownerId.toString() === userToShare._id.toString()) {
    throw new ApiError(400, "You cannot share a notebook with the owner");
  }

  const exists = notebook.collaborators.some(c => c.userId.toString() === userToShare._id.toString());
  if (exists) throw new ApiError(400, "User is already a collaborator");

  notebook.collaborators.push({ userId: userToShare._id, role });
  await notebook.save();

  return {
    userId: userToShare._id,
    displayName: userToShare.displayName,
    email: userToShare.email,
    role
  };
};

export const removeCollaborator = async (notebookId, userId, collaboratorUserId) => {
  const notebook = await Notebook.findById(notebookId);
  if (!notebook) throw new ApiError(404, "Notebook not found");

  const isOwner = notebook.ownerId.toString() === userId.toString();
  const isSelf = collaboratorUserId.toString() === userId.toString();
  if (!isOwner && !isSelf) {
    throw new ApiError(403, "You do not have permission to remove this collaborator");
  }

  notebook.collaborators = notebook.collaborators.filter(c => c.userId.toString() !== collaboratorUserId.toString());
  await notebook.save();
  return notebook;
};

export const getCollaborators = async (notebookId, userId) => {
  const notebook = await Notebook.findById(notebookId).populate("collaborators.userId", "displayName email");
  if (!notebook) throw new ApiError(404, "Notebook not found");

  const isOwner = notebook.ownerId.toString() === userId.toString();
  const isCollaborator = notebook.collaborators.some(c => c.userId._id.toString() === userId.toString());
  if (!isOwner && !isCollaborator) {
    throw new ApiError(403, "Access denied to this notebook");
  }

  return notebook.collaborators.map(c => ({
    userId: c.userId._id,
    displayName: c.userId.displayName,
    email: c.userId.email,
    role: c.role
  }));
};
