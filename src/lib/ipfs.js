const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud';

/**
 * Convert an ipfs:// URI to an HTTP gateway URL.
 * Returns null for non-IPFS / empty strings.
 */
export function ipfsToHttp(uri) {
  if (!uri || typeof uri !== 'string') return null;
  if (uri.startsWith('ipfs://')) {
    return `${PINATA_GATEWAY}/ipfs/${uri.slice(7)}`;
  }
  if (uri.startsWith('https://') || uri.startsWith('http://')) return uri;
  return `${PINATA_GATEWAY}/ipfs/${uri}`;
}

/**
 * Fetch and parse a JSON metadata file from an IPFS URI.
 * Returns the parsed object, or null on failure.
 */
export async function fetchIPFSMetadata(ipfsURI) {
  const url = ipfsToHttp(ipfsURI);
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
