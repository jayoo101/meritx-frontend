import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { promises as fs } from 'fs';
import path from 'path';
import { CHAIN_ID } from '@/lib/constants';

const cooldownMap = new Map();
const COOLDOWN_MS = 48 * 60 * 60 * 1000;

const CONFIG_PATH = path.join(process.cwd(), 'pohg-config.json');
const CONFIG_DEFAULTS = { gasPercentage: 1.0, hardCapEth: 0.05 };

async function loadPoHGConfig() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      gasPercentage: Number(parsed.gasPercentage) || CONFIG_DEFAULTS.gasPercentage,
      hardCapEth: Number(parsed.hardCapEth) || CONFIG_DEFAULTS.hardCapEth,
    };
  } catch {
    return { ...CONFIG_DEFAULTS };
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

    // In production, fetch userTotalGas from an on-chain indexer or gas oracle.
    // For now, simulate with a generous mock value so the hard cap is the binding limit.
    const mockUserTotalGas = 100;
    const computedAllocation = (mockUserTotalGas * gasPercentage) / 100;
    const finalAllocation = Math.min(computedAllocation, hardCapEth);

    const maxAllocation = ethers.utils.parseEther(finalAllocation.toFixed(18));

    const messageHash = ethers.utils.solidityKeccak256(
      ['address', 'uint256', 'address', 'uint256'],
      [userAddress, maxAllocation, fundAddress, CHAIN_ID]
    );

    const signature = await wallet.signMessage(ethers.utils.arrayify(messageHash));

    cooldownMap.set(userKey, Date.now());

    return NextResponse.json({
      success: true,
      data: {
        signature,
        maxAllocation: maxAllocation.toString(),
        signer: wallet.address,
        pohgParams: { gasPercentage, hardCapEth },
      },
    });
  } catch (err) {
    console.error('PoHG sign error:', err);
    return NextResponse.json(
      { success: false, error: err.message ?? 'Signature generation failed' },
      { status: 500 }
    );
  }
}
