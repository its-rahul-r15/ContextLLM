import { Notebook } from "../modules/notebooks/notebook.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const ownerScope = asyncHandler(async (req, res, next) => {
  const notebookId = req.params.nid || req.params.notebookId;

  if (!notebookId) return next();

  const notebook = await Notebook.findById(notebookId).lean();

  if (!notebook) throw new ApiError(404, "Notebook not found");

  const isOwner = notebook.ownerId.toString() === req.user._id.toString();
  const collaborator = notebook.collaborators?.find(
    (c) => c.userId.toString() === req.user._id.toString()
  );

  if (!isOwner && !collaborator) {
    throw new ApiError(403, "Access denied to this notebook");
  }

  if (!isOwner && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    if (collaborator.role !== "editor") {
      throw new ApiError(403, "Write permission required for this notebook");
    }
  }

  req.notebook = notebook;
  next();
});
