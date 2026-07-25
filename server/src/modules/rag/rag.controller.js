import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { orchestrateRag } from "./rag.orchestrator.js";
import { Conversation } from "../chat/conversation.model.js";
import { Message } from "../chat/message.model.js";

export const streamChat = asyncHandler(async (req, res) => {
  const { cid: conversationId } = req.params;
  const { query, sourceIds } = req.body;

  if (!query?.trim()) throw new ApiError(422, "Query is required");

  const conversation = await Conversation.findById(conversationId).lean();
  if (!conversation) throw new ApiError(404, "Conversation not found");

  if (conversation.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Access denied");
  }

  const history = await Message.find({ conversationId })
    .sort({ createdAt: 1 })
    .limit(10)
    .lean();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await orchestrateRag({
      query,
      notebookId: conversation.notebookId,
      sourceIds: sourceIds || [],
      conversationHistory: history,
      conversationId,
      userId: req.user._id,
      onToken: (token) => sendEvent("token", { token }),
      onComplete: ({ text, citations, messageId }) => {
        sendEvent("done", { text, citations, messageId });
        res.end();
      },
    });
  } catch (err) {
    sendEvent("error", { message: err.message || "Internal error" });
    res.end();
  }
});
