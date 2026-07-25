import { Router } from "express";
import { authenticate } from "../auth/auth.middleware.js";
import * as notebookController from "./notebook.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", notebookController.getNotebooks);
router.post("/", notebookController.createNotebook);
router.get("/:id", notebookController.getNotebook);
router.patch("/:id", notebookController.updateNotebook);
router.delete("/:id", notebookController.deleteNotebook);

router.post("/:id/share", notebookController.addCollaborator);
router.delete("/:id/share/:userId", notebookController.removeCollaborator);
router.get("/:id/share", notebookController.getCollaborators);

export default router;
