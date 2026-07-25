import { Router } from "express";
import { authenticate } from "../auth/auth.middleware.js";
import { ownerScope } from "../../middlewares/ownerScope.js";
import { ingestionLimiter } from "../../middlewares/rateLimiter.js";
import * as sourceController from "./source.controller.js";

const router = Router({ mergeParams: true });

router.use(authenticate, ownerScope);

// ── Source listing ────────────────────────────────────────────────────────────
router.get("/", sourceController.getSources);
router.get("/graph", sourceController.getSourceGraph);

// ── File upload ───────────────────────────────────────────────────────────────
router.post(
  "/upload",
  ingestionLimiter,
  sourceController.uploadMiddleware,
  sourceController.uploadSource
);

// ── YouTube ───────────────────────────────────────────────────────────────────
// Primary entry point — classifies URL, handles single / playlist / ambiguous
router.post("/youtube", ingestionLimiter, sourceController.addYoutube);

// Explicit single-video ingest (used after user resolves an ambiguous URL)
router.post("/youtube/single", ingestionLimiter, sourceController.addYoutubeSingle);

// Explicit playlist ingest (used after user resolves an ambiguous URL)
router.post("/youtube/playlist", ingestionLimiter, sourceController.addYoutubePlaylist);

// ── Other source types ────────────────────────────────────────────────────────
router.post("/weblink", ingestionLimiter, sourceController.addWebLink);
router.post("/text", ingestionLimiter, sourceController.addText);

// ── Playlist progress ─────────────────────────────────────────────────────────
// REST poll — returns aggregated progress snapshot
router.get("/playlists/:pid/progress", sourceController.getPlaylistProgress);

// SSE stream — real-time per-video status updates
router.get("/playlists/:pid/stream", sourceController.streamPlaylist);

// ── Individual source ─────────────────────────────────────────────────────────
router.get("/:sid/status", sourceController.getSourceStatus);
router.delete("/:sid", sourceController.deleteSource);

export default router;
