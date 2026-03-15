const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud';

const GATEWAYS = [
  PINATA_GATEWAY,
  'https://cloudflare-ipfs.com',
  'https://ipfs.io',
  'https://dweb.link',
];

/**
 * Convert an ipfs:// URI to an HTTP gateway URL using the specified gateway.
 */
export function ipfsToHttp(uri, gateway = PINATA_GATEWAY) {
  if (!uri || typeof uri !== 'string') return null;
  const cid = uri.startsWith('ipfs://') ? uri.slice(7) : uri;
  if (cid.startsWith('https://') || cid.startsWith('http://')) return cid;
  return `${gateway}/ipfs/${cid}`;
}

function fetchWithTimeout(url, ms = 4000) {
  return fetch(url, { signal: AbortSignal.timeout(ms), cache: 'force-cache' });
}

/**
 * Race multiple IPFS gateways via Promise.any — returns the first successful JSON response.
 * Falls back to null if all gateways fail or timeout.
 */
export async function fetchIPFSMetadata(ipfsURI) {
  if (!ipfsURI || typeof ipfsURI !== 'string') return null;
  const cid = ipfsURI.startsWith('ipfs://') ? ipfsURI.slice(7) : ipfsURI;
  if (!cid) return null;

  try {
    const res = await Promise.any(
      GATEWAYS.map(gw =>
        fetchWithTimeout(`${gw}/ipfs/${cid}`).then(r => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r;
        })
      )
    );
    return await res.json();
  } catch {
    return null;
  }
}
