# ContextLLM Backend Documentation

> **Stack**: Node.js + Express 5 · MongoDB (Mongoose) · Redis (BullMQ) · Cloudinary · Gemini 2.0 Flash · Google OAuth 2.0

---

## Folder Structure

```
server/
├── src/
│   ├── app.js                        # Express app (middleware, routes, error handler)
│   ├── server.js                     # Entry point (DB connect, workers, listen, graceful shutdown)
│   │
│   ├── config/
│   │   ├── env.js                    # Zod-validated env loader (crashes on bad config)
│   │   ├── db.js                     # Mongoose connect with retry + shutdown hook
│   │   ├── redis.js                  # ioredis singleton with reconnect strategy
│   │   └── vectorDb.js               # Cloudinary SDK singleton
│   │
│   ├── integrations/
│   │   ├── anthropic.client.js       # GoogleGenAI client singleton (Gemini)
│   │   ├── voyage.client.js          # Cloudinary upload/delete/signed-URL helpers
│   │   └── qdrant.client.js          # Gemini embedding helpers (embedText, embedBatch)
│   │
│   ├── utils/
│   │   ├── ApiError.js               # Custom error class with statusCode + errors[]
│   │   ├── ApiResponse.js            # Uniform { success, message, data } response
│   │   ├── asyncHandler.js           # Wraps async route handlers for Express error forwarding
│   │   └── logger.js                 # Winston: colorized dev console / JSON prod
│   │
│   ├── middlewares/
│   │   ├── errorHandler.js           # Global error handler (maps ApiError, Mongoose, 500)
│   │   ├── rateLimiter.js            # Scoped limiters: default, auth, ingestion, chat
│   │   ├── requestLogger.js          # Morgan -> Winston http stream
│   │   └── ownerScope.js             # Verifies req.user owns the :nid notebook
│   │
│   ├── constants/
│   │   └── sourceTypes.js            # SOURCE_TYPES, SOURCE_STATUSES, ACCEPTED_MIME_TYPES enums
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.js
│   │   │   ├── auth.middleware.js    # authenticate — Bearer JWT verify
│   │   │   ├── auth.routes.js
│   │   │   ├── auth.service.js       # register, login, refresh, logout, handleGoogleCallback
│   │   │   ├── auth.validation.js    # Zod schemas
│   │   │   └── auth.google.strategy.js  # Passport GoogleStrategy
│   │   │
│   │   ├── users/
│   │   │   ├── user.model.js         # email, passwordHash?, googleId, avatarUrl, role, refreshToken
│   │   │   ├── user.controller.js
│   │   │   ├── user.routes.js
│   │   │   └── user.service.js
│   │   │
│   │   ├── notebooks/
│   │   │   ├── notebook.model.js     # ownerId, title, description, sourceCount
│   │   │   ├── notebook.controller.js
│   │   │   ├── notebook.routes.js
│   │   │   └── notebook.service.js
│   │   │
│   │   ├── sources/
│   │   │   ├── source.model.js       # notebookId, type, status, cloudinaryUrl, originUrl, meta
│   │   │   ├── source.controller.js  # multipart upload via multer memory storage
│   │   │   ├── source.routes.js
│   │   │   ├── source.service.js     # uploads to Cloudinary, dispatches BullMQ jobs
│   │   │   ├── source.validation.js
│   │   │   └── parsers/
│   │   │       ├── pdf.parser.js     # pdf-parse -> [{pageNumber, text}]
│   │   │       ├── youtube.parser.js # youtube-transcript -> [{timestamp, text}]
│   │   │       ├── weblink.parser.js # axios + JSDOM + Readability -> [{paragraphIndex, text}]
│   │   │       ├── vtt.parser.js     # subtitle package -> [{timestamp, text}]
│   │   │       └── text.parser.js    # split by double newline -> [{paragraphIndex, text}]
│   │   │
│   │   ├── chunks/
│   │   │   ├── chunk.model.js        # text, embedding[], location, parentChunkId, isParent
│   │   │   ├── chunk.service.js      # semanticChunk() — sliding window with 15% overlap
│   │   │   └── chunk.repository.js   # bulkInsert, cosine similarity search, CRUD
│   │   │
│   │   ├── rag/
│   │   │   ├── embedding.service.js  # re-exports embedText, embedBatch
│   │   │   ├── queryRewrite.service.js  # Gemini query optimizer
│   │   │   ├── retrieval.service.js  # cosine similarity retrieval scoped to notebook
│   │   │   ├── rerank.service.js     # Gemini reranker (scores chunks 1-10)
│   │   │   ├── citation.service.js   # buildCitationMap, parseCitations
│   │   │   ├── rag.orchestrator.js   # full pipeline: rewrite->embed->retrieve->rerank->stream
│   │   │   └── rag.controller.js     # SSE endpoint controller
│   │   │
│   │   └── chat/
│   │       ├── conversation.model.js
│   │       ├── message.model.js      # role, text, citations[{ref, chunkId, sourceId, location}]
│   │       ├── chat.controller.js
│   │       ├── chat.routes.js
│   │       └── chat.service.js
│   │
│   └── jobs/
│       ├── queues/
│       │   └── ingestion.queue.js    # BullMQ Queue — 3 retries, exponential backoff
│       └── workers/
│           ├── parse.worker.js       # Step 1: route to correct parser -> dispatch chunk job
│           ├── chunk.worker.js       # Step 2: semantic chunk -> insert Chunk docs -> dispatch embed
│           └── embed.worker.js       # Step 3: Gemini embedBatch -> bulkWrite -> source.status=ready
│
├── .env                              # Environment variables
└── package.json                      # type: module, dev/start scripts
```

---

## API Routes

All routes are prefixed with `/api`.

### Auth `/api/auth`

| Method | Path | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/register` | - | `{email, password, displayName?}` | Register with email/password |
| POST | `/login` | - | `{email, password}` | Login, returns JWT pair |
| POST | `/refresh` | - | `{refreshToken}` | Rotate tokens |
| POST | `/logout` | Bearer | - | Invalidate refresh token |
| GET | `/google` | - | - | Redirect to Google OAuth consent |
| GET | `/google/callback` | - | - | OAuth callback, redirect to client with tokens |

**Response shape:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "user": { "_id": "...", "email": "...", "displayName": "...", "avatarUrl": "..." }
  }
}
```

---

### Users `/api/users`

| Method | Path | Auth | Body | Description |
|---|---|---|---|---|
| GET | `/me` | Bearer | - | Get own profile |
| PATCH | `/me` | Bearer | `{displayName?, avatarUrl?}` | Update profile |

---

### Notebooks `/api/notebooks`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | Bearer | Create notebook `{title, description?}` |
| GET | `/` | Bearer | List own notebooks `?page=1&limit=20` |
| GET | `/:id` | Bearer | Get single notebook |
| PATCH | `/:id` | Bearer | Update `{title?, description?}` |
| DELETE | `/:id` | Bearer | Delete notebook |

---

### Sources `/api/notebooks/:nid/sources`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Bearer | List all sources in notebook |
| POST | `/upload` | Bearer | Multipart upload — PDF or VTT |
| POST | `/youtube` | Bearer | `{url, title?}` |
| POST | `/weblink` | Bearer | `{url, title?}` |
| POST | `/text` | Bearer | `{title, content}` |
| DELETE | `/:sid` | Bearer | Delete a source |

**Source status lifecycle:** `pending -> processing -> ready | failed`

---

### Chat `/api`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/notebooks/:nid/conversations` | Bearer | Create conversation |
| GET | `/notebooks/:nid/conversations` | Bearer | List conversations |
| GET | `/conversations/:cid/messages` | Bearer | Get message history |
| PATCH | `/conversations/:cid/title` | Bearer | Rename conversation |
| DELETE | `/conversations/:cid` | Bearer | Delete conversation + all messages |
| POST | `/conversations/:cid/chat` | Bearer | **SSE streaming chat** `{query, sourceIds?[]}` |

**SSE Events:**
```
event: token
data: {"token": "partial text..."}

event: done
data: {"text": "full response", "citations": [{ref:1, sourceId, location, chunkId}], "messageId": "..."}

event: error
data: {"message": "error description"}
```

---

## Ingestion Pipeline

```
Upload API
    |
    +-- File (PDF/VTT) --> Cloudinary --> Source record (pending)
    +-- URL/Text --------------------------> Source record (pending)
                                               |
                                    BullMQ: "parse" job
                                               |
                                    parse.worker.js
                                    (type-specific parser)
                                    -> segments [{text, location}]
                                               |
                                    BullMQ: "chunk" job
                                               |
                                    chunk.worker.js
                                    semanticChunk()
                                    -> parent + child Chunks in MongoDB
                                               |
                                    BullMQ: "embed" job
                                               |
                                    embed.worker.js
                                    embedBatch() via Gemini text-embedding-004
                                    -> Chunk.embedding[] updated
                                    -> source.status = ready
```

---

## RAG Query Pipeline

```
POST /conversations/:cid/chat { query, sourceIds[] }
    |
    1. rewriteQuery(query, history)         <- Gemini: optimize for retrieval
    2. embedText(rewrittenQuery)            <- Gemini text-embedding-004
    3. retrieve(embedding, notebookId, sourceIds, topK=20)
       -> cosine similarity over Chunk.embedding[] in MongoDB
    4. rerank(query, candidates, topN=5)    <- Gemini: score chunks 1-10
    5. buildCitationMap(topChunks)          <- [1],[2]... -> {chunkId, sourceId, location}
    6. streamGenerate(systemPrompt + context, conversation history)
       -> Gemini 2.0 Flash streaming
       -> onToken() -> SSE "token" events to client
    7. parseCitations(fullText, citationMap)
    8. Persist Message (user) + Message (assistant + citations)
    9. SSE "done" event -> {text, citations, messageId}
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | - | `development` | Environment mode |
| `PORT` | - | `5000` | HTTP listen port |
| `MONGODB_URI` | Yes | - | MongoDB connection string |
| `REDIS_URL` | Yes | - | Redis connection URL |
| `JWT_ACCESS_SECRET` | Yes | - | Min 32 chars |
| `JWT_REFRESH_SECRET` | Yes | - | Min 32 chars |
| `JWT_ACCESS_EXPIRES_IN` | - | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | - | `7d` | Refresh token TTL |
| `GEMINI_API_KEY` | Yes | - | Google AI Studio key |
| `CLOUDINARY_CLOUD_NAME` | Yes | - | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Yes | - | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Yes | - | Cloudinary API secret |
| `GOOGLE_CLIENT_ID` | Yes | - | Google Cloud Console OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | - | Google Cloud Console OAuth secret |
| `GOOGLE_CALLBACK_URL` | Yes | - | Must match Google Cloud Console |
| `CLIENT_URL` | - | `http://localhost:3000` | Frontend URL |
| `RATE_LIMIT_WINDOW_MS` | - | `900000` | 15 min window |
| `RATE_LIMIT_MAX` | - | `100` | Max requests per window |
| `INGESTION_RATE_LIMIT_MAX` | - | `10` | Max ingestion jobs per hour |

---

## Local Setup

```bash
cd server
npm install

# Fill in .env with real API keys

# Start MongoDB and Redis locally (or use Docker)

npm run dev
```

**Quick verification:**
- `GET /health` -> `{"status":"ok"}`
- `POST /api/auth/register` with `{email, password}`
- `GET /api/auth/google` -> redirects to Google

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Embeddings in MongoDB | No external vector DB needed; upgrade to Atlas `$vectorSearch` is a one-line change in `chunk.repository.js` |
| 3-step BullMQ pipeline | Each step fails/retries independently — avoids single long-running job timeouts |
| SSE for streaming | One-way token streaming; simpler than WebSockets, works through proxies |
| Parent-child chunk hierarchy | Child chunks retrieved precisely, parent text provides wider context to LLM |
| Integration files repurposed | `anthropic.client.js` = Gemini, `voyage.client.js` = Cloudinary, `qdrant.client.js` = embeddings |
| passwordHash optional | Google OAuth users are created without a password; `comparePassword` safely returns false |
