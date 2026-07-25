import { Router } from "express";
import { authenticate } from "../auth/auth.middleware.js";
import * as userController from "./user.controller.js";

const router = Router();

router.use(authenticate);

router.get("/me", userController.getMe);
router.patch("/me", userController.updateMe);

export default router;
