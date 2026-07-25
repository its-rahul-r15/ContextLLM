import dns from "dns";
import net from "net";
import { ApiError } from "./ApiError.js";

/**
 * SSRF Guard — must be called before ANY fetch of a user-supplied URL.
 *
 * Checks:
 *  1. Protocol must be http: or https:
 *  2. Hostname must not be a bare IP in a private range
 *  3. DNS-resolved address must not be in a private range
 *  4. Cloud metadata endpoint (169.254.169.254) explicitly blocked
 *
 * Call this again after each redirect if you follow redirects manually.
 * With axios maxRedirects, the library handles redirect following but you
 * can't intercept per-hop — so we validate the *initial* URL. For stricter
 * production use, set maxRedirects:0 and handle redirects manually with
 * per-hop re-validation.
 */
export const validateUrlSsrf = async (rawUrl) => {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ApiError(400, "Invalid URL format");
  }

  // 1. Protocol guard
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new ApiError(400, `Unsupported protocol: ${url.protocol}. Only http and https are allowed.`);
  }

  // 2. If hostname is already a bare IP, check it directly (no DNS needed)
  if (net.isIP(url.hostname)) {
    if (isPrivateIp(url.hostname)) {
      throw new ApiError(400, "URL points to a private or internal IP address");
    }
    return true; // bare IP, public — allow
  }

  // 3. Resolve DNS and check the resulting address
  let address;
  try {
    const result = await dns.promises.lookup(url.hostname);
    address = result.address;
  } catch (err) {
    throw new ApiError(400, `Could not resolve hostname: ${url.hostname}`);
  }

  // 4. Belt-and-suspenders: cloud metadata IP explicit block
  if (address === "169.254.169.254") {
    throw new ApiError(400, "Blocked: URL resolves to a cloud metadata endpoint");
  }

  if (isPrivateIp(address)) {
    throw new ApiError(400, `URL resolves to a private network address (${address})`);
  }

  return true;
};

/**
 * Returns true if the given IPv4 or IPv6 address is in a private/internal range.
 *
 * Covers:
 *  IPv4: 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16,
 *        169.254.0.0/16 (link-local/metadata), 0.0.0.0
 *  IPv6: ::1 (loopback), fc00::/7 (unique-local), fe80::/10 (link-local)
 */
const isPrivateIp = (ip) => {
  if (net.isIPv4(ip)) {
    return isPrivateIpv4(ip);
  }
  if (net.isIPv6(ip)) {
    return isPrivateIpv6(ip);
  }
  return false;
};

const isPrivateIpv4 = (ip) => {
  const parts = ip.split(".").map(Number);
  const [a, b, c] = parts;

  if (a === 0) return true;                                   // 0.0.0.0
  if (a === 127) return true;                                  // 127.0.0.0/8 loopback
  if (a === 10) return true;                                   // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true;           // 172.16.0.0/12
  if (a === 192 && b === 168) return true;                    // 192.168.0.0/16
  if (a === 169 && b === 254) return true;                    // 169.254.0.0/16 link-local
  if (a === 100 && b >= 64 && b <= 127) return true;         // 100.64.0.0/10 carrier-grade NAT
  return false;
};

const isPrivateIpv6 = (ip) => {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;                       // loopback
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;   // fc00::/7 unique-local
  if (normalized.startsWith("fe80")) return true;             // fe80::/10 link-local
  return false;
};
