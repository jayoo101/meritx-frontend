import { NextResponse } from 'next/server';

/**
 * Mock visibility toggle API.
 * In production, replace with a real DB (Postgres, Supabase, etc.).
 * Currently a no-op that returns success — the admin page persists state
 * in localStorage as the interim store.
 */

export async function POST(request) {
  try {
    const { address, hidden } = await request.json();

    if (!address || typeof hidden !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Missing address or hidden flag' },
        { status: 400 }
      );
    }

    // TODO: persist to DB
    // await db.projects.update({ address }, { hidden });

    return NextResponse.json({ success: true, address, hidden });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // TODO: read from DB
  // const hidden = await db.projects.findMany({ where: { hidden: true } });
  // return NextResponse.json({ success: true, hiddenAddresses: hidden.map(p => p.address) });

  return NextResponse.json({ success: true, hiddenAddresses: [] });
}
