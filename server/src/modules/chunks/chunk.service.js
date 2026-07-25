const TARGET_TOKENS = 400;
const OVERLAP_TOKENS = 60;
const AVG_CHARS_PER_TOKEN = 4;

// YouTube: merge segments until this gap (seconds) — natural pause boundary
const TRANSCRIPT_GAP_THRESHOLD_SEC = 3;

const estimateTokens = (text) => Math.ceil(text.length / AVG_CHARS_PER_TOKEN);

/**
 * Determines if a segment is a YouTube timed segment
 * (has startTime/endTime) vs a PDF/text segment (has pageNumber/paragraphIndex).
 */
const isTranscriptSegment = (segment) =>
  typeof segment.startTime === "number" && typeof segment.endTime === "number";

/**
 * Merge consecutive transcript segments into ~400-token semantic chunks.
 * Merges on two conditions: token budget OR natural pause (>3s gap).
 * Returns chunks with { text, startTime, endTime }.
 */
const mergeTranscriptSegments = (segments) => {
  const chunks = [];
  let buffer = [];
  let bufferTokens = 0;

  const flushBuffer = () => {
    if (buffer.length === 0) return;
    const text = buffer.map((s) => s.text).join(" ");
    chunks.push({
      text,
      startTime: buffer[0].startTime,
      endTime: buffer[buffer.length - 1].endTime,
      tokenCount: bufferTokens,
    });
    buffer = [];
    bufferTokens = 0;
  };

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segTokens = estimateTokens(seg.text);

    // Check for natural pause from the previous segment
    if (buffer.length > 0) {
      const prev = buffer[buffer.length - 1];
      const gap = seg.startTime - prev.endTime;
      if (gap > TRANSCRIPT_GAP_THRESHOLD_SEC) {
        flushBuffer();
      }
    }

    // Flush if adding this segment exceeds the token budget
    if (bufferTokens + segTokens > TARGET_TOKENS * 1.5 && buffer.length > 0) {
      flushBuffer();
    }

    buffer.push(seg);
    bufferTokens += segTokens;
  }

  flushBuffer();
  return chunks;
};

/**
 * Builds the location object from a segment — handles both PDF/text and YouTube segments.
 */
const buildLocation = (segment) => ({
  pageNumber: segment.pageNumber ?? null,
  timestamp: segment.timestamp ?? null,
  paragraphIndex: segment.paragraphIndex ?? null,
  startTime: segment.startTime ?? null,
  endTime: segment.endTime ?? null,
});

/**
 * Main chunking function.
 *
 * For YouTube transcript segments (have startTime/endTime):
 *   → merge into ~400 token semantic chunks separated by natural pauses
 *   → each chunk gets a startTime + endTime for citation
 *
 * For all other sources (PDF paragraphs, text blocks, VTT, etc.):
 *   → existing small/large segment logic unchanged
 */
export const semanticChunk = (segments) => {
  if (segments.length === 0) return { parentChunks: [], childChunks: [] };

  // Route: YouTube timed transcript vs everything else
  if (isTranscriptSegment(segments[0])) {
    return chunkTranscript(segments);
  }

  return chunkGeneric(segments);
};

const chunkTranscript = (segments) => {
  const parentChunks = [];
  const childChunks = [];

  const merged = mergeTranscriptSegments(segments);

  for (let i = 0; i < merged.length; i++) {
    const chunk = merged[i];
    const tokenCount = chunk.tokenCount ?? estimateTokens(chunk.text);
    const location = {
      pageNumber: null,
      timestamp: chunk.startTime,   // keep backward-compat timestamp = startTime
      paragraphIndex: null,
      startTime: chunk.startTime,
      endTime: chunk.endTime,
    };

    if (tokenCount <= TARGET_TOKENS * 1.5) {
      parentChunks.push({ text: chunk.text, tokenCount, location, isParent: true, _parentRef: i });
      childChunks.push({ text: chunk.text, tokenCount, location, isParent: false, _parentRef: i });
    } else {
      // Large chunk — store full text as parent, split into overlapping children
      parentChunks.push({ text: chunk.text, tokenCount, location, isParent: true, _parentRef: parentChunks.length });
      const words = chunk.text.split(/\s+/);
      const targetWords = Math.floor((TARGET_TOKENS * AVG_CHARS_PER_TOKEN) / 5);
      const overlapWords = Math.floor(targetWords * (OVERLAP_TOKENS / TARGET_TOKENS));
      let j = 0;
      const parentRef = parentChunks.length - 1;
      while (j < words.length) {
        const sliceEnd = Math.min(j + targetWords, words.length);
        const childText = words.slice(j, sliceEnd).join(" ");
        childChunks.push({
          text: childText,
          tokenCount: estimateTokens(childText),
          location,
          isParent: false,
          _parentRef: parentRef,
        });
        j += targetWords - overlapWords;
      }
    }
  }

  return { parentChunks, childChunks };
};

const chunkGeneric = (segments) => {
  const parentChunks = [];
  const childChunks = [];

  for (const segment of segments) {
    const text = segment.text.trim();
    if (!text) continue;

    const tokenCount = estimateTokens(text);

    if (tokenCount <= TARGET_TOKENS * 1.5) {
      const parentRef = parentChunks.length;
      parentChunks.push({
        text,
        tokenCount,
        location: buildLocation(segment),
        isParent: true,
        _parentRef: parentRef,
      });
      childChunks.push({
        text,
        tokenCount,
        location: buildLocation(segment),
        isParent: false,
        _parentRef: parentRef,
      });
    } else {
      const words = text.split(/\s+/);
      const targetWords = TARGET_TOKENS * AVG_CHARS_PER_TOKEN / 5;
      const overlapWords = Math.floor(targetWords * (OVERLAP_TOKENS / TARGET_TOKENS));

      let i = 0;
      const parentLocation = buildLocation(segment);
      parentChunks.push({
        text,
        tokenCount,
        location: parentLocation,
        isParent: true,
        _parentRef: parentChunks.length,
      });

      while (i < words.length) {
        const sliceEnd = Math.min(i + targetWords, words.length);
        const chunkText = words.slice(i, sliceEnd).join(" ");
        childChunks.push({
          text: chunkText,
          tokenCount: estimateTokens(chunkText),
          location: parentLocation,
          isParent: false,
          _parentRef: parentChunks.length - 1,
        });
        i += targetWords - overlapWords;
      }
    }
  }

  return { parentChunks, childChunks };
};
