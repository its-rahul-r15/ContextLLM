# Web Link Ingestion Architecture (Production-grade)

Covers URL validation/security, static vs JS-rendered fetching, content extraction, dedup, and re-crawl policy. Slots into the `sources` module.

---

## 1. Security first — SSRF protection (the part that matters most here)

Web link ingestion is the **one source type where your server fetches an arbitrary user-supplied URL** — this is a classic SSRF (Server-Side Request Forgery) attack surface. A malicious user could submit `http://169.254.169.254/latest/meta-data/` (cloud metadata endpoint) or `http://localhost:6379` (your own Redis) and trick your backend into leaking secrets or hitting internal services. This must be validated **before any fetch happens**, not after.

```js
async function validateUrl(rawUrl) {
  const url = new URL(rawUrl);

  // 1. Only allow http/https
  if (!['http:', 'https:'].includes(url.protocol)) throw new ApiError(400, 'Invalid protocol');

  // 2. Resolve DNS and block private/internal IP ranges
  const { address } = await dns.promises.lookup(url.hostname);
  if (isPrivateIp(address)) throw new ApiError(400, 'URL resolves to a private network');
  // blocks: 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, ::1, fc00::/7

  // 3. Block cloud metadata IP explicitly (belt + suspenders)
  if (address === '169.254.169.254') throw new ApiError(400, 'Blocked address');

  return true;
}
```

Use a maintained package for the IP-range check (`is-ip-private` or `ip-range-check`) rather than hand-rolling CIDR math. **Re-validate on every redirect** too — an attacker can submit a public URL that 302-redirects to an internal one; your HTTP client must re-check the resolved IP after each redirect, not just the original URL.

---

## 2. robots.txt & politeness

Before fetching page content, fetch and respect `robots.txt`:
```js
const robots = await fetchRobotsTxt(origin); // cache per-domain, 24h TTL
if (!robots.isAllowed(url, 'YourAppBot/1.0')) {
  markSourceFailed(sourceId, 'blocked_by_robots');
  return;
}
```
Also set a real `User-Agent` identifying your app (not a browser-spoofing string) — this is both an ethical scraping norm and reduces the chance of being blocked outright.

---

## 3. Fetch strategy — static first, headless as fallback (cost control)

Most articles/blogs are server-rendered and don't need a browser. Headless rendering (Playwright/Puppeteer) is 10-50x slower and much more resource-hungry — only use it when necessary.

```
1. Try static fetch: axios.get(url, { timeout: 10000, maxRedirects: 5 })
2. Parse the returned HTML with Readability.js
3. If extracted text is suspiciously short (<200 chars) or the HTML is mostly a JS app shell
   (e.g. <div id="root"></div> with a huge bundle.js, common in SPAs) →
   fallback to headless render:
     - Launch Playwright, page.goto(url, { waitUntil: 'networkidle' })
     - Grab page.content() after JS execution
     - Re-run Readability.js on the rendered HTML
4. If headless also yields nothing useful → status: failed, reason: 'extraction_failed'
```

Run the headless browser in its own worker pool with a **hard concurrency cap (e.g. 2-3)** — Playwright instances are heavy (each is a real Chromium process); don't let this pool scale with your normal ingestion concurrency or you'll OOM the server.

---

## 4. Content extraction

`@mozilla/readability` + `jsdom` — this is the same algorithm Firefox's reader mode uses. Strips nav, ads, footers, comments; keeps the article body, title, byline, and publish date.

```js
const dom = new JSDOM(html, { url });
const reader = new Readability(dom.window.document);
const article = reader.parse();
// article.title, article.textContent, article.excerpt, article.byline
```

Also extract structured metadata separately (doesn't depend on Readability succeeding):
```
og:title, og:description, og:image, article:published_time  (from <meta> tags)
```
Store these even if full content extraction fails — gives the user something to see instead of a blank failed source.

---

## 5. Content-Type guard (someone pastes a PDF/image link as a "web link")

Check the response `Content-Type` header before parsing as HTML:
```js
if (contentType.includes('application/pdf')) {
  // redirect this job to the PDF parser instead
  return reclassifyAsSource(sourceId, 'pdf');
}
if (contentType.startsWith('image/') || contentType.startsWith('video/')) {
  markSourceFailed(sourceId, 'unsupported_content_type');
}
```
Also cap response size (`maxContentLength` in axios, e.g. 15MB) — prevents someone pasting a link to a 2GB file and hanging your worker.

---

## 6. Chunking

Chunk on paragraph/heading boundaries from the extracted `article.textContent`, same target size as other sources (~300-500 tokens, ~15% overlap). Preserve a `paragraphIndex` per chunk so citations can highlight the right paragraph in the right-panel reader view.

---

## 7. Deduplication & re-crawl policy

- Dedup key: **canonical URL**, not raw submitted URL — normalize first (strip tracking params like `utm_*`, `?ref=`, trailing slashes, force lowercase host). Two users pasting the same article with different UTM params shouldn't create two separate embeddings.
- Prefer the page's own `<link rel="canonical">` tag if present, since sites sometimes serve the same content at multiple URLs.
- Re-crawl policy: web content changes; if a user re-adds an already-ingested URL, re-fetch and re-embed only if `Last-Modified`/`ETag` (if the site provides them) differs, or after a TTL (e.g. 30 days) — don't silently serve stale content forever, but don't re-embed on every duplicate add either.

---

## 8. Data model additions

```
sources   { ..., type: 'weblink', originUrl, canonicalUrl,
            status: pending|fetching|rendering|extracting|chunking|embedding|ready|failed,
            failureReason?, fetchMethod: 'static'|'headless',
            meta: { title, byline, publishedAt, ogImage } }

chunks    { ..., location: { paragraphIndex } }
```

---

## 9. Timeouts & retry

```js
{
  attempts: 2,               // lower than YouTube — a slow/broken site rarely fixes itself on retry
  backoff: { type: 'fixed', delay: 5000 },
  timeout: 20000              // hard job timeout, kills hung headless renders
}
```

---

## 10. Cost/speed summary

| Concern | How it's handled |
|---|---|
| SSRF / internal network access | DNS resolution + private-IP block before fetch, re-checked on every redirect |
| Slow/expensive JS rendering | Static fetch first; headless only as fallback, isolated worker pool with hard concurrency cap |
| Hung/huge responses | Request timeout + response size cap |
| Wrong file type submitted as a link | Content-Type sniffing reroutes PDFs to the PDF parser automatically |
| Duplicate ingestion waste | Canonical-URL dedup, reuse existing embeddings |
| Stale content | TTL/ETag-based re-crawl instead of never or always |
