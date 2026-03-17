import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const BASE_BLUE = '#0052FF';
const NEON_GREEN = '#00FF41';

function rankMeta(title) {
  const t = (title || '').toUpperCase();
  if (t.includes('LEGEND')) return { color: NEON_GREEN, glow: 'rgba(0,255,65,0.35)' };
  if (t.includes('VETERAN')) return { color: BASE_BLUE, glow: 'rgba(0,82,255,0.35)' };
  if (t.includes('BUILDER')) return { color: '#a78bfa', glow: 'rgba(167,139,250,0.3)' };
  return { color: '#94a3b8', glow: 'rgba(148,163,184,0.25)' };
}

function fmtMerit(n) {
  return Math.round(Number(n) || 0).toLocaleString('en-US');
}

// [AUDIT FIX] M7: Wrap entire handler in try/catch for structured error response
export async function GET(request) {
  try {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address') || '0x0000...0000';
  const meritAmount = searchParams.get('meritAmount') || '0';
  const rankTitle = searchParams.get('rank') || 'EXPLORER';

  const rm = rankMeta(rankTitle);
  const truncAddr = address.length >= 10
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address;

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(150deg, #020204 0%, #060a18 35%, #080612 65%, #020204 100%)',
          fontFamily: 'monospace',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Outer glow border */}
        <div
          style={{
            position: 'absolute',
            inset: '10px',
            borderRadius: '28px',
            border: `1.5px solid ${BASE_BLUE}40`,
            display: 'flex',
            boxShadow: `inset 0 0 80px ${BASE_BLUE}15, 0 0 60px ${BASE_BLUE}20, 0 0 120px ${BASE_BLUE}08`,
          }}
        />

        {/* Grid pattern overlay */}
        <div
          style={{
            position: 'absolute',
            inset: '0',
            display: 'flex',
            backgroundImage: `linear-gradient(${BASE_BLUE}08 1px, transparent 1px), linear-gradient(90deg, ${BASE_BLUE}08 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
            opacity: 0.4,
          }}
        />

        {/* Top-left: Protocol label + chip */}
        <div style={{ position: 'absolute', top: '32px', left: '36px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '26px',
              borderRadius: '6px',
              background: `${BASE_BLUE}18`,
              border: `1px solid ${BASE_BLUE}35`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: `${BASE_BLUE}25`, display: 'flex' }} />
          </div>
          <span style={{ color: '#52525b', fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}>
            MeritX Protocol · Base L2
          </span>
        </div>

        {/* Top-right: Rank badge */}
        <div
          style={{
            position: 'absolute',
            top: '28px',
            right: '36px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '8px',
            background: `${rm.color}12`,
            border: `1px solid ${rm.color}30`,
          }}
        >
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: rm.color, boxShadow: `0 0 8px ${rm.color}` }} />
          <span style={{ color: rm.color, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 800 }}>
            {rankTitle.toUpperCase()}
          </span>
        </div>

        {/* Center content */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', marginTop: '-10px' }}>
          <span style={{ color: '#3f3f46', fontSize: '12px', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 600 }}>
            Carbon Identity Passport · Verified
          </span>

          {/* Address line */}
          <span style={{ color: '#71717a', fontSize: '14px', letterSpacing: '0.08em', marginTop: '8px' }}>
            {truncAddr}{"'"}s Carbon Passport
          </span>

          {/* Massive MERIT number */}
          <span
            style={{
              fontSize: '86px',
              fontWeight: 900,
              color: NEON_GREEN,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              textShadow: `0 0 40px rgba(0,255,65,0.35), 0 0 80px rgba(0,255,65,0.12)`,
              marginTop: '16px',
            }}
          >
            {fmtMerit(meritAmount)}
          </span>
          <span style={{ color: `${NEON_GREEN}90`, fontSize: '24px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '4px' }}>
            $MERIT UNLOCKED
          </span>
        </div>

        {/* Bottom stats row */}
        <div style={{ display: 'flex', gap: '60px', marginTop: '44px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: '#3f3f46', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Wallet</span>
            <span style={{ color: '#a1a1aa', fontSize: '18px', fontWeight: 700 }}>{truncAddr}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: '#3f3f46', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Rank</span>
            <span style={{ color: rm.color, fontSize: '18px', fontWeight: 700 }}>{rankTitle.toUpperCase()}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: '#3f3f46', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Network</span>
            <span style={{ color: BASE_BLUE, fontSize: '18px', fontWeight: 700 }}>Multi-Chain EVM</span>
          </div>
        </div>

        {/* Footer bar */}
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '36px',
            right: '36px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ color: '#27272a', fontSize: '11px', letterSpacing: '0.08em' }}>
            meritx.ai · Anti-Sybil Gas History Verification
          </span>
          <span style={{ color: '#27272a', fontSize: '11px', letterSpacing: '0.08em' }}>
            Powered by PoHG on Base L2
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
  } catch (err) {
    // [AUDIT FIX] M7: Return a text error instead of crashing
    console.error('OG image generation failed:', err);
    return new Response('OG image generation failed', { status: 500 });
  }
}
