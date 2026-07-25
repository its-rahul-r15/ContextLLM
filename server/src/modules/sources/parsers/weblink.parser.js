import axios from "axios";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import { logger } from "../../../utils/logger.js";
import { validateUrlSsrf } from "../../../utils/ssrfGuard.js";
import { normalizeUrl, extractCanonicalUrl } from "../../../utils/canonicalUrl.js";

const BOT_USER_AGENT = "ContextLLMBot/1.0 (+https://contextllm.app/bot)";
const STATIC_TIMEOUT_MS = 15_000;
const MAX_CONTENT_BYTES = 15 * 1024 * 1024; // 15 MB cap

// ─── Typed errors ─────────────────────────────────────────────────────────────

/**
 * Thrown when the URL returns a PDF — worker reclassifies the source
 * and re-queues it for the PDF parser instead.
 */
export class ReclassifyAsPdfError extends Error {
  constructor(url) {
    super(`URL is a PDF, reclassifying: ${url}`);
    this.name = "ReclassifyAsPdfError";
    this.url = url;
  }
}

/**
 * Thrown when the content type is unsupported (image, video, audio, etc.)
 */
export class UnsupportedContentTypeError extends Error {
  constructor(contentType, url) {
    super(`Unsupported content type "${contentType}" for URL: ${url}`);
    this.name = "UnsupportedContentTypeError";
    this.contentType = contentType;
  }
}

// ─── robots.txt ───────────────────────────────────────────────────────────────

// Simple in-memory cache: { origin -> { allowed: Set<string>, disallowed: Set<string>, fetchedAt: Date } }
const robotsCache = new Map();
const ROBOTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const fetchRobotsTxt = async (origin) => {
  const cached = robotsCache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_CACHE_TTL_MS) {
    return cached;
  }

  const parsed = { disallowedPaths: [], fetchedAt: Date.now() };
  try {
    const res = await axios.get(`${origin}/robots.txt`, {
      timeout: 5000,
      headers: { "User-Agent": BOT_USER_AGENT },
      validateStatus: (s) => s < 500,
    });

    if (res.status === 200 && typeof res.data === "string") {
      // Parse relevant User-agent sections (ours + wildcard)
      let inOurSection = false;
      for (const raw of res.data.split("\n")) {
        const line = raw.trim();
        if (/^user-agent:/i.test(line)) {
          const agent = line.replace(/^user-agent:\s*/i, "").trim().toLowerCase();
          inOurSection = agent === "*" || agent.includes("contextllmbot");
        } else if (inOurSection && /^disallow:/i.test(line)) {
          const path = line.replace(/^disallow:\s*/i, "").trim();
          if (path) parsed.disallowedPaths.push(path);
        }
      }
    }
  } catch {
    // If robots.txt is unreachable, assume allowed (permissive default)
    logger.debug(`robots.txt unreachable for ${origin} — assuming allowed`);
  }

  robotsCache.set(origin, parsed);
  return parsed;
};

const isAllowedByRobots = (robots, pathname) => {
  for (const disallowed of robots.disallowedPaths) {
    if (pathname.startsWith(disallowed)) return false;
  }
  return true;
};

// ─── OG / meta extraction ─────────────────────────────────────────────────────

const extractOgMeta = (document) => ({
  ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute("content") || null,
  ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute("content") || null,
  ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute("content") || null,
  publishedAt: document.querySelector('meta[property="article:published_time"]')?.getAttribute("content") ||
               document.querySelector('meta[name="date"]')?.getAttribute("content") || null,
  siteName: document.querySelector('meta[property="og:site_name"]')?.getAttribute("content") || null,
});

// ─── HTML segment extraction ──────────────────────────────────────────────────

const extractSegmentsFromHtml = (contentHtml, url) => {
  const $ = cheerio.load(contentHtml);
  const segments = [];
  let currentHeadings = { h1: "", h2: "", h3: "" };
  let paragraphIndex = 0;

  $("*").each((_, el) => {
    const tagName = el.tagName.toLowerCase();
    const text = $(el).text().trim();
    if (!text) return;

    if (tagName === "h1") {
      currentHeadings.h1 = text;
      currentHeadings.h2 = "";
      currentHeadings.h3 = "";
    } else if (tagName === "h2") {
      currentHeadings.h2 = text;
      currentHeadings.h3 = "";
    } else if (tagName === "h3") {
      currentHeadings.h3 = text;
    } else if (tagName === "p" || tagName === "li" || tagName === "pre" || tagName === "td") {
      // Skip if element has block-level children (they'll be processed separately)
      if ($(el).find("p, li, pre, td").length > 0) return;
      if (text.length < 35) return;

      const breadcrumbs = [];
      if (currentHeadings.h1) breadcrumbs.push(currentHeadings.h1);
      if (currentHeadings.h2) breadcrumbs.push(currentHeadings.h2);
      if (currentHeadings.h3) breadcrumbs.push(currentHeadings.h3);

      const headingPath = breadcrumbs.join(" > ");
      const structuredText = headingPath ? `[Section: ${headingPath}]\n${text}` : text;

      segments.push({ paragraphIndex, text: structuredText });
      paragraphIndex++;
    }
  });

  // Fallback: split raw text on double newlines
  if (segments.length === 0) {
    const dom = new JSDOM(contentHtml, { url });
    const rawText = dom.window.document.body?.textContent || "";
    rawText.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 40).forEach((text, idx) => {
      segments.push({ paragraphIndex: idx, text });
    });
  }

  return segments;
};

// ─── Jina.ai fallback markdown parser ────────────────────────────────────────

const parseJinaMarkdown = (markdown, url) => {
  const lines = markdown.split("\n");
  const segments = [];
  let currentHeadings = { h1: "", h2: "", h3: "" };
  let paragraphIndex = 0;
  let currentParagraph = [];

  const flushParagraph = () => {
    const text = currentParagraph.join(" ").trim();
    if (text.length >= 35) {
      const breadcrumbs = [];
      if (currentHeadings.h1) breadcrumbs.push(currentHeadings.h1);
      if (currentHeadings.h2) breadcrumbs.push(currentHeadings.h2);
      if (currentHeadings.h3) breadcrumbs.push(currentHeadings.h3);
      const headingPath = breadcrumbs.join(" > ");
      segments.push({
        paragraphIndex,
        text: headingPath ? `[Section: ${headingPath}]\n${text}` : text,
      });
      paragraphIndex++;
    }
    currentParagraph = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { flushParagraph(); continue; }

    const h1 = trimmed.match(/^#\s+(.+)$/);
    const h2 = trimmed.match(/^##\s+(.+)$/);
    const h3 = trimmed.match(/^###\s+(.+)$/);

    if (h1) { flushParagraph(); currentHeadings.h1 = h1[1]; currentHeadings.h2 = ""; currentHeadings.h3 = ""; }
    else if (h2) { flushParagraph(); currentHeadings.h2 = h2[1]; currentHeadings.h3 = ""; }
    else if (h3) { flushParagraph(); currentHeadings.h3 = h3[1]; }
    else {
      const cleanLine = trimmed.replace(/^[*\-+]\s+/, "").replace(/^\d+\.\s+/, "").replace(/[*_`~]/g, "");
      currentParagraph.push(cleanLine);
    }
  }
  flushParagraph();

  if (segments.length === 0) {
    markdown.split(/\n{2,}/).map((b) => b.trim()).filter((b) => b.length > 40).forEach((text, idx) => {
      segments.push({ paragraphIndex: idx, text });
    });
  }

  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  return {
    segments,
    title: titleMatch ? titleMatch[1].trim() : new URL(url).hostname,
  };
};

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parse a web URL into segments for ingestion.
 *
 * Pipeline:
 *   1. SSRF validation (hard fail — no retry)
 *   2. robots.txt check
 *   3. Static HTTP fetch
 *   4. Content-Type guard (PDF → reclassify; image/video → fail)
 *   5. Short-content check → Jina.ai fallback
 *   6. Readability extraction + OG metadata
 *   7. Canonical URL extraction
 *
 * Returns: { segments, meta, canonicalUrl, fetchMethod }
 */
export const parseWebLink = async (url) => {
  const normalizedInput = normalizeUrl(url);

  // ── Step 1: SSRF guard ─────────────────────────────────────────────────────
  // Throws ApiError(400) — worker should NOT retry SSRF failures
  await validateUrlSsrf(url);

  // ── Step 2: robots.txt ────────────────────────────────────────────────────
  const origin = new URL(url).origin;
  const pathname = new URL(url).pathname;
  const robots = await fetchRobotsTxt(origin);
  if (!isAllowedByRobots(robots, pathname)) {
    const err = new Error(`Blocked by robots.txt: ${url}`);
    err.failureReason = "blocked_by_robots";
    throw err;
  }

  // ── Step 3: Static fetch ──────────────────────────────────────────────────
  let html;
  let fetchMethod = "static";

  try {
    const response = await axios.get(url, {
      timeout: STATIC_TIMEOUT_MS,
      maxRedirects: 5,
      maxContentLength: MAX_CONTENT_BYTES,
      headers: {
        "User-Agent": BOT_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      responseType: "text",
    });

    // ── Step 4: Content-Type guard ─────────────────────────────────────────
    const contentType = (response.headers["content-type"] || "").toLowerCase();

    if (contentType.includes("application/pdf") || url.toLowerCase().endsWith(".pdf")) {
      throw new ReclassifyAsPdfError(url);
    }

    if (contentType.startsWith("image/") || contentType.startsWith("video/") || contentType.startsWith("audio/")) {
      throw new UnsupportedContentTypeError(contentType, url);
    }

    html = response.data;
  } catch (err) {
    // Rethrow typed errors — worker handles them specially
    if (err instanceof ReclassifyAsPdfError || err instanceof UnsupportedContentTypeError) throw err;

    // Blocked / rate-limited / timeout → try Jina.ai reader fallback
    const status = err.response?.status;
    const code = err.code;
    const isBlocked =
      status === 403 || status === 401 || status === 503 || status === 429 ||
      code === "ECONNABORTED" || code === "ETIMEDOUT";

    if (isBlocked) {
      logger.warn(`Static fetch failed (${status || code}) for ${url} — trying Jina.ai fallback`);
      try {
        fetchMethod = "jina";
        const jinaRes = await axios.get(`https://r.jina.ai/${url}`, {
          timeout: 25_000,
          maxContentLength: MAX_CONTENT_BYTES,
          headers: { "Accept": "text/plain", "User-Agent": BOT_USER_AGENT },
        });
        if (!jinaRes.data || jinaRes.data.length < 100) throw new Error("Jina returned empty content");
        const { segments, title } = parseJinaMarkdown(jinaRes.data, url);
        return {
          segments,
          canonicalUrl: normalizedInput,
          fetchMethod,
          meta: { title, byline: null, siteName: new URL(url).hostname, ogImage: null, publishedAt: null },
        };
      } catch (jinaErr) {
        logger.error(`Jina fallback also failed for ${url}`, { err: jinaErr.message });
        const wrappedErr = new Error(`Failed to fetch URL: ${err.message}. Jina fallback: ${jinaErr.message}`);
        wrappedErr.failureReason = "fetch_failed";
        throw wrappedErr;
      }
    }

    throw err;
  }

  // ── Step 5: Readability + OG extraction ──────────────────────────────────
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;

  const ogMeta = extractOgMeta(document);
  const canonicalUrl = extractCanonicalUrl(document, normalizedInput);

  const reader = new Readability(document);
  const article = reader.parse();

  const contentHtml = article ? article.content : document.body?.innerHTML || html;
  const pageTitle = ogMeta.ogTitle || (article ? article.title : document.title) || new URL(url).hostname;

  // ── Step 5b: Short content → Jina fallback ────────────────────────────────
  const plainText = article?.textContent || document.body?.textContent || "";
  if (plainText.trim().length < 200) {
    logger.warn(`Readability extracted < 200 chars from ${url} — trying Jina.ai fallback`);
    try {
      fetchMethod = "jina";
      const jinaRes = await axios.get(`https://r.jina.ai/${url}`, {
        timeout: 25_000,
        maxContentLength: MAX_CONTENT_BYTES,
        headers: { "Accept": "text/plain", "User-Agent": BOT_USER_AGENT },
      });
      if (jinaRes.data && jinaRes.data.length > 200) {
        const { segments, title } = parseJinaMarkdown(jinaRes.data, url);
        return {
          segments,
          canonicalUrl,
          fetchMethod,
          meta: {
            title: title || pageTitle,
            byline: article?.byline || null,
            siteName: ogMeta.siteName || article?.siteName || new URL(url).hostname,
            ogImage: ogMeta.ogImage,
            publishedAt: ogMeta.publishedAt,
          },
        };
      }
    } catch (jinaErr) {
      logger.warn(`Jina fallback failed after short content for ${url}`, { err: jinaErr.message });
      // Don't throw — fall through to the partial content we have
    }
  }

  // ── Step 6: Segment extraction ────────────────────────────────────────────
  const segments = extractSegmentsFromHtml(contentHtml, url);

  if (segments.length === 0) {
    const err = new Error(`Could not extract any readable content from: ${url}`);
    err.failureReason = "extraction_failed";
    throw err;
  }

  logger.info(`Weblink parser: ${segments.length} segments for ${url} (method: ${fetchMethod})`);

  return {
    segments,
    canonicalUrl,
    fetchMethod,
    meta: {
      title: pageTitle,
      byline: article?.byline || null,
      siteName: ogMeta.siteName || article?.siteName || new URL(url).hostname,
      ogImage: ogMeta.ogImage,
      publishedAt: ogMeta.publishedAt,
    },
  };
};
