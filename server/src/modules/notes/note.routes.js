import { Router } from "express";
import { authenticate } from "../auth/auth.middleware.js";
import { ownerScope } from "../../middlewares/ownerScope.js";
import * as noteController from "./note.controller.js";

const router = Router({ mergeParams: true });

router.use(authenticate, ownerScope);

router.get("/", noteController.getNotes);
router.post("/", noteController.createNote);
router.patch("/:noteId", noteController.updateNote);
router.delete("/:noteId", noteController.deleteNote);

export default router;
