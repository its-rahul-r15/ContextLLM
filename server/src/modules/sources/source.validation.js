import { z } from "zod";

export const youtubeSourceSchema = z.object({
  url: z.string().url().refine((u) => u.includes("youtube.com") || u.includes("youtu.be"), {
    message: "Must be a valid YouTube URL",
  }),
  title: z.string().min(1).max(200).optional(),
});

// Explicit playlist submission (after user resolves an ambiguous URL)
export const youtubePlaylistSchema = z.object({
  listId: z.string().min(1, "Playlist ID is required"),
});

export const webLinkSourceSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1).max(200).optional(),
});

export const textSourceSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(500000),
});
