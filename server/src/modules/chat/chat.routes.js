import { Router } from "express";
import { authenticate } from "../auth/auth.middleware.js";
import { ownerScope } from "../../middlewares/ownerScope.js";
import { chatLimiter } from "../../middlewares/rateLimiter.js";
import * as chatController from "./chat.controller.js";
import { streamChat } from "../rag/rag.controller.js";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.post("/notebooks/:nid/conversations", ownerScope, chatController.createConversation);
router.get("/notebooks/:nid/conversations", ownerScope, chatController.getConversations);

router.get("/conversations/:cid/messages", chatController.getMessages);
router.patch("/conversations/:cid/title", chatController.updateTitle);
router.delete("/conversations/:cid", chatController.deleteConversation);

router.post("/conversations/:cid/chat", chatLimiter, streamChat);

export default router;
