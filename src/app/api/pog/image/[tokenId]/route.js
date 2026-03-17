import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

export const runtime = 'nodejs';

const TIERS = [
  { min: 9000, label: 'CARBON ORACLE',  color: '#F59E0B' },
  { min: 7000, label: 'CARBON ELITE',   color: '#A855F7' },
  { min: 4000, label: 'CARBON PIONEER', color: '#06B6D4' },
  { min: 1000, label: 'CARBON CITIZEN', color: '#3B82F6' },
  { min:    0, label: 'RECRUIT',        color: '#71717A' },
];

function resolveTier(score) {
  return TIERS.find(t => score >= t.min) || TIERS[TIERS.length - 1];
}

function getContractAndProvider() {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://base-sepolia-rpc.publicnode.com';
  const pogAddr = process.env.NEXT_PUBLIC_POG_NFT_ADDRESS;
  if (!pogAddr) return null;

  const provider = new ethers.providers.StaticJsonRpcProvider(rpcUrl);
  const abi = [
    'function ownerOf(uint256) view returns (address)',
    'function baseScores(address) view returns (uint256)',
    'function referralBonuses(address) view returns (uint256)',
  ];
  return { contract: new ethers.Contract(pogAddr, abi, provider), provider };
}

function truncAddr(addr) {
  if (!addr || addr.length < 10) return '0x0000...0000';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function buildSVG({ tokenId, wallet, baseScore, refBonus, finalScore, tier }) {
  const trunc = truncAddr(wallet);
  const scoreDisplay = (finalScore / 10000).toFixed(4);
  const tc = tier.color;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0A0A0A"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${tc}"/>
      <stop offset="100%" stop-color="${tc}88"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="800" height="500" fill="url(#bg)" rx="24"/>

  <!-- Accent border glow -->
  <rect x="2" y="2" width="796" height="496" rx="22" fill="none" stroke="${tc}" stroke-opacity="0.3" stroke-width="2"/>

  <!-- Grid pattern -->
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="${tc}" stroke-opacity="0.04" stroke-width="0.5"/>
  </pattern>
  <rect width="800" height="500" fill="url(#grid)" rx="24"/>

  <!-- Header -->
  <text x="40" y="52" fill="${tc}" font-family="monospace" font-size="11" letter-spacing="3" opacity="0.7">PROOF OF GAS · ON-CHAIN IDENTITY</text>
  <text x="760" y="52" fill="#555" font-family="monospace" font-size="11" text-anchor="end">#${tokenId}</text>

  <!-- Divider -->
  <line x1="40" y1="68" x2="760" y2="68" stroke="${tc}" stroke-opacity="0.15" stroke-width="1"/>

  <!-- Tier badge -->
  <rect x="40" y="90" width="${tier.label.length * 14 + 32}" height="36" rx="6" fill="${tc}" fill-opacity="0.12" stroke="${tc}" stroke-opacity="0.3"/>
  <text x="56" y="114" fill="${tc}" font-family="monospace" font-size="15" font-weight="bold" letter-spacing="2">${tier.label}</text>

  <!-- Large score -->
  <text x="400" y="210" fill="white" font-family="monospace" font-size="72" font-weight="bold" text-anchor="middle">${scoreDisplay}</text>
  <text x="400" y="240" fill="${tc}" font-family="monospace" font-size="14" text-anchor="middle" letter-spacing="4" opacity="0.8">FINAL SCORE</text>

  <!-- Score breakdown -->
  <text x="200" y="310" fill="#666" font-family="monospace" font-size="12" text-anchor="middle">BASE</text>
  <text x="200" y="332" fill="#CCC" font-family="monospace" font-size="20" font-weight="bold" text-anchor="middle">${(baseScore / 10000).toFixed(4)}</text>

  <line x1="320" y1="295" x2="320" y2="340" stroke="#333" stroke-width="1"/>
  <text x="400" y="310" fill="#666" font-family="monospace" font-size="12" text-anchor="middle">+</text>

  <text x="400" y="310" fill="#666" font-family="monospace" font-size="12" text-anchor="middle">REFERRAL</text>
  <text x="400" y="332" fill="#CCC" font-family="monospace" font-size="20" font-weight="bold" text-anchor="middle">+${(refBonus / 10000).toFixed(4)}</text>

  <line x1="480" y1="295" x2="480" y2="340" stroke="#333" stroke-width="1"/>

  <text x="600" y="310" fill="#666" font-family="monospace" font-size="12" text-anchor="middle">COMBINED</text>
  <text x="600" y="332" fill="${tc}" font-family="monospace" font-size="20" font-weight="bold" text-anchor="middle">${scoreDisplay}</text>

  <!-- Divider -->
  <line x1="40" y1="370" x2="760" y2="370" stroke="#222" stroke-width="1"/>

  <!-- Footer -->
  <text x="40" y="410" fill="#555" font-family="monospace" font-size="12">${trunc}</text>
  <text x="40" y="435" fill="#444" font-family="monospace" font-size="10">MINTED ON BASE SEPOLIA</text>

  <text x="760" y="435" fill="#444" font-family="monospace" font-size="10" text-anchor="end">meritx.io/pog</text>

  <!-- Scan line animation hint -->
  <rect x="0" y="245" width="800" height="1" fill="${tc}" opacity="0.06"/>
</svg>`;
}

export async function GET(request, { params }) {
  const { tokenId } = await params;
  const rawId = tokenId.replace(/\.json$/i, '');
  const tid = parseInt(rawId, 10);
  if (isNaN(tid) || tid < 1) {
    return new NextResponse('Invalid tokenId', { status: 400 });
  }

  const conn = getContractAndProvider();
  if (!conn) {
    return new NextResponse(
      buildSVG({ tokenId: tid, wallet: '0x0000...0000', baseScore: 0, refBonus: 0, finalScore: 0, tier: TIERS[TIERS.length - 1] }),
      { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=60' } }
    );
  }

  let wallet;
  try {
    wallet = await conn.contract.ownerOf(tid);
  } catch {
    return new NextResponse(
      buildSVG({ tokenId: tid, wallet: 'NOT MINTED', baseScore: 0, refBonus: 0, finalScore: 0, tier: TIERS[TIERS.length - 1] }),
      { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=30' } }
    );
  }

  let baseScore = 0;
  let refBonus = 0;
  try {
    baseScore = Number(await conn.contract.baseScores(wallet));
    refBonus = Number(await conn.contract.referralBonuses(wallet));
  } catch {
    // Scores default to 0 if read fails
  }

  const finalScore = baseScore + refBonus;
  const tier = resolveTier(baseScore);
  const svg = buildSVG({ tokenId: tid, wallet, baseScore, refBonus, finalScore, tier });

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}
