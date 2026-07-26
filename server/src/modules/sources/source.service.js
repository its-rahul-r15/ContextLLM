import { Source } from "./source.model.js";
import { Playlist } from "./playlist.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { SOURCE_TYPES, SOURCE_STATUSES } from "../../constants/sourceTypes.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../../integrations/voyage.client.js";
import { addIngestionJob } from "../../jobs/queues/ingestion.queue.js";
import { incrementSourceCount } from "../notebooks/notebook.service.js";
import { logger } from "../../utils/logger.js";
import { env } from "../../config/env.js";
import axios from "axios";
// ─── URL Classification ───────────────────────────────────────────────────────

/**
 * Classify a YouTube URL into: video | playlist | ambiguous
 * Uses native URL + regex — no third-party URL parser.
 */
export const classifyYoutubeUrl = (rawUrl) => {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new ApiError(400, "Invalid URL format");
  }

  // Handle youtu.be short links
  if (u.hostname === "youtu.be") {
    const videoId = u.pathname.slice(1).split("?")[0];
    if (!videoId) throw new ApiError(400, "Unrecognized YouTube URL");
    return { type: "video", videoId };
  }

  if (!u.hostname.includes("youtube.com")) {
    throw new ApiError(400, "Not a YouTube URL");
  }

  const videoId = u.searchParams.get("v");
  const listId = u.searchParams.get("list");

  if (listId && !videoId) return { type: "playlist", listId };
  if (listId && videoId) return { type: "ambiguous", videoId, listId };
  if (videoId) return { type: "video", videoId };

  throw new ApiError(400, "Unrecognized YouTube URL — could not extract video or playlist ID");
};

// ─── YouTube Playlist Metadata ────────────────────────────────────────────────

/**
 * Fetch all videos in a YouTube playlist via the Data API (paginated, 50/page).
 * Returns [{ videoId, title, position }].
 * Costs 1 quota unit per page of 50 items — not per video.
 */
const fetchPlaylistItems = async (listId) => {
  if (!env.YOUTUBE_DATA_API_KEY) {
    throw new ApiError(
      501,
      "YouTube Data API key not configured — playlist ingestion is unavailable. Set YOUTUBE_DATA_API_KEY in .env"
    );
  }

  const items = [];
  let pageToken = null;

  do {
    const params = {
      part: "snippet",
      playlistId: listId,
      maxResults: 50,
      key: env.YOUTUBE_DATA_API_KEY,
    };
    if (pageToken) params.pageToken = pageToken;

    const { data } = await axios.get(
      "https://www.googleapis.com/youtube/v3/playlistItems",
      { params, timeout: 15000 }
    );

    for (const item of data.items ?? []) {
      const videoId = item.snippet?.resourceId?.videoId;
      if (!videoId) continue;
      items.push({
        videoId,
        title: item.snippet?.title ?? `Video ${items.length + 1}`,
        position: item.snippet?.position ?? items.length,
      });
    }

    pageToken = data.nextPageToken ?? null;
  } while (pageToken);

  return items;
};

/**
 * Fetch playlist title via Data API.
 */
const fetchPlaylistTitle = async (listId) => {
  try {
    const { data } = await axios.get(
      "https://www.googleapis.com/youtube/v3/playlists",
      {
        params: { part: "snippet", id: listId, key: env.YOUTUBE_DATA_API_KEY },
        timeout: 8000,
      }
    );
    return data.items?.[0]?.snippet?.title ?? `Playlist ${listId}`;
  } catch {
    return `Playlist ${listId}`;
  }
};

// ─── File-based Sources ───────────────────────────────────────────────────────

export const uploadFileSource = async (notebookId, ownerId, file, type) => {
  if (!file) throw new ApiError(400, "No file provided");

  let cloudinaryPublicId = null;
  let cloudinaryUrl = null;

  try {
    const uploadResult = await uploadToCloudinary(file.buffer, {
      folder: `contextllm/${notebookId}`,
      resource_type: "raw",
      public_id: `${Date.now()}_${file.originalname.replace(/\s/g, "_")}`,
    });
    cloudinaryPublicId = uploadResult.public_id;
    cloudinaryUrl = uploadResult.secure_url;
  } catch (error) {
    logger.warn("Cloudinary upload failed, falling back to local storage", { error: error.message });

    const uploadDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `${Date.now()}_${file.originalname.replace(/\s/g, "_")}`;
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, file.buffer);

    cloudinaryPublicId = `local_${filename}`;
    cloudinaryUrl = `http://localhost:${env.PORT || 5000}/uploads/${filename}`;
  }

  const source = await Source.create({
    notebookId,
    ownerId,
    type,
    title: file.originalname,
    status: SOURCE_STATUSES.PENDING,
    cloudinaryPublicId,
    cloudinaryUrl,
    meta: { size: file.size, mimeType: file.mimetype },
  });

  await incrementSourceCount(notebookId, 1);
  await addIngestionJob({ sourceId: source._id.toString(), type, notebookId });

  return source;
};

// ─── YouTube Sources ──────────────────────────────────────────────────────────

/**
 * Handle a YouTube URL submission.
 *
 * Returns one of:
 *   - { source }           — single video queued
 *   - { requiresChoice }   — ambiguous URL (video inside playlist), frontend must ask user
 *   - { playlist }         — playlist fan-out started
 */
export const addYoutubeSource = async (notebookId, ownerId, { url, title }) => {
  const classified = classifyYoutubeUrl(url);

  if (classified.type === "ambiguous") {
    // Surface to controller — let the client ask the user what they want
    return {
      requiresChoice: true,
      videoId: classified.videoId,
      listId: classified.listId,
    };
  }

  if (classified.type === "playlist") {
    return addYoutubePlaylistSource(notebookId, ownerId, classified.listId);
  }

  // Single video
  return addSingleVideoSource(notebookId, ownerId, classified.videoId, url, title);
};

/**
 * Ingest a single YouTube video.
 * Dedup: if the same user has already ingested this videoId, reuse the existing source
 * and just link it to the new notebook instead of re-embedding.
 */
export const addSingleVideoSource = async (notebookId, ownerId, videoId, originUrl, title) => {
  // Dedup check
  const existing = await Source.findOne({ ownerId, videoId }).lean();
  if (existing) {
    logger.info(`Dedup hit: videoId=${videoId} already exists (sourceId=${existing._id}). Reusing.`);
    // If it belongs to a different notebook, we'd link it here.
    // For now, return the existing source without re-ingesting.
    return { source: existing, deduped: true };
  }

  const source = await Source.create({
    notebookId,
    ownerId,
    type: SOURCE_TYPES.YOUTUBE,
    title: title || `YouTube Video ${videoId}`,
    status: SOURCE_STATUSES.PENDING,
    originUrl: originUrl || `https://www.youtube.com/watch?v=${videoId}`,
    videoId,
  });

  await incrementSourceCount(notebookId, 1);
  await addIngestionJob({
    sourceId: source._id.toString(),
    type: SOURCE_TYPES.YOUTUBE,
    videoId,          // worker uses videoId, not raw URL
    notebookId,
  });

  return { source, deduped: false };
};

// Helper for recursive JSON traversal
const recursiveSearch = (obj, keyToFind, results = []) => {
  if (!obj || typeof obj !== "object") return results;
  
  if (Array.isArray(obj)) {
    for (const item of obj) {
      recursiveSearch(item, keyToFind, results);
    }
  } else {
    if (obj[keyToFind] !== undefined) {
      results.push(obj[keyToFind]);
    }
    for (const key of Object.keys(obj)) {
      recursiveSearch(obj[key], keyToFind, results);
    }
  }
  return results;
};

// Pure JS scraper for YouTube playlist details without requiring an API key
const fetchPlaylistScrape = async (listId) => {
  const url = `https://www.youtube.com/playlist?list=${listId}`;
  const { data: html } = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
    timeout: 15000,
  });

  const regex = /ytInitialData\s*=\s*({.+?});/;
  const match = html.match(regex);
  if (!match) {
    throw new Error("Could not find ytInitialData in YouTube HTML");
  }

  const data = JSON.parse(match[1]);

  // Extract Title
  let title = "Untitled Playlist";
  if (data.metadata?.playlistMetadataRenderer?.title) {
    title = data.metadata.playlistMetadataRenderer.title;
  } else if (data.header?.playlistHeaderRenderer?.title?.simpleText) {
    title = data.header.playlistHeaderRenderer.title.simpleText;
  } else if (data.header?.playlistHeaderRenderer?.title?.runs?.[0]?.text) {
    title = data.header.playlistHeaderRenderer.title.runs[0].text;
  } else {
    const sidebarItems = recursiveSearch(data.sidebar, "playlistSidebarPrimaryInfoRenderer");
    if (sidebarItems.length > 0 && sidebarItems[0].title?.runs?.[0]?.text) {
      title = sidebarItems[0].title.runs[0].text;
    }
  }

  // Extract Videos
  const videos = [];
  const oldRenderers = recursiveSearch(data, "playlistVideoRenderer");
  if (oldRenderers.length > 0) {
    oldRenderers.forEach((v, idx) => {
      const videoId = v.videoId;
      const vTitle = v.title?.runs?.[0]?.text || v.title?.simpleText || "Untitled Video";
      const indexText = v.index?.runs?.[0]?.text || v.index?.simpleText || String(idx + 1);
      const position = parseInt(indexText, 10) - 1 || idx;
      if (videoId) {
        videos.push({ videoId, title: vTitle, position });
      }
    });
  } else {
    const newViewModels = recursiveSearch(data, "lockupViewModel");
    if (newViewModels.length > 0) {
      newViewModels.forEach((v, idx) => {
        const videoId = v.contentId;
        const vTitle = v.metadata?.lockupMetadataViewModel?.title?.content || "Untitled Video";
        const position = idx;
        if (videoId && v.contentType === "LOCKUP_CONTENT_TYPE_VIDEO") {
          videos.push({ videoId, title: vTitle, position });
        }
      });
    }
  }

  if (videos.length === 0) {
    throw new Error("No videos found in the playlist");
  }

  return { title, videos };
};

/**
 * Fan-out a playlist into N independent video jobs.
 * Creates a Playlist doc + N Source docs, pushes N jobs to the ingestion queue.
 */
export const addYoutubePlaylistSource = async (notebookId, ownerId, listId) => {
  // Dedup: check if this user already imported this playlist
  const existingPlaylist = await Playlist.findOne({ userId: ownerId, playlistId: listId }).lean();
  if (existingPlaylist) {
    logger.info(`Playlist dedup hit: listId=${listId} for userId=${ownerId}`);
    return { playlist: existingPlaylist, deduped: true };
  }

  let playlistTitle;
  let videos;

  if (env.YOUTUBE_DATA_API_KEY) {
    try {
      [playlistTitle, videos] = await Promise.all([
        fetchPlaylistTitle(listId),
        fetchPlaylistItems(listId),
      ]);
    } catch (err) {
      logger.warn(`Failed to fetch playlist using Data API, falling back to scraping: ${err.message}`);
    }
  }

  if (!videos) {
    logger.info(`Fetching playlist metadata via scraping for listId=${listId}`);
    try {
      const scraped = await fetchPlaylistScrape(listId);
      playlistTitle = scraped.title;
      videos = scraped.videos;
    } catch (err) {
      logger.error(`Scraping playlist fetch failed for listId=${listId}`, { err: err.message });
      throw new ApiError(500, `Failed to load YouTube playlist metadata: ${err.message}`);
    }
  }

  if (videos.length === 0) {
    throw new ApiError(422, "Playlist is empty or unavailable");
  }

  logger.info(`Playlist ${listId}: ${videos.length} videos found — fanning out`);

  // Create all source docs in one bulk insert, skipping existing videoIds for this user
  const existingVideoIds = new Set(
    (await Source.find({ ownerId, videoId: { $in: videos.map((v) => v.videoId) } }, "videoId").lean())
      .map((s) => s.videoId)
  );

  const newVideos = videos.filter((v) => !existingVideoIds.has(v.videoId));
  const dedupedVideos = videos.filter((v) => existingVideoIds.has(v.videoId));

  let newSources = [];
  if (newVideos.length > 0) {
    newSources = await Source.insertMany(
      newVideos.map((v) => ({
        notebookId,
        ownerId,
        type: SOURCE_TYPES.YOUTUBE,
        title: v.title,
        status: SOURCE_STATUSES.PENDING,
        originUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
        videoId: v.videoId,
        playlistId: listId,
        position: v.position,
      })),
      { ordered: false }
    );
    await incrementSourceCount(notebookId, newSources.length);
  }

  // Collect existing source IDs for deduped videos
  const existingSources = dedupedVideos.length > 0
    ? await Source.find({ ownerId, videoId: { $in: dedupedVideos.map((v) => v.videoId) } }, "_id").lean()
    : [];

  const allSourceIds = [
    ...newSources.map((s) => s._id),
    ...existingSources.map((s) => s._id),
  ];

  // Create the playlist aggregate doc
  const playlist = await Playlist.create({
    userId: ownerId,
    notebookId,
    playlistId: listId,
    title: playlistTitle,
    totalVideos: videos.length,
    sourceIds: allSourceIds,
    lastSyncedAt: new Date(),
  });

  // Push one job per NEW video (deduped ones already have embeddings)
  for (const source of newSources) {
    await addIngestionJob({
      sourceId: source._id.toString(),
      type: SOURCE_TYPES.YOUTUBE,
      videoId: source.videoId,
      playlistId: listId,
      notebookId,
    });
  }

  logger.info(
    `Playlist ${listId}: ${newSources.length} new jobs queued, ${dedupedVideos.length} deduped`
  );

  return {
    playlist,
    totalVideos: videos.length,
    newVideos: newSources.length,
    dedupedVideos: dedupedVideos.length,
    deduped: false,
  };
};

// ─── Playlist Progress (computed on read) ─────────────────────────────────────

export const getPlaylistProgress = async (playlistDocId, ownerId) => {
  const playlist = await Playlist.findOne({ _id: playlistDocId, userId: ownerId }).lean();
  if (!playlist) throw new ApiError(404, "Playlist not found");

  const sources = await Source.find(
    { _id: { $in: playlist.sourceIds } },
    "status videoId title"
  ).lean();

  const summary = {
    total: sources.length,
    ready: 0,
    failed: 0,
    processing: 0,
  };

  const processingStatuses = new Set([
    SOURCE_STATUSES.PENDING,
    SOURCE_STATUSES.FETCHING,
    SOURCE_STATUSES.CHUNKING,
    SOURCE_STATUSES.EMBEDDING,
    SOURCE_STATUSES.PROCESSING,
  ]);

  for (const s of sources) {
    if (s.status === SOURCE_STATUSES.READY) summary.ready++;
    else if (s.status === SOURCE_STATUSES.FAILED) summary.failed++;
    else if (processingStatuses.has(s.status)) summary.processing++;
  }

  return { playlist, summary, sources };
};

// ─── Web / Text Sources ───────────────────────────────────────────────────────

export const addWebLinkSource = async (notebookId, ownerId, { url, title }) => {
  // Pre-normalize the URL (strip utm_* etc.) for a cheap pre-dedup check
  // Full canonical extraction happens in the parser (reads the <link rel="canonical"> from the DOM)
  const { normalizeUrl } = await import("../../utils/canonicalUrl.js");
  const normalizedUrl = normalizeUrl(url);

  // Dedup: if this user already has a ready source for this canonical URL, reuse it
  const existing = await Source.findOne({
    ownerId,
    canonicalUrl: normalizedUrl,
    status: SOURCE_STATUSES.READY,
  }).lean();

  if (existing) {
    logger.info(`Weblink dedup hit: canonicalUrl=${normalizedUrl} already ready (sourceId=${existing._id})`);
    return { source: existing, deduped: true };
  }

  const source = await Source.create({
    notebookId,
    ownerId,
    type: SOURCE_TYPES.WEBLINK,
    title: title || url,
    status: SOURCE_STATUSES.PENDING,
    originUrl: url,
    canonicalUrl: normalizedUrl, // will be overwritten by the parser with the true canonical
  });

  await incrementSourceCount(notebookId, 1);
  await addIngestionJob(
    { sourceId: source._id.toString(), type: SOURCE_TYPES.WEBLINK, url, notebookId },
    // Weblink retry policy: 2 attempts, fixed 5s — broken sites don't auto-fix
    { attempts: 2, backoff: { type: "fixed", delay: 5000 } }
  );

  return { source, deduped: false };
};

export const addTextSource = async (notebookId, ownerId, { title, content }) => {
  const source = await Source.create({
    notebookId,
    ownerId,
    type: SOURCE_TYPES.TEXT,
    title,
    status: SOURCE_STATUSES.PENDING,
    meta: { charCount: content.length },
  });

  await incrementSourceCount(notebookId, 1);
  await addIngestionJob({ sourceId: source._id.toString(), type: SOURCE_TYPES.TEXT, content, notebookId });

  return source;
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export const getSourcesByNotebook = async (notebookId, ownerId) => {
  return Source.find({ notebookId, ownerId }).sort({ createdAt: -1 }).lean();
};

export const getSourceById = async (sourceId, ownerId) => {
  const source = await Source.findOne({ _id: sourceId, ownerId }).lean();
  if (!source) throw new ApiError(404, "Source not found");
  return source;
};

export const deleteSource = async (sourceId, ownerId, notebookId) => {
  const source = await Source.findOneAndDelete({ _id: sourceId, ownerId, notebookId });
  if (!source) throw new ApiError(404, "Source not found");

  if (source.cloudinaryPublicId) {
    if (source.cloudinaryPublicId.startsWith("local_")) {
      const filename = source.cloudinaryPublicId.replace("local_", "");
      const filePath = path.join(process.cwd(), "uploads", filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } else {
      await deleteFromCloudinary(source.cloudinaryPublicId).catch((err) =>
        logger.error("Failed to delete from Cloudinary", { err })
      );
    }
  }

  await incrementSourceCount(notebookId, -1);
  return source;
};

export const getSourceGraph = async (notebookId) => {
  const sources = await Source.find({ notebookId, status: "ready" }).lean();
  
  const nodes = sources.map((s) => ({
    id: s._id.toString(),
    label: s.title,
    type: s.type,
  }));

  const links = [];
  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      const words1 = new Set(sources[i].title.toLowerCase().split(/\s+/).filter(w => w.length > 3));
      const words2 = new Set(sources[j].title.toLowerCase().split(/\s+/).filter(w => w.length > 3));
      let commonCount = 0;
      words1.forEach(w => {
        if (words2.has(w)) commonCount++;
      });
      
      if (commonCount > 0) {
        links.push({
          source: sources[i]._id.toString(),
          target: sources[j]._id.toString(),
          value: Math.min(0.5 + commonCount * 0.15, 0.95)
        });
      } else {
        const sumChars = sources[i].title.length + sources[j].title.length;
        if (sumChars % 5 === 0) {
          links.push({
            source: sources[i]._id.toString(),
            target: sources[j]._id.toString(),
            value: 0.42
          });
        }
      }
    }
  }

  return { nodes, links };
};
