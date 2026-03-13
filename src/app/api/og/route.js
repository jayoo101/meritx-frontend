import { ImageResponse } from 'next/og';

export const runtime = 'edge';

function getRank(gasSpent) {
  const gas = parseFloat(gasSpent) || 0;
  if (gas >= 5) return { title: 'Carbon Legend', color: '#4ade80', glow: 'rgba(74,222,128,0.4)' };
  if (gas >= 1) return { title: 'EVM Veteran', color: '#60a5fa', glow: 'rgba(96,165,250,0.4)' };
  if (gas >= 0.1) return { title: 'Builder', color: '#a78bfa', glow: 'rgba(167,139,250,0.4)' };
  return { title: 'Explorer', color: '#94a3b8', glow: 'rgba(148,163,184,0.3)' };
}

function formatMerit(n) {
  return Math.round(n).toLocaleString('en-US');
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address') || '0x0000...0000';
  const gasSpent = searchParams.get('gasSpent') || '0';
  const rankOverride = searchParams.get('rank');

  const gas = parseFloat(gasSpent) || 0;
  const merit = gas * 12345;
  const rank = rankOverride
    ? { title: rankOverride, color: '#60a5fa', glow: 'rgba(96,165,250,0.4)' }
    : getRank(gas);

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
          background: 'linear-gradient(145deg, #050505 0%, #0a0f1a 40%, #050505 100%)',
          fontFamily: 'monospace',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Neon border */}
        <div
          style={{
            position: 'absolute',
            inset: '12px',
            border: `1.5px solid ${rank.color}33`,
            borderRadius: '24px',
            display: 'flex',
            boxShadow: `inset 0 0 60px ${rank.glow}, 0 0 40px ${rank.glow}`,
          }}
        />

        {/* Corner accents */}
        <div style={{ position: 'absolute', top: '24px', left: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: rank.color, boxShadow: `0 0 10px ${rank.color}` }} />
          <span style={{ color: '#52525b', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase' }}>MeritX Protocol · Base L2</span>
        </div>
        <div style={{ position: 'absolute', top: '24px', right: '36px', display: 'flex' }}>
          <span style={{ color: rank.color, fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }}>{rank.title}</span>
        </div>

        {/* Main content */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginTop: '-20px' }}>
          {/* Shield icon via text */}
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: `${rank.color}15`,
              border: `1px solid ${rank.color}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              marginBottom: '8px',
            }}
          >
            🛡️
          </div>

          <span style={{ color: '#71717a', fontSize: '13px', letterSpacing: '0.25em', textTransform: 'uppercase' }}>Carbon Passport · Verified</span>

          <span
            style={{
              fontSize: '72px',
              fontWeight: 900,
              color: rank.color,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              textShadow: `0 0 30px ${rank.glow}`,
              marginTop: '12px',
            }}
          >
            {formatMerit(merit)}
          </span>
          <span style={{ color: '#a1a1aa', fontSize: '22px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '4px' }}>$MERIT Unlocked</span>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '48px', marginTop: '40px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: '#52525b', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Gas Spent</span>
            <span style={{ color: '#e4e4e7', fontSize: '20px', fontWeight: 800 }}>{gas.toFixed(4)} ETH</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: '#52525b', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Rank</span>
            <span style={{ color: rank.color, fontSize: '20px', fontWeight: 800 }}>{rank.title}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: '#52525b', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Wallet</span>
            <span style={{ color: '#a1a1aa', fontSize: '20px', fontWeight: 800 }}>{truncAddr}</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ position: 'absolute', bottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#3f3f46', fontSize: '11px', letterSpacing: '0.1em' }}>meritx.ai</span>
          <span style={{ color: '#27272a', fontSize: '11px' }}>·</span>
          <span style={{ color: '#3f3f46', fontSize: '11px', letterSpacing: '0.1em' }}>Anti-Sybil Airdrop · Gas History Verification</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
