import { redisClient } from "../../config/redis.js";
import { logger } from "../../utils/logger.js";

/**
 * Redis pub/sub channel name for a playlist.
 * Workers publish here on every status transition.
 */
export const playlistChannel = (playlistId) => `playlist:${playlistId}:progress`;

/**
 * Publish a status update event for a video within a playlist.
 * Called by the ingestion worker.
 */
export const publishPlaylistProgress = async (playlistId, payload) => {
  try {
    const channel = playlistChannel(playlistId);
    await redisClient.publish(channel, JSON.stringify(payload));
  } catch (err) {
    logger.error("Failed to publish playlist progress event", { err: err.message });
  }
};

/**
 * SSE handler — streams real-time playlist progress to the connected client.
 *
 * Opens a dedicated Redis subscriber (must be a separate connection from the
 * main client — ioredis moves a client to subscriber-only mode once you subscribe).
 *
 * Protocol:
 *   data: { videoId, sourceId, status, title, summary? }
 *   event: complete  (when all done or SSE timeout)
 */
export const streamPlaylistProgress = async (req, res, playlist, sources) => {
  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const channel = playlistChannel(playlist.playlistId);

  // Create a dedicated subscriber connection (ioredis requirement)
  const { Redis } = await import("ioredis");
  const subscriber = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  // Send initial snapshot of current source statuses
  const snapshot = {
    type: "snapshot",
    playlistId: playlist.playlistId,
    title: playlist.title,
    sources: sources.map((s) => ({
      sourceId: s._id,
      videoId: s.videoId,
      title: s.title,
      status: s.status,
    })),
  };
  res.write(`data: ${JSON.stringify(snapshot)}\n\n`);

  // Forward pub/sub events
  subscriber.subscribe(channel, (err) => {
    if (err) {
      logger.error("SSE subscriber error", { err: err.message });
      res.write(`event: error\ndata: ${JSON.stringify({ message: "Subscription failed" })}\n\n`);
      res.end();
      return;
    }
    logger.info(`SSE client connected to channel: ${channel}`);
  });

  subscriber.on("message", (_channel, message) => {
    try {
      res.write(`data: ${message}\n\n`);
    } catch (e) {
      logger.warn("SSE write failed — client likely disconnected");
    }
  });

  // Heartbeat every 20s to keep the connection alive through proxies
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 20_000);

  // Clean up on client disconnect
  const cleanup = () => {
    clearInterval(heartbeat);
    subscriber.unsubscribe(channel).catch(() => {});
    subscriber.quit().catch(() => {});
    logger.info(`SSE client disconnected from channel: ${channel}`);
  };

  req.on("close", cleanup);
  req.on("aborted", cleanup);
};
