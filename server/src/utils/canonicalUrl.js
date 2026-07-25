/**
 * Canonical URL utilities for weblink deduplication.
 *
 * Two URLs pointing to the same article should produce one source doc.
 * This module normalizes URLs so dedup works correctly.
 */

// Tracking / noise params to strip from query strings
const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "utm_id", "utm_reader", "utm_name",
  "ref", "referrer", "source",
  "fbclid", "gclid", "msclkid", "dclid",
  "yclid", "twclid",
  "mc_cid", "mc_eid",
  "igshid", "igsh",
  "_ga", "_gl",
]);

/**
 * Normalize a URL for dedup:
 *  - Lowercase the hostname
 *  - Strip known tracking query params
 *  - Remove fragment (#section)
 *  - Remove trailing slash from pathname (unless it's just "/")
 *
 * Does NOT follow the page's own <link rel="canonical"> — that happens
 * during parsing when we have the HTML. This is the pre-fetch normalization.
 */
export const normalizeUrl = (rawUrl) => {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl; // can't normalize, return as-is
  }

  // Lowercase hostname
  url.hostname = url.hostname.toLowerCase();

  // Strip tracking params
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key) || key.startsWith("utm_")) {
      url.searchParams.delete(key);
    }
  }

  // Remove fragment
  url.hash = "";

  // Normalize pathname: remove trailing slash (unless root)
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  // Sort remaining params for stable comparison
  url.searchParams.sort();

  return url.toString();
};

/**
 * Extract the canonical URL from a parsed HTML document.
 * Looks for <link rel="canonical" href="..."> — the most reliable signal.
 * Falls back to the normalized submitted URL.
 *
 * @param {Document} document  — JSDOM document object
 * @param {string} fallbackUrl — normalized submitted URL
 * @returns {string}
 */
export const extractCanonicalUrl = (document, fallbackUrl) => {
  const canonicalEl = document.querySelector('link[rel="canonical"]');
  if (canonicalEl) {
    const href = canonicalEl.getAttribute("href");
    if (href) {
      try {
        // Resolve relative canonicals against the page URL
        const canonical = new URL(href, fallbackUrl);
        return normalizeUrl(canonical.toString());
      } catch {
        // malformed canonical tag — fall through
      }
    }
  }
  return normalizeUrl(fallbackUrl);
};
