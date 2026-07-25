import mongoose from "mongoose";
import { SOURCE_TYPES, SOURCE_STATUSES } from "../../constants/sourceTypes.js";

const sourceSchema = new mongoose.Schema(
  {
    notebookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notebook",
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(SOURCE_TYPES),
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(SOURCE_STATUSES),
      default: SOURCE_STATUSES.PENDING,
    },
    // File-based sources
    cloudinaryPublicId: {
      type: String,
      default: null,
    },
    cloudinaryUrl: {
      type: String,
      default: null,
    },
    originUrl: {
      type: String,
      default: null,
    },
    // Weblink: normalized canonical URL — used for dedup (strips utm_*, trailing slashes, etc.)
    canonicalUrl: {
      type: String,
      default: null,
    },
    // Weblink: which fetch path was used — 'static' | 'jina' | 'headless'
    fetchMethod: {
      type: String,
      enum: ["static", "jina", "headless", null],
      default: null,
    },
    // YouTube-specific fields
    videoId: {
      type: String,
      default: null,
      index: true,
    },
    playlistId: {
      type: String,
      default: null,
    },
    position: {
      type: Number,
      default: null,
    },
    // Processing metadata
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    processingError: {
      type: String,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

sourceSchema.index({ notebookId: 1, createdAt: -1 });
sourceSchema.index({ status: 1 });
// Dedup: one video per user (reuse embeddings on re-add)
sourceSchema.index({ ownerId: 1, videoId: 1 }, { sparse: true });
// Dedup: one weblink per user per canonical URL
sourceSchema.index({ ownerId: 1, canonicalUrl: 1 }, { sparse: true });

export const Source = mongoose.model("Source", sourceSchema);

