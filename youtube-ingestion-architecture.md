# YouTube Ingestion Architecture — Single Video & Playlist (Production-grade)

Covers URL classification, transcript acquisition, playlist fan-out, quota management, retries, dedup, and status tracking. Designed to slot into the `sources` module of the main RAG architecture.

---

## 1. URL classification (entry point)

Every submitted YouTube URL hits `POST /api/sources/youtube` first. Classify before doing anything else:

```
watch?v=VIDEO_ID              → single video
playlist?list=PLAYLIST_ID     → pure playlist
watch?v=VIDEO_ID&list=PL...   → video within a playlist context — ask user:
                                 "add just this video, or the whole playlist?"
```

Use `URL` parsing + regex on `v` and `list` query params — don't rely on a third-party URL parser lib for this, it's a 10-line regex and one less dependency.

```js
function classifyYoutubeUrl(url) {
  const u = new URL(url);
  const videoId = u.searchParams.get('v');
  const listId = u.searchParams.get('list');
  if (listId && !videoId) return { type: 'playlist', listId };
  if (listId && videoId) return { type: 'ambiguous', videoId, listId };
  if (videoId) return { type: 'video', videoId };
  throw new ApiError(400, 'Unrecognized YouTube URL');
}
```

---

## 2. Single video flow

```
Client submits URL
  → classify → type: video
  → create `sources` doc { type: youtube, videoId, status: pending }
  → respond 202 immediately with sourceId (don't block the request)
  → push job to `ingestion` queue
  → worker picks up job:
      1. fetch metadata (title, duration, channel) — YouTube oEmbed endpoint (no API key/quota needed)
      2. fetch transcript (see §4)
      3. chunk transcript (see §5)
      4. batch-embed chunks
      5. index into vector DB
      6. status → ready
  → client gets live status via SSE/polling on sourceId
```

**Why 202 + async, even for one video**: transcript fetch + embedding for a 1-hour video can take 5-15s. Never make the HTTP request wait on this — same async pattern as PDFs, just simpler (one job instead of N).

---

## 3. Playlist flow (production concerns)

The naive version ("loop over videos, fetch transcript for each") breaks in production for four reasons: **API quota**, **rate limits**, **partial failure**, and **UX blocking**. Handle each explicitly.

### 3.1 Fan-out (metadata first, cheap)
```
classify → type: playlist
→ call YouTube Data API `playlistItems.list` (paginated, 50 items/page)
→ get list of {videoId, title, position} — this alone costs 1 quota unit per page, NOT per video
→ create N `sources` docs, all status: pending, tagged with playlistId + position
→ create a lightweight `playlists` doc: { playlistId, title, totalVideos, sourceIds[] }
→ respond 202 immediately: "{N} videos found, processing started"
→ push N jobs to the ingestion queue (one per video)
```

### 3.2 Concurrency control
```js
// worker setup — cap parallelism, don't fan out unbounded
new Worker('ingestion', processVideoJob, {
  connection: redisConnection,
  concurrency: 5,          // tune based on YouTube + embedding API rate limits
  limiter: { max: 10, duration: 1000 } // extra safety: 10 jobs/sec ceiling
});
```
5 concurrent workers is a safe starting point — high enough to make a 20-video playlist finish in minutes, low enough to not trip YouTube's unofficial per-IP rate limits on transcript fetching.

### 3.3 YouTube API quota budget (this is the part people miss)
YouTube Data API v3 has a **free daily quota of 10,000 units**. Relevant costs:
- `playlistItems.list` → 1 unit per call (50 items/page) — cheap, use freely for metadata
- You do **not** need `videos.list` per video unless you want extra metadata (view count, etc.) — skip it unless the product needs it, it adds unnecessary quota burn
- **Transcripts are NOT fetched via the official Data API** (no quota-billed endpoint for captions text) — use the `youtube-transcript` npm package, which scrapes the public timedtext endpoint. This is quota-free but **not officially supported**, so:
  - Wrap every transcript fetch in try/catch with retry
  - Have a documented fallback (below) for when it breaks

### 3.4 Fallback when captions are unavailable
```
fetch transcript via youtube-transcript
  → fails (no captions / disabled) →
    → mark source status: failed, reason: 'no_captions'
    → surface in UI: "Transcript unavailable — retry with audio transcription?"
    → if user opts in: queue a separate `audio-transcribe` job
        → ytdl-core downloads audio-only stream
        → send to Whisper (or Gemini's audio understanding) for transcription
        → this path is slow + costs money — never trigger automatically for 20 videos at once,
          always opt-in per video
```
This keeps the default playlist path fast and free; audio fallback is an explicit, isolated, user-triggered escape hatch — not a silent default for the whole playlist.

### 3.5 Partial failure isolation
Each video source is independent in the `sources` collection — one job failing never blocks or rolls back the others. The `playlists` doc just aggregates status for the UI:
```js
// computed, not stored — derive on read
playlistProgress = {
  total: sourceIds.length,
  ready: count(status === 'ready'),
  failed: count(status === 'failed'),
  processing: count(status in ['pending','fetching','chunking','embedding'])
}
```

### 3.6 Deduplication
Two cases to guard against:
- **Same video added twice** (once standalone, once via playlist) → before creating a new `sources` doc, check `{ userId, videoId }` uniqueness. If it exists, link the existing source into the new notebook instead of re-ingesting (re-use the already-embedded chunks — just add a `notebookId` reference, don't re-embed).
- **Same playlist re-submitted** → check `playlists.playlistId` per user; if found, skip re-fetching metadata, just re-sync (diff for new videos added to the playlist since last import).

---

## 4. Transcript fetching (shared by both flows)

```js
async function fetchTranscript(videoId) {
  try {
    const segments = await getTranscript(videoId); // youtube-transcript
    return segments.map(s => ({ text: s.text, start: s.offset, duration: s.duration }));
  } catch (err) {
    throw new TranscriptUnavailableError(videoId);
  }
}
```
Preserve `start` (timestamp) per segment — this is what lets your right-panel video viewer jump to the exact cited moment, same as PDF page numbers.

---

## 5. Chunking strategy for transcripts

Transcripts are a stream of small timed segments (2-5s each) — don't embed each segment individually (too small, no context). Merge into semantic chunks:

```
merge consecutive segments until ~300-500 tokens or a natural pause (>3s gap)
each chunk keeps: { text, startTime: first segment's start, endTime: last segment's end }
```
This gives you timestamp-range citations ("around 4:32–5:10") instead of a single meaningless point-in-time.

---

## 6. Data model additions

```
sources     { ..., type: 'youtube', videoId, playlistId?, position?,
              status: pending|fetching|chunking|embedding|ready|failed,
              failureReason?, retryCount, meta: { title, channel, durationSec } }

playlists   { _id, userId, playlistId, title, totalVideos, sourceIds: [ObjectId],
              lastSyncedAt }

chunks      { ..., location: { startTime, endTime } }  // instead of page/paragraph
```

---

## 7. Retry policy

```js
// BullMQ built-in retry config per job
{
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 } // 2s, 4s, 8s
}
```
After 3 failed attempts → `status: failed`, surfaced to user with a manual "Retry" button (don't auto-retry forever — a permanently-disabled-captions video will just burn queue cycles).

---

## 8. Status delivery to client

- Don't poll per-video from the client. On playlist add, client opens **one SSE connection** scoped to the `playlistId`.
- Backend workers publish status updates to a Redis pub/sub channel (`playlist:{id}:progress`) as each video transitions state.
- SSE endpoint subscribes and forwards — sidebar updates in real time as videos go `pending → ready` without polling 20 separate endpoints.

---

## 9. Cost/speed summary (why this design is fast + cheap)

| Concern | How it's handled |
|---|---|
| Token/API cost blowup | No LLM generation calls during ingestion — only embeddings, and those are batched per video, not per chunk |
| Slow sequential processing | Concurrency-capped parallel workers (5x), not a loop |
| YouTube quota exhaustion | Metadata fetch (`playlistItems.list`) is the only quota-billed call — 1 unit per 50 videos, transcripts are quota-free |
| One bad video blocking the rest | Independent per-video jobs, isolated failure, no rollback |
| Re-importing waste | Dedup on `{userId, videoId}` reuses existing embeddings |
| UI feels frozen on 20-video import | 202 immediate response + SSE progressive updates, not a blocking request |
