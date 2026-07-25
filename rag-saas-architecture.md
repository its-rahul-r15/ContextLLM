# Architecture — NotebookLM-style RAG SaaS

Full technical architecture for a research/chat SaaS: multi-source ingestion (PDF, YouTube, web, text, VTT), advanced RAG retrieval, citation-grounded chat, and a source viewer with highlight-on-click.

---

## 1. Tech stack (aligned to your MERN background)

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (React) + Tailwind | SSR for fast first load, API routes for BFF pattern |
| Backend API | Node.js + Express (or Fastify) | Matches your existing MERN stack |
| Realtime | Server-Sent Events (SSE) for chat streaming | Simpler than WebSockets for one-way token streaming |
| Primary DB | MongoDB | Notebooks, sources metadata, chat history, users, tenants |
| Vector DB | Qdrant (self-host) or Pinecone (managed) | Hybrid search (dense + sparse), filtering by tenant/notebook |
| Object storage | AWS S3 / Cloudflare R2 | Raw PDFs, transcripts, audio files |
| Job queue | BullMQ + Redis | Async ingestion — parsing is slow, must not block API |
| LLM | Claude (Anthropic API) via your own backend proxy | Generation + reranking + query rewriting |
| Embeddings | Voyage AI or OpenAI `text-embedding-3` | Voyage has strong retrieval benchmarks, pairs well with Claude |
| Auth | JWT + refresh rotation (you already do this in AeroNation) | Multi-tenant, RBAC |

---

## 2. High-level layers

**Client layer** — Next.js app: sources sidebar, chat center, source viewer right panel.
**Backend API layer** — auth/tenancy, ingestion API, RAG orchestrator (this is where all retrieval logic lives).
**AI & data layer** — job queue for ingestion, vector DB for retrieval, MongoDB + S3 for metadata/files/history.

*(See the two diagrams above — system layers, and the full RAG pipeline.)*

---

## 3. Ingestion pipeline (multi-source)

Every source type funnels into one normalized pipeline after a type-specific parser:

1. **Upload / URL submit** → Ingestion API creates a `source` record (status: `pending`) and pushes a job to BullMQ.
2. **Parse (per type)**:
   - **PDF** → `pdf-parse` / `pdfjs-dist` — extract text per page, preserve page numbers + bounding boxes if possible (needed later for highlight-on-click).
   - **YouTube** → fetch transcript via YouTube's timed-text API (or `yt-dlp` for audio → Whisper if no captions exist). Preserve timestamps per line.
   - **Web link** → fetch + Readability.js (Mozilla's reader-mode algorithm) to strip nav/ads, keep clean article text + paragraph offsets.
   - **VTT/SRT** → parse cues directly, each cue = timestamp + text.
   - **Plain text** → store as-is, split into paragraphs.
3. **Clean** → strip boilerplate, normalize whitespace, de-duplicate headers/footers (common in PDFs).
4. **Chunk** (see §4).
5. **Embed** each chunk.
6. **Index** into vector DB with metadata: `sourceId`, `notebookId`, `tenantId`, `pageNumber`/`timestamp`/`paragraphIndex`, `chunkText`, `parentChunkId`.
7. Update `source.status = ready`. Push a notification to client (SSE or polling) so the sidebar updates live.

**Why a queue matters**: PDF parsing, transcript fetching, and embedding calls are all slow/rate-limited — doing this synchronously in the API request would time out. This is the single biggest thing that separates a "toy" RAG app from a real one.

---

## 4. Advanced RAG — the part you said you already know, plus what to add

### Chunking strategy
- Don't do naive fixed-size chunking. Use **semantic chunking**: split on structural boundaries first (headings, paragraphs, VTT cues, PDF pages), then merge/split to hit a target token range (~300–500 tokens) using a sliding window with ~15% overlap.
- Store a **parent-child hierarchy**: small chunks for precise retrieval, but keep a pointer to the larger parent section. This enables **parent-document retrieval** — retrieve the small chunk (precise match) but feed the LLM the larger parent (more context) → fewer hallucinations from truncated context.

### Retrieval
- **Hybrid search**: combine dense vector similarity with sparse BM25/keyword search (Qdrant and most vector DBs support this natively, or run BM25 separately and merge with Reciprocal Rank Fusion). Pure vector search misses exact terms (product names, IDs, acronyms) that users often ask about.
- **Query rewriting / HyDE**: before retrieval, use a small/fast LLM call to rewrite the user's question into a better search query, or generate a "hypothetical answer" (HyDE) and embed that instead — improves recall on vague questions.
- **Metadata filtering**: always scope retrieval to `tenantId` + `notebookId` + only the sources the user has checked in the left panel (this is literally what the checkboxes in your UI are for — pass selected `sourceIds` as a filter).

### Reranking
- After retrieving top-K (e.g. 20) candidates from hybrid search, run a **cross-encoder reranker** (e.g. Cohere Rerank, or a local BGE-reranker) to reorder by true relevance and cut down to top-N (e.g. 5). Vector similarity alone is a weak relevance signal; reranking is where most of the quality jump comes from in production RAG.

### Context assembly
- **Contextual compression**: don't dump full chunks into the prompt — extract only the relevant sentences from each chunk (can use a cheap LLM pass or simple extractive scoring) to keep the context window tight and reduce noise.
- Deduplicate overlapping chunks from the same source before assembling the final context.

### Generation + citation grounding
- Prompt the LLM to cite every claim with a chunk reference, e.g. `[1]`, `[2]`, mapped server-side to `{sourceId, pageNumber/timestamp, chunkText}`.
- This mapping is what powers your right panel: clicking `[1]` in chat sends `{sourceId, location}` to the client, which opens the right panel, fetches/renders that source, and scrolls+highlights the exact passage.

### Optional — agentic/multi-hop (only if you want true "advanced")
- For complex questions needing multiple sources, let the orchestrator run **multi-hop retrieval**: LLM decides "I need to also check source X for Y", issues a second retrieval call, then synthesizes. Implement as a simple loop (max 2-3 hops) rather than a full agent framework — keeps latency sane.

---

## 5. Database schema (MongoDB)

```
tenants        { _id, name, plan, createdAt }
users          { _id, tenantId, email, role, passwordHash }
notebooks      { _id, tenantId, ownerId, title, createdAt }
sources        { _id, notebookId, tenantId, type: pdf|youtube|weblink|text|vtt,
                 title, status: pending|processing|ready|failed,
                 storageUrl, originUrl, meta: {pageCount, duration, ...} }
chunks         { _id, sourceId, notebookId, parentChunkId, text,
                 location: {page, timestamp, paragraphIndex}, tokenCount }
                 // vector embeddings live in vector DB, keyed by chunk _id
conversations  { _id, notebookId, userId, createdAt }
messages       { _id, conversationId, role: user|assistant, text,
                 citations: [{chunkId, sourceId, location}], createdAt }
```

Vector DB (Qdrant) stores: `chunkId` (payload link back to Mongo), embedding vector, and filterable payload (`tenantId`, `notebookId`, `sourceId`).

---

## 6. Multi-tenancy & security

- Every query (Mongo + vector DB) scoped by `tenantId` — never trust client-supplied tenant, derive from JWT.
- RBAC roles per notebook (owner/editor/viewer), same pattern you're already using in AeroNation's UCG super-admin panel.
- Signed, short-lived URLs for S3 file access (don't expose raw source files publicly).
- Rate-limit ingestion endpoints per tenant to prevent abuse of LLM/embedding calls.

---

## 7. Chat streaming

- Client sends question → API validates source selection → orchestrator runs retrieval+rerank (non-streamed, fast) → opens SSE connection → streams LLM tokens to client as they generate → on completion, sends a final event with the structured citation map.
- Store the full assembled message + citations in `messages` once streaming completes.

---

## 8. Suggested build order

1. Auth + multi-tenant scaffolding + notebooks CRUD
2. Source upload (text + PDF only first) → parsing → chunking → embedding → basic vector search
3. Chat with plain RAG (no reranking yet) — get citations working end-to-end (this is the hardest UI+backend wiring, do it early)
4. Right-panel source viewer with highlight-on-click
5. Add hybrid search + reranking (quality pass)
6. Add YouTube, web link, VTT parsers
7. Add query rewriting/HyDE, parent-doc retrieval, contextual compression
8. Multi-hop retrieval (optional, last)
