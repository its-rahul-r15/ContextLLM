import { Conversation } from "./conversation.model.js";
import { Message } from "./message.model.js";
import { ApiError } from "../../utils/ApiError.js";

export const createConversation = async (notebookId, userId, title) => {
  return Conversation.create({ notebookId, userId, title: title || "New Conversation" });
};

export const getConversations = async (notebookId, userId) => {
  return Conversation.find({ notebookId, userId }).sort({ createdAt: -1 }).lean();
};

export const getConversationById = async (conversationId, userId) => {
  const conv = await Conversation.findOne({ _id: conversationId, userId }).lean();
  if (!conv) throw new ApiError(404, "Conversation not found");
  return conv;
};

export const getMessages = async (conversationId, userId) => {
  const conv = await Conversation.findOne({ _id: conversationId, userId }).lean();
  if (!conv) throw new ApiError(404, "Conversation not found");
  return Message.find({ conversationId }).sort({ createdAt: 1 }).lean();
};

export const deleteConversation = async (conversationId, userId) => {
  const conv = await Conversation.findOneAndDelete({ _id: conversationId, userId });
  if (!conv) throw new ApiError(404, "Conversation not found");
  await Message.deleteMany({ conversationId });
  return conv;
};

export const updateConversationTitle = async (conversationId, userId, title) => {
  const conv = await Conversation.findOneAndUpdate(
    { _id: conversationId, userId },
    { title },
    { new: true }
  );
  if (!conv) throw new ApiError(404, "Conversation not found");
  return conv;
};
