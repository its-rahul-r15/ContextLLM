import multer from "multer";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as sourceService from "./source.service.js";
import { SOURCE_TYPES, ACCEPTED_MIME_TYPES } from "../../constants/sourceTypes.js";
import { youtubeSourceSchema, youtubePlaylistSchema, webLinkSourceSchema, textSourceSchema } from "./source.validation.js";
import { streamPlaylistProgress } from "./playlist.sse.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allAllowed = Object.values(ACCEPTED_MIME_TYPES).flat();
    if (allAllowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError(415, `Unsupported file type: ${file.mimetype}`));
    }
  },
});

export const uploadMiddleware = upload.single("file");

const detectFileType = (mimetype) => {
  if (ACCEPTED_MIME_TYPES[SOURCE_TYPES.PDF].includes(mimetype)) return SOURCE_TYPES.PDF;
  if (ACCEPTED_MIME_TYPES[SOURCE_TYPES.VTT].includes(mimetype)) return SOURCE_TYPES.VTT;
  return SOURCE_TYPES.TEXT;
};

export const uploadSource = asyncHandler(async (req, res) => {
  const { nid } = req.params;
  const type = detectFileType(req.file.mimetype);
  const source = await sourceService.uploadFileSource(nid, req.user._id, req.file, type);
  new ApiResponse(202, "Source uploaded and queued for processing", source).send(res);
});

/**
 * POST /api/notebooks/:nid/sources/youtube
 *
 * Handles three outcomes:
 *  1. Single video    → 202 with source
 *  2. Ambiguous URL   → 200 with { requiresChoice: true, videoId, listId }
 *  3. Playlist URL    → 202 with playlist summary (or no API key → 501)
 */
export const addYoutube = asyncHandler(async (req, res) => {
  const body = youtubeSourceSchema.safeParse(req.body);
  if (!body.success) throw new ApiError(422, "Validation failed", body.error.errors);

  const result = await sourceService.addYoutubeSource(req.params.nid, req.user._id, body.data);

  // Ambiguous URL — frontend needs to ask the user what they want
  if (result.requiresChoice) {
    return new ApiResponse(200, "URL is ambiguous — please specify single video or full playlist", {
      requiresChoice: true,
      videoId: result.videoId,
      listId: result.listId,
    }).send(res);
  }

  // Playlist fan-out
  if (result.playlist) {
    if (result.deduped) {
      return new ApiResponse(200, "Playlist already imported", result.playlist).send(res);
    }
    return new ApiResponse(202, `${result.newVideos} videos queued, ${result.dedupedVideos} reused`, {
      playlist: result.playlist,
      totalVideos: result.totalVideos,
      newVideos: result.newVideos,
      dedupedVideos: result.dedupedVideos,
    }).send(res);
  }

  // Single video
  if (result.deduped) {
    return new ApiResponse(200, "Video already imported — reusing existing source", result.source).send(res);
  }

  new ApiResponse(202, "YouTube video queued for processing", result.source).send(res);
});

/**
 * POST /api/notebooks/:nid/sources/youtube/playlist
 *
 * Explicit playlist ingest — called after user resolves an ambiguous URL
 * OR when they directly submit a playlist URL and want to force the playlist flow.
 */
export const addYoutubePlaylist = asyncHandler(async (req, res) => {
  const body = youtubePlaylistSchema.safeParse(req.body);
  if (!body.success) throw new ApiError(422, "Validation failed", body.error.errors);

  const result = await sourceService.addYoutubePlaylistSource(
    req.params.nid,
    req.user._id,
    body.data.listId
  );

  if (result.deduped) {
    return new ApiResponse(200, "Playlist already imported", result.playlist).send(res);
  }

  new ApiResponse(202, `${result.newVideos} videos queued, ${result.dedupedVideos} reused`, {
    playlist: result.playlist,
    totalVideos: result.totalVideos,
    newVideos: result.newVideos,
    dedupedVideos: result.dedupedVideos,
  }).send(res);
});

/**
 * POST /api/notebooks/:nid/sources/youtube/single
 *
 * Explicit single-video ingest — called after user resolves an ambiguous URL
 * and chooses "just this video".
 */
export const addYoutubeSingle = asyncHandler(async (req, res) => {
  const { videoId } = req.body;
  if (!videoId) throw new ApiError(422, "videoId is required");

  const originUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const result = await sourceService.addSingleVideoSource(
    req.params.nid,
    req.user._id,
    videoId,
    originUrl,
    null
  );

  if (result.deduped) {
    return new ApiResponse(200, "Video already imported — reusing existing source", result.source).send(res);
  }
  new ApiResponse(202, "YouTube video queued for processing", result.source).send(res);
});

export const addWebLink = asyncHandler(async (req, res) => {
  const body = webLinkSourceSchema.safeParse(req.body);
  if (!body.success) throw new ApiError(422, "Validation failed", body.error.errors);
  const result = await sourceService.addWebLinkSource(req.params.nid, req.user._id, body.data);
  if (result.deduped) {
    return new ApiResponse(200, "URL already imported — reusing existing source", result.source).send(res);
  }
  new ApiResponse(202, "Web link source queued for processing", result.source).send(res);
});

export const addText = asyncHandler(async (req, res) => {
  const body = textSourceSchema.safeParse(req.body);
  if (!body.success) throw new ApiError(422, "Validation failed", body.error.errors);
  const source = await sourceService.addTextSource(req.params.nid, req.user._id, body.data);
  new ApiResponse(202, "Text source queued for processing", source).send(res);
});

export const getSources = asyncHandler(async (req, res) => {
  const sources = await sourceService.getSourcesByNotebook(req.params.nid, req.user._id);
  new ApiResponse(200, "Sources fetched", sources).send(res);
});

export const getSourceStatus = asyncHandler(async (req, res) => {
  const source = await sourceService.getSourceById(req.params.sid, req.user._id);
  new ApiResponse(200, "Source status", {
    _id: source._id,
    status: source.status,
    processingError: source.processingError || null,
    failureReason: source.failureReason || null,
    title: source.title,
    type: source.type,
    meta: source.meta,
    videoId: source.videoId || null,
  }).send(res);
});

export const deleteSource = asyncHandler(async (req, res) => {
  await sourceService.deleteSource(req.params.sid, req.user._id, req.params.nid);
  new ApiResponse(200, "Source deleted").send(res);
});

/**
 * GET /api/notebooks/:nid/sources/playlists/:pid/progress
 *
 * Returns aggregated playlist progress (computed on read, not stored).
 */
export const getPlaylistProgress = asyncHandler(async (req, res) => {
  const { summary, playlist, sources } = await sourceService.getPlaylistProgress(
    req.params.pid,
    req.user._id
  );
  new ApiResponse(200, "Playlist progress", { playlist, summary, sources }).send(res);
});

/**
 * GET /api/notebooks/:nid/sources/playlists/:pid/stream
 *
 * SSE endpoint — streams real-time per-video status updates.
 * Client opens ONE connection per playlist import, not per video.
 */
export const streamPlaylist = asyncHandler(async (req, res) => {
  const { playlist, sources } = await sourceService.getPlaylistProgress(
    req.params.pid,
    req.user._id
  );
  // Hands off to SSE module — does not call res.send/end itself
  await streamPlaylistProgress(req, res, playlist, sources);
});

export const getSourceGraph = asyncHandler(async (req, res) => {
  const graph = await sourceService.getSourceGraph(req.params.nid);
  new ApiResponse(200, "Source graph computed", graph).send(res);
});
