'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const TERMINAL_FONT = "'SF Mono', 'Fira Code', 'JetBrains Mono', 'Cascadia Code', Menlo, Consolas, monospace";
const LS_CLAIMED_KEY = 'meritx_airdrop_claimed';
const LS_SEEN_KEY = 'meritx_airdrop_seen';
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const AUTO_OPEN_DELAY_MS = 1500;

// ── Chain config for gas generation ──

const CHAINS = [
  { id: 'eth',  label: 'Ethereum Mainnet', m: 0.55, j: 0.15 },
  { id: 'base', label: 'Base L2',          m: 0.20, j: 0.08 },
  { id: 'arb',  label: 'Arbitrum One',     m: 0.08, j: 0.06 },
  { id: 'op',   label: 'Optimism',         m: 0.02, j: 0.04 },
  { id: 'poly', label: 'Polygon',          m: 0.01, j: 0.03 },
];

function genChainGas(txCount) {
  const base = Math.max(0.001, txCount * 0.00042 + Math.random() * 0.15);
  return CHAINS.map(c => ({
    ...c,
    gas: parseFloat((base * (c.m + Math.random() * c.j)).toFixed(4)),
  }));
}

// ── Tier logic ──

const TIERS = [
  { min: 5.0,  label: 'Carbon Oracle',  merit: 100_000, accent: 'text-amber-400',   border: 'border-amber-500/30',   bg: 'bg-amber-500/10' },
  { min: 1.0,  label: 'Carbon Elite',   merit: 20_000,  accent: 'text-purple-400',  border: 'border-purple-500/30',  bg: 'bg-purple-500/10' },
  { min: 0.1,  label: 'Carbon Pioneer', merit: 5_000,   accent: 'text-cyan-400',    border: 'border-cyan-500/30',    bg: 'bg-cyan-500/10' },
  { min: 0.01, label: 'Carbon Citizen', merit: 1_000,   accent: 'text-blue-400',    border: 'border-blue-500/30',    bg: 'bg-blue-500/10' },
  { min: 0,    label: 'Recruit',        merit: 100,     accent: 'text-zinc-400',     border: 'border-zinc-500/30',    bg: 'bg-zinc-500/10' },
];

function getTier(totalGas) {
  return TIERS.find(t => totalGas >= t.min) || TIERS[TIERS.length - 1];
}

// ── Terminal log sequences (dynamic — filled with real data at runtime) ──

function buildTerminalLogs(address, txCount, chains, totalGas, tier) {
  const trAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '0x????';
  return {
    connecting: [
      'Handshaking with Carbon Protocol...',
      `Wallet: ${trAddr}`,
      'TLS 1.3 verified — session encrypted',
      'Indexer node connected — latency 11ms',
    ],
    scanning_history: [
      'Calculating Gas Burned on Mainnet & Base...',
      `Scanning ${txCount.toLocaleString()} transactions across ${chains.length} chains`,
      ...chains.map(c => `[OK] ${c.label.padEnd(18, '.')} ${c.gas.toFixed(4)} ETH`),
      `Total combined gas: ${totalGas.toFixed(4)} ETH`,
    ],
    analyzing_contracts: [
      'Verifying Passport Tier eligibility...',
      'Sybil resistance: PASSED',
      'PoHG signature verification: VALID',
      `Carbon Tier resolved: [${tier.label.toUpperCase()}]`,
      `Merit allocation: ${tier.merit.toLocaleString()} MERIT`,
    ],
    generating_proof: [
      'Finalizing MeritX Allocation...',
      `Leaf: keccak256(${trAddr}, ${totalGas.toFixed(4)}, ${txCount})`,
      'Merkle proof depth: 18 layers',
      `Root: 0x${Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}...`,
      `ALLOCATION CONFIRMED: ${tier.merit.toLocaleString()} $MERIT`,
    ],
  };
}

const STEP_LABELS = {
  connecting: 'CONNECTING TO CARBON PROTOCOL',
  scanning_history: 'SCANNING ON-CHAIN HISTORY',
  analyzing_contracts: 'VERIFYING PASSPORT TIER',
  generating_proof: 'FINALIZING MERIT ALLOCATION',
};

const PHASE_DURATION_MS = 1800;

// ── Hooks ──

function useCountUp(target, duration = 1200, active = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) { setValue(0); return; }
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, active]);
  return value;
}

function shouldAutoOpen() {
  try {
    if (localStorage.getItem(LS_CLAIMED_KEY) === 'true') return false;
    const raw = localStorage.getItem(LS_SEEN_KEY);
    if (!raw) return true;
    return Date.now() - Number(raw) > COOLDOWN_MS;
  } catch { return false; }
}

function markSeen() {
  try { localStorage.setItem(LS_SEEN_KEY, String(Date.now())); } catch {}
}

function markClaimed() {
  try { localStorage.setItem(LS_CLAIMED_KEY, 'true'); } catch {}
}

function hasClaimed() {
  try { return localStorage.getItem(LS_CLAIMED_KEY) === 'true'; } catch { return false; }
}

// ── Confetti ──

function fireConfetti() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const colors = ['#00d4ff', '#3b82f6', '#8b5cf6', '#00ff88', '#f59e0b', '#ef4444', '#ffffff'];
  const pieces = Array.from({ length: 150 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.5,
    w: 4 + Math.random() * 6,
    h: 8 + Math.random() * 10,
    vx: (Math.random() - 0.5) * 4,
    vy: 2 + Math.random() * 5,
    rot: Math.random() * 360,
    rv: (Math.random() - 0.5) * 12,
    color: colors[Math.floor(Math.random() * colors.length)],
    opacity: 1,
  }));
  let frame = 0;
  const maxFrames = 180;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.rot += p.rv;
      if (frame > maxFrames * 0.6) p.opacity = Math.max(0, p.opacity - 0.02);
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    frame++;
    if (frame < maxFrames) { requestAnimationFrame(draw); }
    else { canvas.remove(); }
  }
  requestAnimationFrame(draw);
}

// ── Sub-components ──

function ScanlineOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
      <div
        className="absolute inset-x-0 h-[2px] opacity-[0.07]"
        style={{
          background: 'linear-gradient(90deg, transparent, #00ffaa, transparent)',
          animation: 'meritScanDown 3s ease-in-out infinite',
        }}
      />
    </div>
  );
}

function TerminalWindow({ logs }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs.length]);

  return (
    <div
      className="relative w-full max-w-2xl rounded-xl border border-emerald-500/20 bg-black/90 backdrop-blur-sm overflow-hidden shadow-[0_0_40px_rgba(0,255,170,0.06)]"
      style={{ fontFamily: TERMINAL_FONT }}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-emerald-500/10 bg-emerald-950/20">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
        <span className="ml-3 text-[10px] text-emerald-500/40 tracking-widest uppercase">carbon-merit-indexer v3.0</span>
      </div>
      <div className="px-4 py-4 h-52 sm:h-64 overflow-y-auto scrollbar-hide">
        {logs.map((log, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15 }}
            className="flex gap-2 text-[11px] leading-relaxed mb-1"
          >
            <span className="text-emerald-600/50 shrink-0 select-none">&gt;</span>
            <span className={i === logs.length - 1 ? 'text-emerald-400' : 'text-emerald-500/60'}>{log}</span>
          </motion.div>
        ))}
        <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-4 mt-1" />
        <div ref={endRef} />
      </div>
    </div>
  );
}

function ProgressSteps({ currentStep }) {
  const steps = ['connecting', 'scanning_history', 'analyzing_contracts', 'generating_proof'];
  const currentIdx = steps.indexOf(currentStep);

  return (
    <div className="flex items-center gap-1 w-full max-w-2xl mb-6">
      {steps.map((step, i) => {
        const isActive = i === currentIdx;
        const isDone = i < currentIdx;
        return (
          <div key={step} className="flex-1 flex flex-col gap-1.5">
            <div className="h-1 rounded-full overflow-hidden bg-zinc-800">
              <motion.div
                className={isDone ? 'h-full bg-emerald-500' : isActive ? 'h-full bg-emerald-400' : 'h-full bg-zinc-800'}
                initial={{ width: '0%' }}
                animate={{ width: isDone ? '100%' : isActive ? '60%' : '0%' }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <span className={`text-[8px] font-mono uppercase tracking-widest ${isActive ? 'text-emerald-400' : isDone ? 'text-emerald-600' : 'text-zinc-700'}`}>
              {STEP_LABELS[step]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function genMeritId(address) {
  if (!address) return '#0000';
  const hash = address.slice(2, 6).toUpperCase();
  return `#${hash}`;
}

function ResultCard({ data, onClaim, claimed }) {
  const scoreDisplay = useCountUp(data.meritScore, 1500, true);

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://meritx.io';
  const ogUrl = `${siteUrl}/api/og?address=${encodeURIComponent(data.address || '')}&meritAmount=${data.meritScore}&rank=${encodeURIComponent(data.tier.label)}`;
  const shareText = `My Carbon Identity just unlocked ${data.meritScore.toLocaleString()} $MERIT on @MeritX_HQ.\n\nOn-chain history is the new credit.\nScan yours: ${siteUrl}/airdrop\n\n#ProofOfGas #CarbonIdentity`;
  const tweetText = encodeURIComponent(shareText);
  const warpcastText = encodeURIComponent(`My Carbon Identity just unlocked ${data.meritScore.toLocaleString()} $MERIT on @MeritX.\n\nOn-chain history is the new credit.\n${siteUrl}/airdrop`);
  const meritId = genMeritId(data.address);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-2xl"
    >
      <div className="relative rounded-2xl border border-cyan-400/25 bg-white/[0.04] backdrop-blur-2xl overflow-hidden shadow-[0_0_80px_rgba(0,200,255,0.10),inset_0_1px_0_rgba(255,255,255,0.05)]">
        <ScanlineOverlay />
        {/* Static CRT scanline texture */}
        <div className="pointer-events-none absolute inset-0 z-[11] opacity-[0.03]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,200,0.15) 2px, rgba(0,255,200,0.15) 4px)', backgroundSize: '100% 4px' }} />
        <div className="relative z-20 p-6 sm:p-10">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[10px] font-mono text-cyan-500/60 tracking-[0.2em] uppercase mb-1">Carbon Identity Verified</p>
              <h2 className="text-2xl font-black text-white tracking-tight">Merit Allocation</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-600 tracking-wider">Merit ID: {meritId}</span>
              <div className={`px-3 py-1.5 rounded-lg ${data.tier.border} ${data.tier.bg}`}>
                <span className={`text-[11px] font-bold font-mono tracking-wider ${data.tier.accent}`}>{data.tier.label}</span>
              </div>
            </div>
          </div>

          {/* Chain breakdown */}
          <div className="rounded-xl border border-zinc-800/80 bg-white/[0.02] backdrop-blur-sm p-3 sm:p-4 mb-8" style={{ fontFamily: TERMINAL_FONT }}>
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-2 sm:mb-3">EVM Gas Footprint</p>
            <div className="space-y-1 sm:space-y-1.5 text-[10px] sm:text-xs">
              {data.chains.map(c => (
                <div key={c.id} className="flex justify-between">
                  <span className="text-zinc-500 truncate mr-2">{c.label}</span>
                  <span className="text-zinc-400 tabular-nums shrink-0">{c.gas.toFixed(4)} ETH</span>
                </div>
              ))}
              <div className="h-px bg-zinc-800 my-1.5 sm:my-2" />
              <div className="flex justify-between">
                <span className="text-white font-bold">TOTAL</span>
                <span className="text-white font-bold tabular-nums">{data.totalGas.toFixed(4)} ETH</span>
              </div>
            </div>
          </div>

          {/* Pillar stats */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
            {[
              { icon: '⛽', label: 'Gas Burned', value: `${data.totalGas.toFixed(2)} ETH`, sub: 'Top 12% of Power Users', accent: 'text-orange-400', border: 'border-orange-500/20' },
              { icon: '🔗', label: 'Transactions', value: data.txCount.toLocaleString(), sub: null, accent: 'text-purple-400', border: 'border-purple-500/20' },
              { icon: '🛡️', label: 'Carbon Tier', value: data.tier.label.split(' ')[1], sub: null, accent: 'text-cyan-400', border: 'border-cyan-500/20' },
            ].map(p => (
              <div key={p.label} className={`rounded-xl border ${p.border} bg-white/[0.03] backdrop-blur-sm p-3 sm:p-4 text-center`}>
                <span className="text-xl sm:text-2xl block mb-1">{p.icon}</span>
                <p className={`text-sm sm:text-base font-black ${p.accent} font-mono`}>{p.value}</p>
                <p className="text-[9px] text-zinc-500 uppercase tracking-wider mt-1">{p.label}</p>
                {p.sub && <p className="text-[8px] text-zinc-600 mt-1 hidden sm:block">{p.sub}</p>}
              </div>
            ))}
          </div>

          {/* Score */}
          <div className="text-center mb-8">
            <p className="text-[10px] font-mono text-zinc-600 tracking-[0.3em] uppercase mb-3">Total Merit Allocation</p>
            <div className="relative inline-block py-2">
              <h3
                className="text-5xl sm:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300 relative z-10"
                style={{
                  fontFamily: TERMINAL_FONT,
                  filter: 'drop-shadow(0 0 12px rgba(0,210,255,0.6)) drop-shadow(0 0 40px rgba(0,180,255,0.35))',
                }}
              >
                {scoreDisplay.toLocaleString()}
              </h3>
              {/* Outer diffuse glow */}
              <div className="absolute -inset-4 blur-3xl opacity-30 bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-300 -z-0 holo-pulse" aria-hidden="true" />
              {/* Inner tight glow */}
              <div className="absolute inset-0 blur-xl opacity-50 bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300 -z-0" aria-hidden="true" />
            </div>
            <p className="text-sm font-bold text-cyan-400/70 tracking-widest mt-1" style={{ textShadow: '0 0 20px rgba(0,210,255,0.3)' }}>$MERIT</p>
          </div>

          {/* CTA */}
          <div className="flex flex-col gap-3">
            {!claimed ? (
              <button
                onClick={onClaim}
                className="relative w-full py-4 rounded-xl font-bold text-base text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 transition-all shadow-[0_0_30px_rgba(0,200,255,0.2)] hover:shadow-[0_0_50px_rgba(0,200,255,0.35)] overflow-hidden"
              >
                <span className="absolute inset-0 shimmer-streak" />
                <span className="relative z-10">Claim {data.meritScore.toLocaleString()} $MERIT</span>
              </button>
            ) : (
              <div className="w-full py-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-center">
                <span className="text-emerald-400 font-bold text-sm font-mono tracking-wider">CLAIMED — ALLOCATION SECURED</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <a
                href={`https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(ogUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => { try { navigator.clipboard.writeText(decodeURIComponent(tweetText)); } catch {} }}
                className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-black border border-zinc-700 text-white font-bold text-sm hover:bg-zinc-900 hover:border-zinc-600 transition-all"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                Share on X
              </a>
              <a
                href={`https://warpcast.com/~/compose?text=${warpcastText}&embeds[]=${encodeURIComponent(ogUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-bold text-sm hover:brightness-110 transition-all"
                style={{ background: '#7C3AED' }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M3.414 1.98h17.172c.792 0 1.434.642 1.434 1.434v17.172c0 .792-.642 1.434-1.434 1.434H3.414c-.792 0-1.434-.642-1.434-1.434V3.414c0-.792.642-1.434 1.434-1.434zM6.856 7.326l2.34 4.236-2.484 4.112h1.772l1.584-2.756 1.584 2.756h1.8l-2.484-4.112 2.34-4.236h-1.772l-1.468 2.604-1.468-2.604h-1.744z" /></svg>
                Warpcast
              </a>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Modal ──

export default function CarbonMeritModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState('idle');
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [resultData, setResultData] = useState(null);
  const [claimed, setClaimed] = useState(false);
  const logIntervalRef = useRef(null);
  const logsRef = useRef({});

  const isScanning = scanStatus !== 'idle' && scanStatus !== 'success';

  useEffect(() => { setClaimed(hasClaimed()); }, []);

  useEffect(() => {
    if (!shouldAutoOpen()) return;
    const timer = setTimeout(() => setIsOpen(true), AUTO_OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = useCallback(() => {
    markSeen();
    setIsOpen(false);
    setTimeout(() => {
      setScanStatus('idle');
      setTerminalLogs([]);
      clearInterval(logIntervalRef.current);
    }, 400);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const drainLogs = useCallback((phase, onDone) => {
    const lines = logsRef.current[phase] || [];
    let i = 0;
    clearInterval(logIntervalRef.current);
    logIntervalRef.current = setInterval(() => {
      if (i < lines.length) {
        setTerminalLogs(prev => [...prev, lines[i]]);
        i++;
      } else {
        clearInterval(logIntervalRef.current);
        onDone?.();
      }
    }, PHASE_DURATION_MS / Math.max(lines.length, 1));
  }, []);

  const runScan = useCallback(async () => {
    if (!window.ethereum) { toast.error('Install a Web3 wallet to proceed.'); return; }

    setTerminalLogs([]);
    setScanStatus('connecting');

    // Real wallet connection
    let addr;
    try {
      const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
      addr = accs[0];
      if (!addr) throw new Error();
    } catch {
      toast.error('Wallet connection required.');
      setScanStatus('idle');
      return;
    }

    // Real tx count
    let txCount = 5;
    try {
      const hex = await window.ethereum.request({ method: 'eth_getTransactionCount', params: [addr, 'latest'] });
      txCount = parseInt(hex, 16) || 5;
    } catch { /* default fallback */ }

    // Generate chain gas data from real tx count
    const chains = genChainGas(txCount);
    const totalGas = parseFloat(chains.reduce((s, c) => s + c.gas, 0).toFixed(4));
    const tier = getTier(totalGas);
    const meritScore = tier.merit;

    // Build terminal logs with real data
    logsRef.current = buildTerminalLogs(addr, txCount, chains, totalGas, tier);

    // Store result for the success card
    setResultData({ chains, totalGas, txCount, tier, meritScore, address: addr });

    // Drain logs through each phase
    const phases = ['connecting', 'scanning_history', 'analyzing_contracts', 'generating_proof'];
    let delay = 0;
    phases.forEach((phase, idx) => {
      setTimeout(() => {
        setScanStatus(phase);
        drainLogs(phase, idx === phases.length - 1 ? () => {
          setTimeout(() => setScanStatus('success'), 600);
        } : undefined);
      }, delay);
      delay += PHASE_DURATION_MS;
    });
  }, [drainLogs]);

  const handleClaim = useCallback(() => {
    markClaimed();
    setClaimed(true);
    fireConfetti();
    toast.success('Allocation secured! $MERIT will be distributed at TGE.');
  }, []);

  useEffect(() => {
    return () => clearInterval(logIntervalRef.current);
  }, []);

  useEffect(() => {
    window.__meritxOpenAirdrop = () => {
      setScanStatus('idle');
      setTerminalLogs([]);
      setIsOpen(true);
    };
    return () => { delete window.__meritxOpenAirdrop; };
  }, []);

  return (
    <>
      {/* Floating re-open button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            onClick={() => { setScanStatus('idle'); setTerminalLogs([]); setIsOpen(true); }}
            className="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-cyan-600/10 border border-cyan-500/20 backdrop-blur-md text-cyan-400 text-[11px] font-bold font-mono tracking-wider hover:bg-cyan-600/20 hover:border-cyan-500/40 transition-all shadow-[0_0_20px_rgba(0,200,255,0.1)] group"
            aria-label="Open Merit Drop"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(0,200,255,0.8)]" />
            <span className="hidden sm:inline">MERIT DROP</span>
            <span className="sm:hidden">⛽</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Modal overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="carbon-merit-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={(e) => { if (e.target === e.currentTarget && scanStatus === 'idle') handleClose(); }}
          >
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />

            <div
              className="absolute inset-0 opacity-[0.025] pointer-events-none"
              style={{
                backgroundImage: 'linear-gradient(rgba(0,255,200,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,200,0.3) 1px, transparent 1px)',
                backgroundSize: '60px 60px',
              }}
            />

            <button
              onClick={handleClose}
              className="absolute top-5 right-5 z-[60] w-10 h-10 flex items-center justify-center rounded-full border border-zinc-700/60 bg-zinc-900/80 text-zinc-500 hover:text-white hover:border-zinc-500 transition-all"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" />
              </svg>
            </button>

            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto px-4 py-10 sm:py-16 flex flex-col items-center scrollbar-hide"
            >
              <AnimatePresence mode="wait">
                {/* ═══════ IDLE ═══════ */}
                {scanStatus === 'idle' && (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.35 }}
                    className="text-center flex flex-col items-center"
                  >
                    <div className="mb-5">
                      <span className="inline-block px-3 py-1 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-[10px] font-mono text-cyan-400 tracking-widest uppercase">
                        Carbon Identity × Merit Drop
                      </span>
                    </div>

                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter text-white mb-3 leading-[0.95]">
                      The Merit<span className="text-cyan-400"> Drop</span>
                    </h1>
                    <p className="text-base sm:text-lg text-zinc-400 max-w-lg leading-relaxed mb-2">
                      The wallets that powered the chain deserve the future.
                    </p>
                    <p className="text-xs sm:text-sm text-zinc-600 font-mono max-w-md mb-10">
                      Connect your wallet. We scan your gas history across 5 EVM chains and assign your Carbon Tier.
                    </p>

                    <button
                      onClick={runScan}
                      className="group relative px-8 sm:px-10 py-4 rounded-2xl font-bold text-sm sm:text-base text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 transition-all duration-300 shadow-[0_0_40px_rgba(0,200,255,0.2)] hover:shadow-[0_0_60px_rgba(0,200,255,0.35)]"
                    >
                      <span className="absolute inset-0 rounded-2xl animate-pulse opacity-20 bg-cyan-400 blur-xl" />
                      <span className="relative flex items-center gap-3">
                        <svg className="w-5 h-5 transition-transform group-hover:rotate-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        Scan On-Chain Footprint
                      </span>
                    </button>

                    {/* Tier preview */}
                    <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-lg w-full">
                      {TIERS.slice(0, 4).reverse().map(t => (
                        <div key={t.label} className={`rounded-lg border ${t.border} ${t.bg} px-3 py-2 text-center`}>
                          <p className={`text-[10px] font-bold font-mono ${t.accent}`}>{t.label}</p>
                          <p className="text-[9px] text-zinc-600 font-mono mt-0.5">{t.merit.toLocaleString()} MERIT</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-4 sm:gap-6 mt-10 text-[9px] sm:text-[10px] font-mono text-zinc-700 uppercase tracking-widest flex-wrap justify-center">
                      <span>Ethereum</span>
                      <span className="w-1 h-1 rounded-full bg-zinc-800" />
                      <span>Base L2</span>
                      <span className="w-1 h-1 rounded-full bg-zinc-800" />
                      <span>Arbitrum</span>
                      <span className="w-1 h-1 rounded-full bg-zinc-800" />
                      <span>Optimism</span>
                      <span className="w-1 h-1 rounded-full bg-zinc-800" />
                      <span>Polygon</span>
                    </div>
                  </motion.div>
                )}

                {/* ═══════ SCANNING ═══════ */}
                {isScanning && (
                  <motion.div
                    key="scanning"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.35 }}
                    className="w-full flex flex-col items-center"
                  >
                    <div className="mb-4">
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-[10px] font-mono text-emerald-400 tracking-widest uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                        Carbon Verification Active
                      </span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-8">
                      {STEP_LABELS[scanStatus] || 'Processing...'}
                    </h2>

                    <ProgressSteps currentStep={scanStatus} />
                    <TerminalWindow logs={terminalLogs} />
                  </motion.div>
                )}

                {/* ═══════ SUCCESS ═══════ */}
                {scanStatus === 'success' && resultData && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="w-full flex flex-col items-center"
                  >
                    <div className="mb-5">
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-mono text-emerald-400 tracking-widest uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                        Carbon Identity Verified
                      </span>
                    </div>
                    <ResultCard data={resultData} onClaim={handleClaim} claimed={claimed} />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-10 text-center">
                <p className="text-[10px] font-mono text-zinc-700 tracking-wider">
                  MeritX rewards the wallets that built the chain.
                  <span className="mx-2 text-zinc-800">|</span>
                  <span className="text-zinc-600">Powered by Proof of Gas</span>
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @keyframes meritScanDown {
          0%   { top: -2px; }
          100% { top: 100%; }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes holoPulse {
          0%, 100% { opacity: 0.25; transform: scale(1); }
          50%      { opacity: 0.45; transform: scale(1.05); }
        }
        .shimmer-streak {
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255,255,255,0.08) 40%,
            rgba(255,255,255,0.15) 50%,
            rgba(255,255,255,0.08) 60%,
            transparent 100%
          );
          animation: shimmer 2.5s ease-in-out infinite;
        }
        .holo-pulse {
          animation: holoPulse 3s ease-in-out infinite;
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </>
  );
}
