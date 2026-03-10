import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'pohg-config.json');

const DEFAULTS = {
  gasPercentage: 1.0,
  hardCapEth: 0.05,
};

const BOUNDS = {
  gasPercentage: { min: 1.0, max: 3.0 },
  hardCapEth: { min: 0.05, max: 0.15 },
};

async function readConfig() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      gasPercentage: clamp(parsed.gasPercentage ?? DEFAULTS.gasPercentage, BOUNDS.gasPercentage),
      hardCapEth: clamp(parsed.hardCapEth ?? DEFAULTS.hardCapEth, BOUNDS.hardCapEth),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function clamp(val, { min, max }) {
  const n = Number(val);
  if (isNaN(n)) return min;
  return Math.min(Math.max(n, min), max);
}

export async function GET() {
  const config = await readConfig();
  return NextResponse.json({ success: true, data: config });
}

export async function POST(request) {
  const adminWallet = process.env.ADMIN_WALLET?.toLowerCase();
  const authHeader = request.headers.get('x-admin-wallet')?.toLowerCase();

  if (adminWallet && authHeader !== adminWallet) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized — wallet mismatch' },
      { status: 403 }
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

  const gasPercentage = clamp(body.gasPercentage ?? DEFAULTS.gasPercentage, BOUNDS.gasPercentage);
  const hardCapEth = clamp(body.hardCapEth ?? DEFAULTS.hardCapEth, BOUNDS.hardCapEth);

  const rounded = {
    gasPercentage: Math.round(gasPercentage * 10) / 10,
    hardCapEth: Math.round(hardCapEth * 100) / 100,
  };

  try {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(rounded, null, 2), 'utf-8');
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Failed to persist config: ' + (err?.message || 'Unknown') },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: rounded });
}
