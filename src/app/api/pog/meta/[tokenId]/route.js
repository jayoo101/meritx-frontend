import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

export const runtime = 'nodejs';

const TIERS = [
  { min: 9000, label: 'CARBON ORACLE',  merit: 100_000 },
  { min: 7000, label: 'CARBON ELITE',   merit:  20_000 },
  { min: 4000, label: 'CARBON PIONEER', merit:   5_000 },
  { min: 1000, label: 'CARBON CITIZEN', merit:   1_000 },
  { min:    0, label: 'RECRUIT',        merit:     100 },
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
    'function inviteCount(address) view returns (uint256)',
  ];
  const contract = new ethers.Contract(pogAddr, abi, provider);
  return { contract, provider };
}

export async function GET(request, { params }) {
  const { tokenId } = await params;
  const rawId = tokenId.replace(/\.json$/i, '');
  const tid = parseInt(rawId, 10);
  if (isNaN(tid) || tid < 1) {
    return NextResponse.json({ error: 'Invalid tokenId' }, { status: 400 });
  }

  const reqUrl = new URL(request.url);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `${reqUrl.protocol}//${reqUrl.host}`;

  const conn = getContractAndProvider();
  if (!conn) {
    return NextResponse.json({ error: 'Contract not configured' }, { status: 503 });
  }

  let walletAddress;
  try {
    walletAddress = await conn.contract.ownerOf(tid);
  } catch {
    return NextResponse.json({ error: `Token #${tid} does not exist` }, { status: 404 });
  }

  let baseScoreScaled = 0;
  let referralBonusScaled = 0;
  let invites = 0;
  try {
    baseScoreScaled = Number(await conn.contract.baseScores(walletAddress));
    referralBonusScaled = Number(await conn.contract.referralBonuses(walletAddress));
    invites = Number(await conn.contract.inviteCount(walletAddress));
  } catch {
    // Scores default to 0 if read fails
  }

  const finalScoreScaled = baseScoreScaled + referralBonusScaled;
  const tier = resolveTier(baseScoreScaled);

  const metadata = {
    name: `Proof of Gas Identity #${tid}`,
    description: `On-chain Carbon Identity minted via Proof of Gas. Tier: ${tier.label}. Score: ${(finalScoreScaled / 10000).toFixed(4)}.`,
    image: `${siteUrl}/api/pog/image/${tid}`,
    external_url: `${siteUrl}/pog`,
    attributes: [
      { trait_type: 'Base Score (scaled)',     value: baseScoreScaled },
      { trait_type: 'Referral Bonus (scaled)', value: referralBonusScaled },
      { trait_type: 'Final Score (scaled)',    value: finalScoreScaled },
      { trait_type: 'Final Score',             value: (finalScoreScaled / 10000).toFixed(4), display_type: 'number' },
      { trait_type: 'Invite Count',            value: invites, display_type: 'number' },
      { trait_type: 'Tier Level',              value: tier.label },
      { trait_type: 'Merit Allocation',        value: `${tier.merit.toLocaleString()} MERIT` },
      { trait_type: 'Wallet',                  value: walletAddress },
    ],
  };

  return NextResponse.json(metadata, {
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
  });
}
