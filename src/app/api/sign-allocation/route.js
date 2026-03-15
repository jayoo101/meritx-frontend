import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { CHAIN_ID } from '@/lib/constants';

export const runtime = 'nodejs';

const cooldownMap = new Map();
const COOLDOWN_MS = 48 * 60 * 60 * 1000;

const POHG_DEFAULTS = { gasPercentage: 1.0, hardCapEth: 0.05 };

async function loadPoHGConfig() {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const configPath = path.join(process.cwd(), 'pohg-config.json');
    const raw = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      gasPercentage: Number(parsed.gasPercentage) || POHG_DEFAULTS.gasPercentage,
      hardCapEth: Number(parsed.hardCapEth) || POHG_DEFAULTS.hardCapEth,
    };
  } catch {
    return { ...POHG_DEFAULTS };
  }
}

export async function POST(request) {
  const privateKey = process.env.BACKEND_SIGNER_PRIVATE_KEY;
  if (!privateKey) {
    return NextResponse.json(
      { success: false, error: 'BACKEND_SIGNER_PRIVATE_KEY not configured on server' },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { userAddress, fundAddress } = body;

  if (!userAddress || !fundAddress) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: userAddress, fundAddress' },
      { status: 400 }
    );
  }

  if (!ethers.utils.isAddress(userAddress) || !ethers.utils.isAddress(fundAddress)) {
    return NextResponse.json(
      { success: false, error: 'Invalid Ethereum address format' },
      { status: 400 }
    );
  }

  const userKey = userAddress.toLowerCase();

  const lastRequest = cooldownMap.get(userKey);
  if (lastRequest) {
    const elapsed = Date.now() - lastRequest;
    if (elapsed < COOLDOWN_MS) {
      const remainingH = Math.ceil((COOLDOWN_MS - elapsed) / 3_600_000);
      return NextResponse.json(
        { success: false, error: `Cooldown active. Try again in ~${remainingH}h.` },
        { status: 429 }
      );
    }
  }

  try {
    const wallet = new ethers.Wallet(privateKey);
    const { gasPercentage, hardCapEth } = await loadPoHGConfig();

    const mockUserTotalGas = 100;
    const computedAllocation = (mockUserTotalGas * gasPercentage) / 100;
    const finalAllocation = Math.min(computedAllocation, hardCapEth);

    const maxAllocation = ethers.utils.parseEther(finalAllocation.toFixed(18));

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://base-sepolia-rpc.publicnode.com";
    const provider = new ethers.providers.StaticJsonRpcProvider(
      { url: rpcUrl, skipFetchSetup: true },
      84532
    );
    const fundContract = new ethers.Contract(
      fundAddress,
      ['function nonces(address) view returns (uint256)'],
      provider
    );
    const nonce = await fundContract.nonces(userAddress);

    const messageHash = ethers.utils.solidityKeccak256(
      ['address', 'uint256', 'uint256', 'address', 'uint256'],
      [userAddress, maxAllocation, nonce, fundAddress, CHAIN_ID]
    );

    const signature = await wallet.signMessage(ethers.utils.arrayify(messageHash));

    cooldownMap.set(userKey, Date.now());

    return NextResponse.json({
      success: true,
      data: {
        signature,
        maxAllocation: maxAllocation.toString(),
        nonce: nonce.toString(),
        signer: wallet.address,
        pohgParams: { gasPercentage, hardCapEth },
      },
    });
  } catch (err) {
    console.error('PoHG sign error:', err);
    return NextResponse.json(
      { success: false, error: err.message ?? 'Signature generation failed', stack: err.stack },
      { status: 500 }
    );
  }
}
