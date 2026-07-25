import { Worker } from "bullmq";
import mongoose from "mongoose";
import { redisClient } from "../../config/redis.js";
import { Source } from "../../modules/sources/source.model.js";
import { Chunk } from "../../modules/chunks/chunk.model.js";
import { SOURCE_TYPES, SOURCE_STATUSES } from "../../constants/sourceTypes.js";
import { parsePdf } from "../../modules/sources/parsers/pdf.parser.js";
import { parseYoutube, TranscriptUnavailableError } from "../../modules/sources/parsers/youtube.parser.js";
import { parseWebLink, ReclassifyAsPdfError, UnsupportedContentTypeError } from "../../modules/sources/parsers/weblink.parser.js";
import { parseVtt } from "../../modules/sources/parsers/vtt.parser.js";
import { parseText } from "../../modules/sources/parsers/text.parser.js";
import { semanticChunk } from "../../modules/chunks/chunk.service.js";
import { embedBatch } from "../../integrations/qdrant.client.js";
import { logger } from "../../utils/logger.js";
import { ingestionQueue } from "../queues/ingestion.queue.js";
import { publishPlaylistProgress } from "../../modules/sources/playlist.sse.js";

const BATCH_SIZE = 20;

// ─── Status helpers ───────────────────────────────────────────────────────────

/**
 * Update source status and publish a Redis pub/sub event if this source
 * belongs to a playlist (so SSE consumers get live updates).
 */
const setStatus = async (sourceId, status, extra = {}) => {
  await Source.findByIdAndUpdate(sourceId, { status, ...extra });
};

const setStatusAndPublish = async (source, status, extra = {}) => {
  await setStatus(source._id, status, extra);

  if (source.playlistId) {
    await publishPlaylistProgress(source.playlistId, {
      type: "progress",
      sourceId: source._id,
      videoId: source.videoId,
      title: source.title,
      status,
    });
  }
};

// ─── Worker ───────────────────────────────────────────────────────────────────

export const ingestionWorker = new Worker(
  "ingestion",
  async (job) => {
    const { name, data } = job;
    logger.info(`Starting job: ${name} (ID: ${job.id})`);

    // ── PARSE ──────────────────────────────────────────────────────────────────
    if (name === "parse") {
      const { sourceId, type } = data;

      const source = await Source.findById(sourceId).lean();
      if (!source) throw new Error(`Source ${sourceId} not found`);

      await setStatusAndPublish(source, SOURCE_STATUSES.FETCHING);

      let parsed;

      if (type === SOURCE_TYPES.YOUTUBE) {
        // YouTube parser takes videoId — never a raw URL
        const videoId = data.videoId || source.videoId;
        if (!videoId) throw new Error(`No videoId for YouTube source ${sourceId}`);

        try {
          parsed = await parseYoutube(videoId);
        } catch (err) {
          if (err instanceof TranscriptUnavailableError) {
            // Surface to UI as a soft failure — user can trigger audio transcription
            await setStatusAndPublish(source, SOURCE_STATUSES.FAILED, {
              failureReason: "no_captions",
              processingError: "Transcript unavailable — no captions found for this video.",
            });
            logger.warn(`No captions for videoId=${videoId}, marked as failed (no_captions)`);
            return; // Don't throw — don't retry a permanently caption-less video
          }
          throw err; // Unknown error — retry
        }
      } else if (type === SOURCE_TYPES.PDF || type === SOURCE_TYPES.VTT) {
        const urlToParse = source.cloudinaryUrl || data.url || "";
        if (type === SOURCE_TYPES.PDF) parsed = await parsePdf(urlToParse);
        else parsed = await parseVtt(urlToParse);
      } else if (type === SOURCE_TYPES.WEBLINK) {
        const webUrl = data.url || source.originUrl;
        try {
          // Status: fetching → extracting (Readability runs synchronously after fetch)
          parsed = await parseWebLink(webUrl);
          // Update to extracting only if we haven't already resolved (Jina path resolves inline)
          await setStatusAndPublish(source, SOURCE_STATUSES.EXTRACTING);
        } catch (err) {
          if (err instanceof ReclassifyAsPdfError) {
            // URL is actually a PDF — reclassify and re-queue for the PDF parser
            logger.info(`Reclassifying weblink as PDF: ${webUrl} (sourceId=${sourceId})`);
            await Source.findByIdAndUpdate(sourceId, { type: SOURCE_TYPES.PDF });
            await ingestionQueue.add("parse", { sourceId, type: SOURCE_TYPES.PDF, url: webUrl, notebookId: source.notebookId.toString() }, {
              jobId: `parse_pdf_${sourceId}`,
              attempts: 3,
              backoff: { type: "exponential", delay: 5000 },
            });
            return; // Don't throw — the re-queued PDF job will handle it
          }
          if (err instanceof UnsupportedContentTypeError) {
            // Image, video, audio submitted as a weblink — hard fail, no retry
            await setStatusAndPublish(source, SOURCE_STATUSES.FAILED, {
              failureReason: "unsupported_content_type",
              processingError: `Unsupported content type: ${err.contentType}`,
            });
            logger.warn(`Weblink unsupported content type: ${err.contentType} for ${webUrl}`);
            return;
          }
          if (err.failureReason === "blocked_by_robots") {
            await setStatusAndPublish(source, SOURCE_STATUSES.FAILED, {
              failureReason: "blocked_by_robots",
              processingError: "The website's robots.txt does not allow crawling this page.",
            });
            return;
          }
          if (err.failureReason === "extraction_failed") {
            await setStatusAndPublish(source, SOURCE_STATUSES.FAILED, {
              failureReason: "extraction_failed",
              processingError: "Could not extract readable content from this URL.",
            });
            return;
          }
          throw err; // Unknown error — retry
        }
      } else if (type === SOURCE_TYPES.TEXT) {
        parsed = await parseText(data.content);
      } else {
        throw new Error(`No parser for type: ${type}`);
      }

      const { segments, meta } = parsed;

      // Persist enriched metadata from the parser
      const metaUpdate = { meta: { ...source.meta, ...meta } };

      // Backfill title from OG/oEmbed if the source still has a placeholder title
      if (meta?.title && (source.title === source.originUrl || source.title?.startsWith("YouTube Video"))) {
        metaUpdate.title = meta.title;
      }
      // Write back canonicalUrl and fetchMethod from the weblink parser
      if (parsed.canonicalUrl) metaUpdate.canonicalUrl = parsed.canonicalUrl;
      if (parsed.fetchMethod) metaUpdate.fetchMethod = parsed.fetchMethod;

      await Source.findByIdAndUpdate(sourceId, metaUpdate);

      await setStatusAndPublish({ ...source, status: SOURCE_STATUSES.FETCHING }, SOURCE_STATUSES.CHUNKING);

      await ingestionQueue.add("chunk", {
        sourceId,
        notebookId: source.notebookId.toString(),
        ownerId: source.ownerId.toString(),
        playlistId: source.playlistId || null,
        videoId: source.videoId || null,
        title: source.title,
        segments,
      }, {
        jobId: `chunk_${sourceId}`,
      });

      logger.info(`Parse complete for source ${sourceId} (${type}), segments: ${segments.length}`);
    }

    // ── CHUNK ──────────────────────────────────────────────────────────────────
    else if (name === "chunk") {
      const { sourceId, notebookId, ownerId, segments, playlistId, videoId, title } = data;

      const { parentChunks, childChunks } = semanticChunk(segments);

      const sourceObjectId = new mongoose.Types.ObjectId(sourceId);
      const notebookObjectId = new mongoose.Types.ObjectId(notebookId);
      const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

      const insertedParents = await Chunk.insertMany(
        parentChunks.map((c) => ({
          sourceId: sourceObjectId,
          notebookId: notebookObjectId,
          ownerId: ownerObjectId,
          text: c.text,
          location: c.location,
          tokenCount: c.tokenCount,
          isParent: true,
          embedding: [],
        })),
        { ordered: false }
      );

      const parentIdMap = {};
      insertedParents.forEach((doc, idx) => {
        parentIdMap[parentChunks[idx]._parentRef ?? idx] = doc._id;
      });

      if (childChunks.length > 0) {
        await Chunk.insertMany(
          childChunks.map((c) => ({
            sourceId: sourceObjectId,
            notebookId: notebookObjectId,
            ownerId: ownerObjectId,
            text: c.text,
            location: c.location,
            tokenCount: c.tokenCount,
            isParent: false,
            parentChunkId: parentIdMap[c._parentRef] ?? null,
            embedding: [],
          })),
          { ordered: false }
        );
      }

      // Publish status before queuing the embed job
      const sourceSnap = { _id: sourceId, playlistId, videoId, title };
      await setStatusAndPublish(sourceSnap, SOURCE_STATUSES.EMBEDDING);

      await ingestionQueue.add("embed", {
        sourceId,
        playlistId: playlistId || null,
        videoId: videoId || null,
        title: title || null,
      }, {
        jobId: `embed_${sourceId}`,
      });

      logger.info(`Chunk complete for source ${sourceId}, parents: ${parentChunks.length}, children: ${childChunks.length}`);
    }

    // ── EMBED ──────────────────────────────────────────────────────────────────
    else if (name === "embed") {
      const { sourceId, playlistId, videoId, title } = data;

      const chunks = await Chunk.find({ sourceId, isParent: false, embedding: { $size: 0 } }).lean();

      if (chunks.length === 0) {
        const sourceSnap = { _id: sourceId, playlistId, videoId, title };
        await setStatusAndPublish(sourceSnap, SOURCE_STATUSES.READY);
        logger.info(`Embed skipped (no empty chunks) for source ${sourceId} — marked ready`);
        return;
      }

      logger.info(`Embedding ${chunks.length} chunks in batches of ${BATCH_SIZE} for source ${sourceId}`);
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const texts = batch.map((c) => c.text);
        const embeddings = await embedBatch(texts);

        const bulkOps = batch.map((chunk, idx) => ({
          updateOne: {
            filter: { _id: chunk._id },
            update: { $set: { embedding: embeddings[idx] } },
          },
        }));

        await Chunk.bulkWrite(bulkOps);
        logger.debug(`Embedded batch ${Math.floor(i / BATCH_SIZE) + 1} for source ${sourceId}`);
      }

      const sourceSnap = { _id: sourceId, playlistId, videoId, title };
      await setStatusAndPublish(sourceSnap, SOURCE_STATUSES.READY);
      logger.info(`Embed complete for source ${sourceId}, total: ${chunks.length} chunks`);
    }
  },
  {
    connection: redisClient,
    // Cap at 5 concurrent workers — safe for YouTube transcript rate limits + embedding API
    concurrency: 5,
    // Extra safety net: no more than 10 jobs/second across all workers
    limiter: { max: 10, duration: 1000 },
  }
);

// ─── Error handling ───────────────────────────────────────────────────────────

ingestionWorker.on("failed", async (job, err) => {
  logger.error(`Job failed: ${job?.name} (ID: ${job?.id})`, { err: err.message });

  const sourceId = job?.data?.sourceId;
  const playlistId = job?.data?.playlistId;
  const videoId = job?.data?.videoId;
  const title = job?.data?.title;
  const attempts = job?.attemptsMade ?? 0;
  const maxAttempts = job?.opts?.attempts ?? 3;

  if (sourceId && attempts >= maxAttempts) {
    // Exhausted all retries — mark as failed and surface to UI
    const update = {
      status: SOURCE_STATUSES.FAILED,
      processingError: err.message,
      failureReason: "processing_error",
      retryCount: attempts,
    };
    await Source.findByIdAndUpdate(sourceId, update);

    if (playlistId) {
      await publishPlaylistProgress(playlistId, {
        type: "progress",
        sourceId,
        videoId,
        title,
        status: SOURCE_STATUSES.FAILED,
        reason: err.message,
      });
    }
  } else if (sourceId) {
    // Still retrying — just increment the counter
    await Source.findByIdAndUpdate(sourceId, { $inc: { retryCount: 1 } });
  }
});

ingestionWorker.on("completed", (job) => {
  logger.debug(`Job completed: ${job.name} (ID: ${job.id})`);
});
