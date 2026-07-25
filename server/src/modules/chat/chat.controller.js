import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import * as chatService from "./chat.service.js";

export const createConversation = asyncHandler(async (req, res) => {
  const { nid } = req.params;
  const { title } = req.body;
  const conversation = await chatService.createConversation(nid, req.user._id, title);
  new ApiResponse(201, "Conversation created", conversation).send(res);
});

export const getConversations = asyncHandler(async (req, res) => {
  const { nid } = req.params;
  const conversations = await chatService.getConversations(nid, req.user._id);
  new ApiResponse(200, "Conversations fetched", conversations).send(res);
});

export const getMessages = asyncHandler(async (req, res) => {
  const { cid } = req.params;
  const messages = await chatService.getMessages(cid, req.user._id);
  new ApiResponse(200, "Messages fetched", messages).send(res);
});

export const deleteConversation = asyncHandler(async (req, res) => {
  const { cid } = req.params;
  await chatService.deleteConversation(cid, req.user._id);
  new ApiResponse(200, "Conversation deleted").send(res);
});

export const updateTitle = asyncHandler(async (req, res) => {
  const { cid } = req.params;
  const conv = await chatService.updateConversationTitle(cid, req.user._id, req.body.title);
  new ApiResponse(200, "Title updated", conv).send(res);
});
