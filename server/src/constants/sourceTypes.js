export const SOURCE_TYPES = Object.freeze({
  PDF: "pdf",
  YOUTUBE: "youtube",
  YOUTUBE_PLAYLIST: "youtube_playlist",
  WEBLINK: "weblink",
  TEXT: "text",
  VTT: "vtt",
});

export const SOURCE_STATUSES = Object.freeze({
  PENDING: "pending",
  PROCESSING: "processing",
  // Granular in-progress statuses
  FETCHING: "fetching",       // HTTP fetch in progress (all types)
  RENDERING: "rendering",     // Weblink: Jina.ai / headless fallback render
  EXTRACTING: "extracting",   // Weblink: Readability content extraction
  CHUNKING: "chunking",       // Splitting into chunks
  EMBEDDING: "embedding",     // Batch embedding
  READY: "ready",
  FAILED: "failed",
});

export const ACCEPTED_MIME_TYPES = Object.freeze({
  [SOURCE_TYPES.PDF]: ["application/pdf"],
  [SOURCE_TYPES.VTT]: ["text/vtt", "text/plain"],
  [SOURCE_TYPES.TEXT]: ["text/plain"],
});
