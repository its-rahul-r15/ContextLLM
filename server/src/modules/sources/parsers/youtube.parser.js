import { YoutubeTranscript } from "youtube-transcript";
import axios from "axios";
import { logger } from "../../../utils/logger.js";

/**
 * Typed error so the worker can detect no-caption failures and
 * surface the "retry with audio?" prompt to the user.
 */
export class TranscriptUnavailableError extends Error {
  constructor(videoId) {
    super(`Transcript unavailable for video: ${videoId}`);
    this.name = "TranscriptUnavailableError";
    this.videoId = videoId;
  }
}

/**
 * Fetch lightweight metadata via YouTube oEmbed.
 * No API key, no quota — returns title, author (channel), thumbnail.
 */
export const fetchVideoMeta = async (videoId) => {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const { data } = await axios.get(url, { timeout: 8000 });
    return {
      title: data.title || `YouTube Video ${videoId}`,
      channel: data.author_name || null,
      thumbnailUrl: data.thumbnail_url || null,
    };
  } catch (err) {
    logger.warn(`oEmbed metadata fetch failed for ${videoId}: ${err.message}`);
    return { title: `YouTube Video ${videoId}`, channel: null, thumbnailUrl: null };
  }
};

/**
 * Main parser — takes a videoId (not a raw URL), returns:
 * { segments: [{ text, startTime, endTime }], meta: { title, channel, segmentCount } }
 *
 * Throws TranscriptUnavailableError if no captions exist.
 */
export const parseYoutube = async (videoId) => {
  // Fetch metadata (non-blocking on failure — returns defaults)
  const meta = await fetchVideoMeta(videoId);

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  let rawSegments;

  // Strategy: try English first, then detect available language, then no lang filter
  try {
    rawSegments = await YoutubeTranscript.fetchTranscript(watchUrl, { lang: "en" });
  } catch (firstErr) {
    // Try extracting the available language from the error message
    const langMatch = firstErr.message?.match(/Available languages?:\s*([\w,-]+)/i);
    if (langMatch && langMatch[1]) {
      const fallbackLang = langMatch[1].split(",")[0].trim();
      try {
        logger.info(`YouTube transcript: retrying with lang=${fallbackLang} for ${videoId}`);
        rawSegments = await YoutubeTranscript.fetchTranscript(watchUrl, { lang: fallbackLang });
      } catch {
        // Fall through to no-lang attempt
      }
    }

    if (!rawSegments) {
      try {
        // Last attempt: no language filter (picks whatever YouTube returns)
        rawSegments = await YoutubeTranscript.fetchTranscript(watchUrl);
      } catch (finalErr) {
        logger.error(`YouTube transcript unavailable for ${videoId}: ${finalErr.message}`);
        throw new TranscriptUnavailableError(videoId);
      }
    }
  }

  if (!rawSegments || rawSegments.length === 0) {
    throw new TranscriptUnavailableError(videoId);
  }

  // Normalise to { text, startTime (s), endTime (s) }
  // youtube-transcript returns offset in milliseconds, duration in ms
  const segments = rawSegments.map((s) => {
    const startSec = s.offset / 1000;
    const durSec = (s.duration ?? 0) / 1000;
    return {
      text: s.text.trim(),
      startTime: parseFloat(startSec.toFixed(2)),
      endTime: parseFloat((startSec + durSec).toFixed(2)),
    };
  }).filter((s) => s.text.length > 0);

  logger.info(`YouTube parser: ${segments.length} segments for videoId=${videoId}`);

  return {
    segments,
    meta: {
      ...meta,
      segmentCount: segments.length,
    },
  };
};
