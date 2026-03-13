'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const MERIT_PER_ETH = 12_345;
const TF = "'JetBrains Mono', 'Fira Code', 'SF Mono', ui-monospace, monospace";
const EVENT_END_MS = new Date('2026-03-16T21:00:00Z').getTime();
const BASE_BLUE = '#0052FF';
const NEON_GREEN = '#00FF41';
const WARPCAST_PURPLE = '#8A2BE2';
const LS_KEY = 'meritx_has_seen_passport';

const PHASES = { IDLE: 'idle', SCANNING: 'scanning', RESULT: 'result' };

function generateChainData(txCount) {
  const base = Math.max(0.001, txCount * 0.00042 + Math.random() * 0.15);
  return [
    { id: 'eth',  name: 'Ethereum Mainnet', gas: parseFloat((base * (0.55 + Math.random() * 0.15)).toFixed(4)) },
    { id: 'base', name: 'Base L2',          gas: parseFloat((base * (0.20 + Math.random() * 0.08)).toFixed(4)) },
    { id: 'arb',  name: 'Arbitrum One',     gas: parseFloat((base * (0.08 + Math.random() * 0.06)).toFixed(4)) },
    { id: 'op',   name: 'Optimism',         gas: parseFloat((base * (0.02 + Math.random() * 0.04)).toFixed(4)) },
    { id: 'poly', name: 'Polygon PoS',      gas: parseFloat((base * (0.01 + Math.random() * 0.03)).toFixed(4)) },
  ];
}

function fmt(n) { return n.toLocaleString('en-US', { maximumFractionDigits: 0 }); }

function getRank(g) {
  if (g >= 5)   return { title: 'CARBON LEGEND', color: NEON_GREEN };
  if (g >= 1)   return { title: 'EVM VETERAN',   color: BASE_BLUE };
  if (g >= 0.1) return { title: 'BUILDER',       color: '#a78bfa' };
  return { title: 'EXPLORER', color: '#94a3b8' };
}

function useCountdown(endMs) {
  const [rem, setRem] = useState(() => Math.max(0, endMs - Date.now()));
  useEffect(() => {
    const t = () => setRem(Math.max(0, endMs - Date.now()));
    t();
    const id = setInterval(t, 1000);
    return () => clearInterval(id);
  }, [endMs]);
  const ts = Math.floor(rem / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return { expired: rem <= 0, hrs: pad(Math.floor(ts / 3600)), min: pad(Math.floor((ts % 3600) / 60)), sec: pad(ts % 60) };
}

function receiptLine(label, value, w = 42) {
  const ml = w - value.length - 1;
  const tr = label.length > ml ? label.slice(0, ml) : label;
  return `${tr} ${'.'.repeat(Math.max(1, w - tr.length - value.length))} ${value}`;
}

function buildReceiptScript(chains, totalGas, merit) {
  const W = 42, sep = '='.repeat(W), dash = '-'.repeat(W);
  const lines = [
    { t: '', k: 'blank', d: 150 },
    { t: sep, k: 'sep', d: 60 },
    { t: '   EVM CARBON FOOTPRINT VERIFICATION', k: 'title', d: 250 },
    { t: sep, k: 'sep', d: 60 },
    { t: 'NETWORK                      GAS SPENT', k: 'head', d: 200 },
    { t: dash, k: 'dash', d: 60 },
  ];
  for (const c of chains)
    lines.push({ t: receiptLine(c.name, `${c.gas.toFixed(4)} ETH`, W), k: 'chain', d: 300 + Math.random() * 150 });
  lines.push({ t: dash, k: 'dash', d: 60 });
  lines.push({ t: receiptLine('TOTAL COMBINED GAS', `${totalGas.toFixed(4)} ETH`, W), k: 'total', d: 350 });
  lines.push({ t: sep, k: 'sep', d: 80 });
  lines.push({ t: receiptLine('MERIT REWARD (x12345)', `${fmt(merit)} $MERIT`, W), k: 'merit', d: 450 });
  lines.push({ t: sep, k: 'sep', d: 80 });
  lines.push({ t: 'STATUS: APPROVED [NO SYBIL DETECTED]', k: 'status', d: 500 });
  lines.push({ t: '', k: 'blank', d: 80 });
  return lines;
}

function lineClr(k) {
  if (k === 'title' || k === 'status') return { color: NEON_GREEN };
  if (k === 'merit') return { color: NEON_GREEN, fontWeight: 700 };
  if (k === 'total') return { color: '#fff', fontWeight: 700 };
  if (k === 'head') return { color: '#71717a' };
  if (k === 'chain') return { color: '#a1a1aa' };
  return { color: '#3f3f46' };
}

const ShieldIcon = ({ size = 20, color = BASE_BLUE }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export default function CarbonPassportModal() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [chainData, setChainData] = useState([]);
  const [rLines, setRLines] = useState([]);
  const [gasSpent, setGasSpent] = useState(0);
  const [meritReward, setMeritReward] = useState(0);
  const [account, setAccount] = useState('');
  const [copied, setCopied] = useState(false);
  const [siteOrigin, setSiteOrigin] = useState('https://meritx.ai');
  const termRef = useRef(null);
  const cd = useCountdown(EVENT_END_MS);

  useEffect(() => {
    setSiteOrigin(window.location.origin);
    try {
      const seen = localStorage.getItem(LS_KEY);
      if (seen !== 'true') {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    localStorage.setItem(LS_KEY, 'true');
  }, []);

  const reopen = useCallback(() => {
    setPhase(PHASES.IDLE);
    setRLines([]);
    setChainData([]);
    setGasSpent(0);
    setMeritReward(0);
    setAccount('');
    setOpen(true);
  }, []);

  const runScanner = useCallback(async () => {
    if (!window.ethereum) { toast.error('Install a Web3 wallet to verify your Carbon Passport.'); return; }
    setPhase(PHASES.SCANNING); setRLines([]); setChainData([]);

    let addr;
    try {
      const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
      addr = accs[0]; if (!addr) throw new Error(); setAccount(addr);
    } catch { toast.error('Wallet connection required.'); setPhase(PHASES.IDLE); return; }

    let txCount = 5;
    try { const h = await window.ethereum.request({ method: 'eth_getTransactionCount', params: [addr, 'latest'] }); txCount = parseInt(h, 16) || 5; } catch { /* default */ }

    const chains = generateChainData(txCount);
    const total = parseFloat(chains.reduce((s, c) => s + c.gas, 0).toFixed(4));
    const merit = Math.round(total * MERIT_PER_ETH);
    setChainData(chains); setGasSpent(total); setMeritReward(merit);

    const script = buildReceiptScript(chains, total, merit);
    for (const ln of script) {
      await new Promise(r => setTimeout(r, ln.d || 100));
      setRLines(p => [...p, ln]);
    }
    await new Promise(r => setTimeout(r, 400));
    setPhase(PHASES.RESULT);
  }, []);

  useEffect(() => { if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight; }, [rLines]);

  const rank = getRank(gasSpent);
  const trAddr = account ? `${account.slice(0, 6)}...${account.slice(-4)}` : '0x0000...0000';
  const refLink = account ? `${siteOrigin}/?ref=${account}` : siteOrigin;
  const ogUrl = `${siteOrigin}/api/og?address=${encodeURIComponent(account)}&meritAmount=${meritReward}&rank=${encodeURIComponent(rank.title)}`;
  const wcText = `I just verified my Carbon Identity on @MeritX on Base. I unlocked ${fmt(meritReward)} $MERIT based on my gas history. Invite friends for 8% bonus. They keep 100%.\n\n${refLink}`;
  const wcUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(wcText)}&embeds[]=${encodeURIComponent(ogUrl)}`;
  const twText = `I just verified my Carbon Identity on @MeritX_ai. My gas history earned me ${fmt(meritReward)} $MERIT on Base. #MeritX #Base\n\n${refLink}`;
  const twUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twText)}`;

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(refLink).then(() => { setCopied(true); toast.success('Referral link copied'); setTimeout(() => setCopied(false), 2000); });
  }, [refLink]);

  // ─── Left column content (header, countdown, gas, status) ───
  const LeftColumn = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${BASE_BLUE}12`, border: `1px solid ${BASE_BLUE}25`, boxShadow: `0 0 24px ${BASE_BLUE}20` }}>
          <ShieldIcon size={22} />
        </div>
        <div>
          <h2 className="text-lg font-black text-white tracking-tight uppercase leading-tight">Carbon Identity Passport</h2>
          <p className="text-[9px] font-mono lowercase tracking-[0.3em]" style={{ color: '#52525b' }}>anti-sybil airdrop verification</p>
        </div>
      </div>

      {/* Countdown */}
      <div className="rounded-xl py-5 px-4 mb-5 text-center" style={{ background: `linear-gradient(180deg, ${BASE_BLUE}08, transparent)`, border: `1px solid ${BASE_BLUE}10` }}>
        <p className="text-[8px] font-mono uppercase tracking-[0.3em] mb-2" style={{ color: cd.expired ? '#f87171' : NEON_GREEN }}>
          /// Uplink Closes In ///
        </p>
        <p
          className="text-3xl sm:text-4xl font-black tabular-nums tracking-wider"
          style={{ fontFamily: TF, color: cd.expired ? '#f87171' : NEON_GREEN, textShadow: cd.expired ? 'none' : `0 0 30px ${NEON_GREEN}40, 0 0 60px ${NEON_GREEN}12` }}
        >
          {cd.expired ? '/// CLOSED ///' : `${cd.hrs}H : ${cd.min}M : ${cd.sec}S`}
        </p>
      </div>

      {/* Gas report (compact) */}
      <div className="rounded-xl px-4 py-3 mb-5" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.05)', fontFamily: TF }}>
        {phase === PHASES.RESULT ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[10px]" style={{ color: '#52525b' }}>EVM FOOTPRINT</span>
              <span className="text-[10px] font-bold" style={{ color: NEON_GREEN }}>[VERIFIED]</span>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px]" style={{ color: '#71717a' }}>TOTAL COMBINED GAS</span>
              <span className="text-[10px] font-bold text-white">{gasSpent.toFixed(4)} ETH</span>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px]" style={{ color: '#71717a' }}>$MERIT ALLOCATION</span>
              <span className="text-[10px] font-bold" style={{ color: NEON_GREEN }}>{fmt(meritReward)} $MERIT</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[10px]" style={{ color: '#52525b' }}>EVM FOOTPRINT</span>
              <span className="text-[10px]" style={{ color: '#3f3f46' }}>[PENDING]</span>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px]" style={{ color: '#3f3f46' }}>TOTAL COMBINED GAS</span>
              <span className="text-[10px]" style={{ color: '#3f3f46' }}>?.???? ETH</span>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px]" style={{ color: '#3f3f46' }}>$MERIT ALLOCATION</span>
              <span className="text-[10px]" style={{ color: '#3f3f46' }}>?,??? $MERIT</span>
            </div>
          </>
        )}
      </div>

      {/* Action button (IDLE) or Wallet info (SCANNING/RESULT) */}
      {phase === PHASES.IDLE && (
        <div className="mb-5">
          <button
            onClick={runScanner}
            disabled={cd.expired}
            className="w-full py-3 rounded-xl font-black text-sm uppercase tracking-wider text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: BASE_BLUE, boxShadow: cd.expired ? 'none' : `0 0 20px ${BASE_BLUE}40`, border: `1px solid ${BASE_BLUE}70` }}
          >
            {cd.expired ? 'Uplink Closed' : 'Initialize Scan'}
          </button>
        </div>
      )}
      {account && phase !== PHASES.IDLE && (
        <div className="rounded-lg px-3 py-2 mb-5 flex items-center gap-2" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="w-2 h-2 rounded-full" style={{ background: phase === PHASES.RESULT ? NEON_GREEN : BASE_BLUE, boxShadow: `0 0 8px ${phase === PHASES.RESULT ? NEON_GREEN : BASE_BLUE}60` }} />
          <span className="text-[10px] font-mono" style={{ color: '#52525b' }}>Wallet: {account.slice(0, 8)}...{account.slice(-6)}</span>
        </div>
      )}

      {/* Spacer + status line at bottom */}
      <div className="mt-auto pt-4">
        <div className="rounded-lg px-3 py-2.5" style={{ background: phase === PHASES.RESULT ? `${NEON_GREEN}08` : 'rgba(255,255,255,0.02)', border: `1px solid ${phase === PHASES.RESULT ? `${NEON_GREEN}15` : 'rgba(255,255,255,0.04)'}` }}>
          <p className="text-[9px] font-mono uppercase tracking-wider leading-relaxed font-bold" style={{ color: phase === PHASES.RESULT ? NEON_GREEN : '#3f3f46' }}>
            STATUS: [{phase === PHASES.RESULT ? 'APPROVED' : 'PENDING'}] — $MERIT TOKENS WILL BE AUTOMATICALLY RELEASED AT 0x...dead AFTER 72H. NO ACTION REQUIRED.
          </p>
        </div>
      </div>
    </div>
  );

  // ─── Right column: Reputation Card + Actions ───
  const RightColumn = () => (
    <div className="flex flex-col h-full">
      {/* 3D Reputation Card */}
      <motion.div
        initial={{ opacity: 0, y: 16, rotateY: -3 }}
        animate={{ opacity: 1, y: 0, rotateY: 0 }}
        transition={{ delay: 0.15, type: 'spring', damping: 25 }}
        className="relative w-full rounded-2xl overflow-hidden transition-transform duration-500 hover:scale-[1.01] mb-5"
        style={{
          background: 'linear-gradient(135deg, #0c0e14 0%, #080a10 40%, #0d1018 100%)',
          boxShadow: `0 0 50px ${BASE_BLUE}35, 0 0 100px ${BASE_BLUE}12, 0 8px 50px rgba(0,0,0,0.7)`,
          border: `1px solid ${BASE_BLUE}20`,
          perspective: '1000px',
        }}
      >
        {/* Animated circuit grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(${BASE_BLUE}18 1px, transparent 1px), linear-gradient(90deg, ${BASE_BLUE}18 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
            animation: 'circuit-drift 20s linear infinite',
            opacity: 0.04,
          }}
        />

        {/* Static data flow nodes */}
        <div className="absolute inset-0 pointer-events-none">
          {[
            { x: '15%', y: '20%' }, { x: '75%', y: '15%' }, { x: '85%', y: '70%' },
            { x: '25%', y: '75%' }, { x: '50%', y: '40%' }, { x: '60%', y: '80%' },
            { x: '10%', y: '50%' }, { x: '90%', y: '40%' }, { x: '40%', y: '12%' },
            { x: '70%', y: '55%' }, { x: '30%', y: '60%' }, { x: '55%', y: '88%' },
          ].map((p, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full"
              style={{ left: p.x, top: p.y, background: BASE_BLUE, boxShadow: `0 0 8px ${BASE_BLUE}50`, opacity: 0.15 + (i % 4) * 0.08 }}
            />
          ))}
        </div>

        {/* Holographic sweep */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            background: `linear-gradient(120deg, transparent 20%, ${BASE_BLUE}40 40%, ${NEON_GREEN}20 50%, ${BASE_BLUE}40 60%, transparent 80%)`,
            backgroundSize: '200% 100%',
            animation: 'holo-shift 6s ease-in-out infinite',
          }}
        />

        {/* Inner glow border */}
        <div className="absolute inset-[5px] rounded-xl pointer-events-none" style={{ border: `1px solid ${BASE_BLUE}10` }} />

        {/* Smart chip */}
        <div className="absolute top-4 left-5 w-10 h-7 rounded-md overflow-hidden" style={{ background: `linear-gradient(135deg, ${BASE_BLUE}25, ${BASE_BLUE}08)`, border: `1px solid ${BASE_BLUE}30` }}>
          <div className="absolute inset-[2px] rounded-sm" style={{ background: `linear-gradient(135deg, ${BASE_BLUE}12, transparent)` }}>
            <div className="absolute top-1/2 left-0 right-0 h-px" style={{ background: `${BASE_BLUE}20` }} />
            <div className="absolute top-0 bottom-0 left-1/2 w-px" style={{ background: `${BASE_BLUE}20` }} />
          </div>
        </div>

        {/* Protocol label */}
        <div className="absolute top-4 right-5">
          <p className="text-[7px] font-mono uppercase tracking-[0.2em]" style={{ color: `${BASE_BLUE}80` }}>MeritX Protocol · Base L2</p>
        </div>

        {/* Card body — uses relative flow instead of absolute centering */}
        <div className="relative z-[2] px-5 pt-14 pb-4 flex flex-col min-h-[280px]">
          {phase === PHASES.RESULT ? (
            <>
              {/* MERIT + Rank badge */}
              <div className="flex-1 flex flex-col items-center justify-center">
                <p className="text-[8px] font-mono uppercase tracking-[0.25em] mb-2" style={{ color: '#52525b' }}>Carbon Identity Passport · Verified</p>
                <div className="flex items-center gap-3">
                  <motion.p
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                    className="text-4xl sm:text-5xl font-black tracking-tighter leading-none"
                    style={{ fontFamily: TF, color: NEON_GREEN, textShadow: `0 0 25px ${NEON_GREEN}30, 0 0 50px ${NEON_GREEN}10` }}
                  >
                    {fmt(meritReward)}
                  </motion.p>
                  <div className="rounded-lg px-2.5 py-1" style={{ background: `${rank.color}12`, border: `1px solid ${rank.color}30`, boxShadow: `0 0 12px ${rank.color}15` }}>
                    <p className="text-[9px] font-mono font-black uppercase tracking-wider" style={{ color: rank.color }}>{rank.title}</p>
                  </div>
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] mt-1.5" style={{ color: `${NEON_GREEN}70` }}>$MERIT Secured</p>
              </div>

              {/* Multi-chain breakdown */}
              <div className="mt-4 rounded-lg px-3 py-2.5" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.04)', fontFamily: TF }}>
                {chainData.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-[2px]">
                    <span className="text-[9px]" style={{ color: '#52525b' }}>{c.name}</span>
                    <span className="text-[9px] tabular-nums" style={{ color: c.gas > 0 ? '#71717a' : '#27272a' }}>{c.gas.toFixed(4)} ETH</span>
                  </div>
                ))}
                <div className="h-px my-1.5" style={{ background: 'rgba(255,255,255,0.04)' }} />
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold" style={{ color: '#a1a1aa' }}>TOTAL</span>
                  <span className="text-[9px] font-bold tabular-nums" style={{ color: NEON_GREEN }}>{gasSpent.toFixed(4)} ETH</span>
                </div>
              </div>

              {/* Wallet + Rank row */}
              <div className="flex items-end justify-between mt-3">
                <div>
                  <p className="text-[6px] font-mono uppercase tracking-widest" style={{ color: '#3f3f46' }}>Wallet</p>
                  <p className="text-[10px] font-bold font-mono" style={{ color: '#a1a1aa' }}>{trAddr}</p>
                </div>
                <div className="text-right">
                  <p className="text-[6px] font-mono uppercase tracking-widest" style={{ color: '#3f3f46' }}>Verification Hash</p>
                  <p className="text-[9px] font-mono" style={{ color: '#3f3f46' }}>0x...dead_PoHG_BUS</p>
                </div>
              </div>
            </>
          ) : phase === PHASES.SCANNING ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-full border-2 radar-spinner mb-3" style={{ borderColor: `${BASE_BLUE}30` }} />
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#52525b' }}>Scanning...</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-2" style={{ background: `${BASE_BLUE}06`, border: `1px solid ${BASE_BLUE}10` }}>
                <ShieldIcon size={28} color="#27272a" />
              </div>
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#27272a' }}>Connect Wallet</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Actions (only in RESULT) */}
      {phase === PHASES.RESULT && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="flex flex-col gap-3">
          {/* Invite link */}
          <div className="rounded-xl px-4 py-3" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[8px] font-mono uppercase tracking-widest" style={{ color: '#52525b' }}>Your Invite Link</span>
              <span className="text-[8px] font-mono" style={{ color: `${BASE_BLUE}80` }}>+8% Referral Bonus</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 rounded-lg px-3 py-2 text-[10px] font-mono truncate cursor-pointer transition-all hover:text-white"
                style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)', color: '#52525b' }}
                onClick={copyLink}
              >
                {refLink}
              </div>
              <button
                onClick={copyLink}
                className="shrink-0 px-3.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                style={{ background: BASE_BLUE, color: '#fff', border: `1px solid ${BASE_BLUE}70` }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-[9px] mt-1.5" style={{ color: '#3f3f46' }}>Invite friends for an 8% bonus. They keep 100% of their allocation.</p>
          </div>

          {/* Share buttons */}
          <div className="grid grid-cols-2 gap-3">
            <a
              href={wcUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-white text-[11px] font-bold uppercase tracking-wider transition-all hover:opacity-90"
              style={{ background: WARPCAST_PURPLE, border: `1px solid ${WARPCAST_PURPLE}70`, boxShadow: `0 0 20px ${WARPCAST_PURPLE}20` }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M2.2 4.1h4.3l2.3 8.3h.1l2.3-8.3h4.3L21.8 4.1V6.6L19.7 7.5V16.5L21.8 17.4V19.9H15.9V17.4L18 16.5V8.3H17.9L14.6 19.9H11.7L8.4 8.3H8.3V16.5L10.4 17.4V19.9H4.5V17.4L6.6 16.5V7.5L4.5 6.6V4.1H2.2Z" /></svg>
              Share on Warpcast
            </a>
            <a
              href={twUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-white text-[11px] font-bold uppercase tracking-wider transition-all hover:opacity-90"
              style={{ background: '#000', border: '1px solid #333' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              Share on X
            </a>
          </div>
        </motion.div>
      )}

      {/* Idle description */}
      {phase === PHASES.IDLE && (
        <p className="text-[11px] text-center leading-relaxed mt-auto" style={{ color: '#52525b' }}>
          Connect your wallet to scan <span style={{ color: BASE_BLUE }}>Ethereum, Base, Arbitrum, Optimism</span> and <span style={{ color: BASE_BLUE }}>Polygon</span> for your <span className="text-white font-semibold">$MERIT</span> allocation.
        </p>
      )}
    </div>
  );

  return (
    <>
      {/* ═══ Floating Card — Bottom Left ═══ */}
      {!open && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 220, damping: 22 }}
          className="fixed bottom-5 left-5 z-[90] w-[280px] rounded-xl overflow-hidden cursor-pointer group"
          onClick={reopen}
          style={{ fontFamily: TF }}
        >
          <div className="absolute -inset-px rounded-xl opacity-70 group-hover:opacity-100 transition-opacity" style={{ background: `linear-gradient(135deg, ${BASE_BLUE}30, transparent, ${BASE_BLUE}30)` }} />
          <div className="absolute -inset-[2px] rounded-xl transition-shadow" style={{ boxShadow: `0 0 20px ${BASE_BLUE}15, 0 0 60px ${BASE_BLUE}06` }} />

          <div className="relative rounded-xl p-4" style={{ background: 'rgba(5,5,8,0.95)', backdropFilter: 'blur(20px)', border: `1px solid ${BASE_BLUE}20` }}>
            <div className="relative flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${BASE_BLUE}12`, border: `1px solid ${BASE_BLUE}20` }}>
                <ShieldIcon size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] leading-none" style={{ color: BASE_BLUE }}>Carbon Identity Passport</p>
                <p className="text-[8px] uppercase tracking-widest mt-0.5" style={{ color: '#52525b' }}>Anti-Sybil Verification</p>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: NEON_GREEN, boxShadow: `0 0 8px ${NEON_GREEN}60` }} />
                <span className="text-[8px] font-bold uppercase" style={{ color: `${NEON_GREEN}90` }}>Live</span>
              </div>
            </div>

            <div className="relative h-px mb-3" style={{ background: `linear-gradient(to right, transparent, ${BASE_BLUE}20, transparent)` }} />

            <div className="relative mb-3">
              <p className="text-[8px] uppercase tracking-widest mb-1" style={{ color: '#52525b' }}>Uplink Closes In</p>
              <p className="text-lg font-black tabular-nums tracking-wide leading-none" style={{ color: cd.expired ? '#f87171' : NEON_GREEN, textShadow: cd.expired ? 'none' : `0 0 10px ${NEON_GREEN}40` }}>
                {cd.expired ? 'UPLINK CLOSED' : `${cd.hrs}H : ${cd.min}M : ${cd.sec}S`}
              </p>
            </div>

            <button className="relative w-full py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all" style={{ color: '#fff', background: BASE_BLUE, border: `1px solid ${BASE_BLUE}60` }}>
              Scan Now
            </button>
          </div>
        </motion.div>
      )}

      {/* ═══ Modal ═══ */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="cp-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5"
          >
            <div className="absolute inset-0 backdrop-blur-xl" style={{ background: 'rgba(0,0,0,0.92)' }} onClick={dismiss} />

            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 24 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative w-[90vw] max-w-[1400px] max-h-[80vh] rounded-2xl overflow-hidden flex flex-col"
              style={{ background: 'linear-gradient(160deg, #0a0a0c 0%, #060608 40%, #030305 100%)', border: '1px solid rgba(255,255,255,0.07)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Scanline overlay */}
              <div className="absolute inset-0 pointer-events-none z-[1] opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.008) 3px, rgba(255,255,255,0.008) 6px)' }} />

              {/* Close */}
              <button onClick={dismiss} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:opacity-100 opacity-50" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>

              {/* Horizontal 2-column content */}
              <div className="overflow-y-auto flex-1 p-5 sm:p-7 relative z-[2]">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 min-h-[450px]">
                  <LeftColumn />
                  <RightColumn />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
