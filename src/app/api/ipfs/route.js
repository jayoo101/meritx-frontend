import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_GATEWAY = process.env.PINATA_DEDICATED_GATEWAY || 'https://gateway.pinata.cloud';

const FALLBACK_GATEWAYS = [
  'https://cloudflare-ipfs.com',
  'https://ipfs.io',
];

const FETCH_TIMEOUT_MS = 8000;

function isValidCid(cid) {
  return typeof cid === 'string' && /^[a-zA-Z0-9_-]{10,}/.test(cid);
}

async function fetchFromGateway(url, headers = {}) {
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res;
}

/**
 * GET /api/ipfs?cid=<CID>
 *
 * Backend proxy for IPFS content. Tries Pinata (authenticated) first,
 * then falls back to public gateways. Returns the content with correct
 * Content-Type and aggressive caching headers (IPFS content is immutable).
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawCid = searchParams.get('cid');

  if (!rawCid) {
    return NextResponse.json({ error: 'Missing ?cid= parameter' }, { status: 400 });
  }

  const cid = rawCid.startsWith('ipfs://') ? rawCid.slice(7) : rawCid;

  if (!isValidCid(cid)) {
    return NextResponse.json({ error: 'Invalid CID' }, { status: 400 });
  }

  const attempts = [];

  // Primary: Pinata with JWT authentication (no rate limits)
  if (PINATA_JWT) {
    attempts.push(
      fetchFromGateway(
        `${PINATA_GATEWAY}/ipfs/${cid}`,
        { Authorization: `Bearer ${PINATA_JWT}` }
      )
    );
  }

  // Fallbacks: unauthenticated public gateways
  for (const gw of FALLBACK_GATEWAYS) {
    attempts.push(fetchFromGateway(`${gw}/ipfs/${cid}`));
  }

  let upstreamRes;
  try {
    upstreamRes = await Promise.any(attempts);
  } catch {
    console.error(`[IPFS Proxy] All gateways failed for CID: ${cid}`);
    return NextResponse.json(
      { error: 'All IPFS gateways failed' },
      { status: 502 }
    );
  }

  const contentType = upstreamRes.headers.get('content-type') || 'application/octet-stream';
  const body = await upstreamRes.arrayBuffer();

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
