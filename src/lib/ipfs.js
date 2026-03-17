// Resilient IPFS gateway configuration.
// Ordered by reliability under heavy traffic — public gateways that handle 429s
// and rate limits are placed lower so they act as fallbacks, not primaries.
const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud';

const GATEWAYS = [
  'https://nftstorage.link',
  'https://cloudflare-ipfs.com',
  PINATA_GATEWAY,
  'https://ipfs.io',
  'https://dweb.link',
];

const GATEWAY_TIMEOUT_MS = 3000;
const IPFS_TOTAL_TIMEOUT_MS = 5000;

/**
 * Extract the raw CID (+ optional path) from any IPFS reference.
 * Handles: ipfs://CID, ipfs://CID/path, bare CID, full http(s) URLs (returned as-is).
 */
function extractCid(uri) {
  if (!uri || typeof uri !== 'string') return null;
  const trimmed = uri.trim();
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) return null;
  return trimmed.startsWith('ipfs://') ? trimmed.slice(7) : trimmed;
}

/**
 * Convert an ipfs:// URI to an HTTP gateway URL.
 * Defaults to the fastest public gateway (nftstorage.link).
 */
export function ipfsToHttp(uri, gateway = GATEWAYS[0]) {
  if (!uri || typeof uri !== 'string') return null;
  const cid = extractCid(uri);
  if (!cid) return uri.startsWith('http') ? uri : null;
  return `${gateway}/ipfs/${cid}`;
}

/**
 * Returns an ordered array of gateway URLs for a given IPFS URI.
 * Useful for <img> elements that need to try multiple sources on error.
 */
export function ipfsGatewayUrls(uri) {
  const cid = extractCid(uri);
  if (!cid) {
    if (uri && typeof uri === 'string' && uri.startsWith('http')) return [uri];
    return [];
  }
  return GATEWAYS.map(gw => `${gw}/ipfs/${cid}`);
}

function fetchWithTimeout(url, ms = GATEWAY_TIMEOUT_MS) {
  return fetch(url, { signal: AbortSignal.timeout(ms), cache: 'force-cache' });
}

/**
 * Race multiple IPFS gateways via Promise.any — returns the first successful JSON response.
 * Wrapped in an outer timeout so the entire operation never exceeds IPFS_TOTAL_TIMEOUT_MS.
 * Falls back to null if all gateways fail or timeout.
 */
export async function fetchIPFSMetadata(ipfsURI) {
  if (!ipfsURI || typeof ipfsURI !== 'string') return null;
  const cid = extractCid(ipfsURI);
  if (!cid) return null;

  try {
    const res = await Promise.race([
      Promise.any(
        GATEWAYS.map(gw =>
          fetchWithTimeout(`${gw}/ipfs/${cid}`).then(r => {
            if (!r.ok) throw new Error(`${gw} ${r.status}`);
            return r;
          })
        )
      ),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('IPFS total timeout')), IPFS_TOTAL_TIMEOUT_MS)
      ),
    ]);
    return await res.json();
  } catch {
    return null;
  }
}
