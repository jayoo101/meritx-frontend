import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

export const runtime = 'nodejs';

// ── Tier definitions (matching UI: image_3.png / image_4.png) ──
const TIERS = [
  { min: 9000, label: 'CARBON ORACLE',  merit: 100_000 },
  { min: 7000, label: 'CARBON ELITE',   merit:  20_000 },
  { min: 4000, label: 'CARBON PIONEER', merit:   5_000 },
  { min: 1000, label: 'CARBON CITIZEN', merit:   1_000 },
  { min:    0, label: 'RECRUIT',        merit:     100 },
];

function resolveTier(baseScoreInt) {
  return TIERS.find(t => baseScoreInt >= t.min) || TIERS[TIERS.length - 1];
}

// ── Multi-chain gas fetcher ──
// Uses Alchemy-compatible JSON-RPC (eth_getBalance + eth_getTransactionCount).
// Team should replace with real Alchemy/Covalent API keys per chain for production.
// [AUDIT FIX] M8: Validate RPC keys — fail clearly if placeholders are still in use
const CHAIN_RPCS = {
  ethereum: process.env.POG_RPC_ETHEREUM   || '',
  base:     process.env.POG_RPC_BASE       || '',
  arbitrum: process.env.POG_RPC_ARBITRUM   || '',
  optimism: process.env.POG_RPC_OPTIMISM   || '',
  polygon:  process.env.POG_RPC_POLYGON    || '',
};

async function fetchGasForChain(rpcUrl, address) {
  // [AUDIT FIX] M8: Skip chains with missing/placeholder RPC keys
  if (!rpcUrl || rpcUrl.includes('YOUR_KEY')) {
    return { txCount: 0, gas: 0 };
  }
  try {
    const body = JSON.stringify({
      jsonrpc: '2.0', id: 1,
      method: 'eth_getTransactionCount',
      params: [address, 'latest'],
    });
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(5000),
    });
    const json = await res.json();
    const txCount = parseInt(json.result || '0x0', 16);
    const gasEstimate = parseFloat((txCount * 0.00042).toFixed(4));
    return { txCount, gas: Math.max(gasEstimate, 0) };
  } catch {
    return { txCount: 0, gas: 0 };
  }
}

async function fetchGasDataFromMultichains(userAddress) {
  const chains = [
    { id: 'ethereum', label: 'Ethereum Mainnet' },
    { id: 'base',     label: 'Base L2' },
    { id: 'arbitrum', label: 'Arbitrum One' },
    { id: 'optimism', label: 'Optimism' },
    { id: 'polygon',  label: 'Polygon' },
  ];

  const results = await Promise.all(
    chains.map(async (c) => {
      const rpc = CHAIN_RPCS[c.id];
      const data = await fetchGasForChain(rpc, userAddress);
      return { ...c, ...data };
    })
  );

  const totalGas = results.reduce((sum, c) => sum + c.gas, 0);
  const totalTxCount = results.reduce((sum, c) => sum + c.txCount, 0);
  return { chains: results, totalGas, totalTxCount };
}

export async function POST(request) {
  // [AUDIT FIX] M8: Validate at least one real RPC is configured
  const hasValidRpc = Object.values(CHAIN_RPCS).some(url => url && !url.includes('YOUR_KEY'));
  if (!hasValidRpc) {
    return NextResponse.json(
      { success: false, error: 'Multi-chain RPC endpoints not configured. Service temporarily unavailable.' },
      { status: 503 }
    );
  }

  const pogPrivateKey = process.env.BACKEND_PRIVATE_KEY_FOR_POG;
  if (!pogPrivateKey) {
    return NextResponse.json(
      { success: false, error: 'POG signer key not configured on server' },
      { status: 500 }
    );
  }

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }

  const { userAddress, inviterAddress } = body;
  if (!userAddress || !ethers.utils.isAddress(userAddress)) {
    return NextResponse.json({ success: false, error: 'Invalid userAddress' }, { status: 400 });
  }
  const inviter = (inviterAddress && ethers.utils.isAddress(inviterAddress))
    ? ethers.utils.getAddress(inviterAddress)
    : ethers.constants.AddressZero;

  const checksumUser = ethers.utils.getAddress(userAddress);

  // [AUDIT FIX] H6: Wrap gas fetch + signing in try/catch for structured error responses
  let gasData;
  try {
    gasData = await fetchGasDataFromMultichains(checksumUser);
  } catch (err) {
    console.error('Multi-chain gas fetch failed:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch on-chain gas data. Please try again.' },
      { status: 502 }
    );
  }

  if (gasData.totalGas < 0.001) {
    return NextResponse.json(
      {
        success: false,
        error: 'Insufficient on-chain history. Your combined gas across all chains is below the minimum threshold (0.001 ETH). Use the chain more and try again.',
        gasData: {
          chains: gasData.chains.map(c => ({ label: c.label, gas: c.gas, txCount: c.txCount })),
          totalGas: parseFloat(gasData.totalGas.toFixed(4)),
          totalTxCount: gasData.totalTxCount,
        },
      },
      { status: 403 }
    );
  }

  const baseScore = Math.min(Math.sqrt(gasData.totalGas), 1.0);
  const baseScoreInt = Math.floor(baseScore * 10_000);

  const tier = resolveTier(baseScoreInt);

  const pogContractAddress = process.env.NEXT_PUBLIC_POG_NFT_ADDRESS;
  if (!pogContractAddress || !ethers.utils.isAddress(pogContractAddress)) {
    return NextResponse.json(
      { success: false, error: 'POG contract address not configured on server' },
      { status: 500 }
    );
  }

  const chainId = parseInt(process.env.NEXT_PUBLIC_POG_CHAIN_ID || '84532', 10);

  // [AUDIT FIX] H6: Wrap signature generation in try/catch
  let signature;
  const wallet = new ethers.Wallet(pogPrivateKey);
  try {
    const msgHash = ethers.utils.solidityKeccak256(
      ['uint256', 'address', 'address', 'uint256', 'address'],
      [chainId, ethers.utils.getAddress(pogContractAddress), checksumUser, baseScoreInt, inviter]
    );
    signature = await wallet.signMessage(ethers.utils.arrayify(msgHash));
  } catch (err) {
    console.error('PoG signature generation failed:', err);
    return NextResponse.json(
      { success: false, error: 'Signature generation failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    signature,
    baseScore: parseFloat(baseScore.toFixed(4)),
    baseScoreInt,
    fee: '0.0005',
    tierResolved: tier.label,
    meritAllocation: tier.merit,
    gasData: {
      chains: gasData.chains.map(c => ({
        label: c.label,
        gas: c.gas,
        txCount: c.txCount,
      })),
      totalGas: parseFloat(gasData.totalGas.toFixed(4)),
      totalTxCount: gasData.totalTxCount,
    },
    inviter,
    signerAddress: wallet.address,
  });
}
