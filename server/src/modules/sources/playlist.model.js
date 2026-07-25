import mongoose from "mongoose";

/**
 * Playlist doc — one per (userId, playlistId) pair.
 * Stores metadata fetched from YouTube Data API and refs to
 * individual video source docs created during fan-out.
 *
 * playlistProgress is computed on-read from the sourceIds — never stored.
 */
const playlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    notebookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notebook",
      required: true,
      index: true,
    },
    playlistId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      default: "Untitled Playlist",
    },
    totalVideos: {
      type: Number,
      default: 0,
    },
    sourceIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Source",
      },
    ],
    lastSyncedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// One playlist per user (for dedup on re-submit)
playlistSchema.index({ userId: 1, playlistId: 1 }, { unique: true });

export const Playlist = mongoose.model("Playlist", playlistSchema);
