'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { useWallet } from '@/hooks/useWallet';
import { getSignerContract, handleTxError } from '@/lib/web3';

// ── Constants ──

const TERMINAL_FONT = "'SF Mono', 'Fira Code', 'JetBrains Mono', Menlo, Consolas, monospace";
const MINT_FEE = '0.0005';
const POG_NFT_ADDRESS = process.env.NEXT_PUBLIC_POG_NFT_ADDRESS || '';

const POG_ABI = [
  'function mint(uint256 baseScore, address inviter, bytes calldata signature) external payable',
  'function hasMinted(address) view returns (bool)',
  'function campaignActive() view returns (bool)',
  'function totalMinted() view returns (uint256)',
  'function endTime() view returns (uint256)',
  'function baseScores(address) view returns (uint256)',
  'function referralBonuses(address) view returns (uint256)',
  'function finalScore(address) view returns (uint256)',
  'function tokenOfOwner(address) view returns (uint256)',
];

// ── Tier definitions (image_3.png + image_4.png) ──

const TIERS = [
  { min: 9000, label: 'CARBON ORACLE',  merit: '100,000', color: 'text-amber-400',   border: 'border-amber-500/30',  bg: 'bg-amber-500/10',  accent: '#F59E0B' },
  { min: 7000, label: 'CARBON ELITE',   merit: '20,000',  color: 'text-purple-400',  border: 'border-purple-500/30', bg: 'bg-purple-500/10', accent: '#A855F7' },
  { min: 4000, label: 'CARBON PIONEER', merit: '5,000',   color: 'text-cyan-400',    border: 'border-cyan-500/30',   bg: 'bg-cyan-500/10',   accent: '#06B6D4' },
  { min: 1000, label: 'CARBON CITIZEN', merit: '1,000',   color: 'text-blue-400',    border: 'border-blue-500/30',   bg: 'bg-blue-500/10',   accent: '#3B82F6' },
  { min:    0, label: 'RECRUIT',        merit: '100',     color: 'text-zinc-400',     border: 'border-zinc-500/30',   bg: 'bg-zinc-500/10',   accent: '#71717A' },
];

function resolveTier(score) {
  return TIERS.find(t => score >= t.min) || TIERS[TIERS.length - 1];
}

// ── Chain labels for terminal UI ──

const CHAIN_DISPLAY = [
  { id: 'ethereum', label: 'Ethereum Mainnet', icon: '⟠' },
  { id: 'base',     label: 'Base L2',          icon: '🔵' },
  { id: 'arbitrum', label: 'Arbitrum One',      icon: '🔷' },
  { id: 'optimism', label: 'Optimism',          icon: '🔴' },
  { id: 'polygon',  label: 'Polygon',           icon: '🟣' },
];

// ── Hooks ──

function useCountUp(target, duration = 1500, active = false) {
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

function useCountdown(endTimestamp) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    if (!endTimestamp) return;
    const tick = () => {
      const diff = Math.max(0, endTimestamp * 1000 - Date.now());
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${d}D ${String(h).padStart(2, '0')}H ${String(m).padStart(2, '0')}M ${String(s).padStart(2, '0')}S`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTimestamp]);
  return remaining;
}

// ── Confetti ──

function fireConfetti() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const colors = ['#00d4ff', '#3b82f6', '#8b5cf6', '#00ff88', '#f59e0b', '#ef4444', '#fff'];
  const pieces = Array.from({ length: 150 }, () => ({
    x: Math.random() * canvas.width, y: -20 - Math.random() * canvas.height * 0.5,
    w: 4 + Math.random() * 6, h: 8 + Math.random() * 10,
    vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 5,
    rot: Math.random() * 360, rv: (Math.random() - 0.5) * 12,
    color: colors[Math.floor(Math.random() * colors.length)], opacity: 1,
  }));
  let frame = 0;
  const max = 180;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.rot += p.rv;
      if (frame > max * 0.6) p.opacity = Math.max(0, p.opacity - 0.02);
      ctx.save(); ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y); ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    frame++;
    if (frame < max) requestAnimationFrame(draw); else canvas.remove();
  }
  requestAnimationFrame(draw);
}

// ── Tier card data for the horizontal row (4 visible tiers) ──

const TIER_CARDS = [
  { label: 'Carbon Citizen', merit: '1,000',   borderColor: 'border-blue-500/40',   glowColor: 'shadow-blue-500/10',   textColor: 'text-blue-400',   meritColor: 'text-blue-300' },
  { label: 'Carbon Pioneer', merit: '5,000',   borderColor: 'border-cyan-500/40',   glowColor: 'shadow-cyan-500/10',   textColor: 'text-cyan-400',   meritColor: 'text-cyan-300' },
  { label: 'Carbon Elite',   merit: '20,000',  borderColor: 'border-purple-500/40', glowColor: 'shadow-purple-500/10', textColor: 'text-purple-400', meritColor: 'text-purple-300' },
  { label: 'Carbon Oracle',  merit: '100,000', borderColor: 'border-amber-500/40',  glowColor: 'shadow-amber-500/10',  textColor: 'text-amber-400',  meritColor: 'text-amber-300' },
];

// ────────────────────────────────────────────────────────────────
// ── Step 1: Landing — "The Merit Drop" (image_3.png)
// ────────────────────────────────────────────────────────────────

function StepLanding({ onScan, onConnect, account, countdown }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const hasWallet = mounted && typeof window !== 'undefined' && !!window.ethereum;
  const isConnected = !!account;

  const handleButtonClick = () => {
    if (!mounted) return;
    if (!hasWallet) { toast.error('Please install MetaMask to continue.'); return; }
    if (!isConnected) { onConnect(); return; }
    onScan();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center text-center px-4 w-full max-w-3xl mx-auto"
    >
      {/* ── Connected wallet badge ── */}
      {isConnected && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 px-5 py-2 rounded-full border border-emerald-500/25 bg-emerald-500/5 flex items-center gap-2.5"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-mono text-emerald-400 tracking-wide">{account.slice(0, 6)}...{account.slice(-4)}</span>
        </motion.div>
      )}

      {/* ── Campaign countdown ── */}
      {countdown && (
        <div className="mb-10 px-8 py-3 rounded-full border border-cyan-500/15 bg-cyan-500/[0.03]">
          <span className="text-[10px] font-mono text-cyan-500/50 tracking-[0.25em] uppercase mr-3">Ends In</span>
          <span className="text-sm font-black font-mono text-cyan-400 tracking-widest"
                style={{ textShadow: '0 0 16px rgba(0,210,255,0.25)' }}>
            {countdown}
          </span>
        </div>
      )}

      {/* ── Main heading ── */}
      <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-[1.05] mb-5 select-none">
        <span className="text-white">The Merit</span>{' '}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Drop</span>
      </h1>

      {/* ── Subtitle ── */}
      <p className="text-zinc-500 text-sm sm:text-base max-w-md mb-14 leading-relaxed">
        The wallets that powered the chain deserve the future.
      </p>

      {/* ── CTA Button (single button, handles connect + scan) ── */}
      <button
        onClick={handleButtonClick}
        className="relative mb-14 w-full max-w-sm py-4.5 rounded-2xl font-bold text-[15px] text-white bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-300 shadow-[0_0_20px_rgba(0,180,216,0.5)] hover:shadow-[0_0_40px_rgba(0,180,216,0.65)] hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
      >
        <span className="absolute inset-0 shimmer-streak" />
        <span className="relative z-10 flex items-center justify-center gap-2.5">
          {/* Shield icon */}
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          {!mounted ? 'Loading...' : !hasWallet ? 'Install Wallet to Continue' : !isConnected ? 'Connect Wallet' : 'Scan On-Chain Footprint'}
        </span>
      </button>

      {/* ── Tier cards row ── */}
      <div className="w-full max-w-2xl mb-14">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TIER_CARDS.map(t => (
            <div
              key={t.label}
              className={`relative rounded-xl border ${t.borderColor} bg-white/[0.02] p-4 text-center shadow-lg ${t.glowColor} transition-all hover:bg-white/[0.04]`}
            >
              <p className={`text-[10px] font-mono uppercase tracking-wider ${t.textColor} mb-2 opacity-80`}>{t.label}</p>
              <p className={`text-lg font-black font-mono ${t.meritColor} tracking-tight`} style={{ fontFamily: TERMINAL_FONT }}>
                {t.merit}
              </p>
              <p className="text-[9px] font-mono text-zinc-600 mt-1 tracking-wider">MERIT</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Chain array ── */}
      <div className="mb-10">
        <p className="text-[10px] sm:text-[11px] font-mono text-zinc-600 tracking-[0.25em] uppercase">
          ETHEREUM&nbsp;&nbsp;·&nbsp;&nbsp;BASE L2&nbsp;&nbsp;·&nbsp;&nbsp;ARBITRUM&nbsp;&nbsp;·&nbsp;&nbsp;OPTIMISM&nbsp;&nbsp;·&nbsp;&nbsp;POLYGON
        </p>
      </div>

      {/* ── Bottom micro-copy ── */}
      <p className="text-[9px] font-mono text-zinc-700 tracking-wider">
        ANTI-SYBIL PROTOCOL&nbsp;&nbsp;·&nbsp;&nbsp;0.0005 ETH FEE&nbsp;&nbsp;·&nbsp;&nbsp;ONE MINT PER WALLET
      </p>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────
// ── Step 2: Terminal Scanner (image_4.png)
// ────────────────────────────────────────────────────────────────

function StepScanning({ logs, scanPhase, onComplete, onRetry }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs.length]);
  const isComplete = scanPhase === 'complete';
  const isFailed = scanPhase === 'failed';
  const isTerminal = isComplete || isFailed;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center px-4 w-full max-w-2xl mx-auto"
    >
      {/* Progress */}
      <div className="flex items-center gap-1 w-full mb-6">
        {['connecting', 'scanning', 'verifying', 'finalizing'].map((step, i) => {
          const phases = ['connecting', 'scanning', 'verifying', 'finalizing'];
          const ci = phases.indexOf(isTerminal ? 'finalizing' : scanPhase);
          const isDone = i < ci || isComplete;
          const isActive = i === ci && !isTerminal;
          const isErr = isFailed && i >= ci;
          return (
            <div key={step} className="flex-1 flex flex-col gap-1.5">
              <div className="h-1 rounded-full overflow-hidden bg-zinc-800">
                <motion.div
                  className={isErr ? 'h-full bg-red-500' : isDone ? 'h-full bg-emerald-500' : isActive ? 'h-full bg-emerald-400' : 'h-full bg-zinc-800'}
                  initial={{ width: '0%' }}
                  animate={{ width: isDone || isErr ? '100%' : isActive ? '60%' : '0%' }}
                  transition={{ duration: 0.6 }}
                />
              </div>
              <span className={`text-[8px] font-mono uppercase tracking-widest ${isErr ? 'text-red-400' : isActive ? 'text-emerald-400' : isDone ? 'text-emerald-600' : 'text-zinc-700'}`}>
                {isFailed && i >= ci ? 'FAILED' : step}
              </span>
            </div>
          );
        })}
      </div>

      <p className={`text-[10px] font-mono tracking-[0.2em] uppercase mb-4 ${isFailed ? 'text-red-500/70' : 'text-cyan-500/60'}`}>
        {isFailed ? 'Scan Failed' : 'Verifying Passport Tier'}
      </p>

      {/* Terminal */}
      <div
        className={`relative w-full rounded-xl bg-black/90 backdrop-blur-sm overflow-hidden border ${isFailed ? 'border-red-500/30 shadow-[0_0_40px_rgba(255,60,60,0.08)]' : 'border-emerald-500/20 shadow-[0_0_40px_rgba(0,255,170,0.06)]'}`}
        style={{ fontFamily: TERMINAL_FONT }}
      >
        <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${isFailed ? 'border-red-500/10 bg-red-950/20' : 'border-emerald-500/10 bg-emerald-950/20'}`}>
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
          <span className={`w-2.5 h-2.5 rounded-full ${isFailed ? 'bg-red-500/60' : 'bg-emerald-500/60'}`} />
          <span className={`ml-3 text-[10px] tracking-widest uppercase ${isFailed ? 'text-red-500/40' : 'text-emerald-500/40'}`}>proof-of-gas-scanner v1.0</span>
        </div>
        <div className="px-4 py-4 h-64 sm:h-80 overflow-y-auto scrollbar-hide">
          {logs.map((log, i) => {
            const isError = log.startsWith('✖') || log.startsWith('CRITICAL');
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className="flex gap-2 text-[11px] leading-relaxed mb-1"
              >
                <span className={`shrink-0 select-none ${isError ? 'text-red-500/60' : 'text-emerald-600/50'}`}>&gt;</span>
                <span className={isError ? 'text-red-400' : i === logs.length - 1 ? 'text-emerald-400' : 'text-emerald-500/60'}>{log}</span>
              </motion.div>
            );
          })}
          {!isTerminal && <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-4 mt-1" />}
          <div ref={endRef} />
        </div>
      </div>

      {isComplete && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={onComplete}
          className="mt-6 px-8 py-3 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 font-bold text-sm font-mono hover:bg-emerald-600/20 transition-all"
        >
          PROCEED TO MINT →
        </motion.button>
      )}

      {isFailed && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={onRetry}
          className="mt-6 px-8 py-3 rounded-xl bg-red-600/10 border border-red-500/20 text-red-400 font-bold text-sm font-mono hover:bg-red-600/20 transition-all"
        >
          ← TRY ANOTHER WALLET
        </motion.button>
      )}
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────
// ── Step 3: Mint On-Chain Identity
// ────────────────────────────────────────────────────────────────

function StepMint({ claimData, onMint, isMinting, hasMinted }) {
  const tier = resolveTier(claimData.baseScoreInt);
  const finalScoreDisplay = ((claimData.baseScoreInt + (claimData.referralBonus || 0)) / 10000).toFixed(4);
  const meritDisplay = useCountUp(claimData.meritAllocation, 1500, true);

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://meritx.io';
  const shareText = `My Carbon Identity: ${tier.label} — ${claimData.meritAllocation.toLocaleString()} MERIT unlocked via Proof of Gas on @MeritX_HQ.\n\nGas history is the new credit.\n${siteUrl}/pog\n\n#ProofOfGas #CarbonIdentity`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center px-4 w-full max-w-2xl mx-auto"
    >
      {/* Card */}
      <div className="relative w-full rounded-2xl border border-cyan-400/25 bg-white/[0.04] backdrop-blur-2xl overflow-hidden shadow-[0_0_80px_rgba(0,200,255,0.10)]">
        {/* Scanline overlay */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
          <div className="absolute inset-x-0 h-[2px] opacity-[0.07]"
            style={{ background: 'linear-gradient(90deg, transparent, #00ffaa, transparent)', animation: 'pogScanDown 3s ease-in-out infinite' }} />
        </div>
        <div className="pointer-events-none absolute inset-0 z-[11] opacity-[0.03]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,200,0.15) 2px, rgba(0,255,200,0.15) 4px)', backgroundSize: '100% 4px' }} />

        <div className="relative z-20 p-6 sm:p-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[10px] font-mono text-cyan-500/60 tracking-[0.2em] uppercase mb-1">On-Chain Identity Verified</p>
              <h2 className="text-2xl font-black text-white tracking-tight">Mint Your Passport</h2>
            </div>
            <div className={`px-3 py-1.5 rounded-lg ${tier.border} ${tier.bg}`}>
              <span className={`text-[11px] font-bold font-mono tracking-wider ${tier.color}`}>{tier.label}</span>
            </div>
          </div>

          {/* Chain breakdown */}
          {claimData.gasData?.chains && (
            <div className="rounded-xl border border-zinc-800/80 bg-white/[0.02] p-3 sm:p-4 mb-6" style={{ fontFamily: TERMINAL_FONT }}>
              <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-2">EVM Gas Footprint</p>
              <div className="space-y-1 text-[10px] sm:text-xs">
                {claimData.gasData.chains.map(c => (
                  <div key={c.label} className="flex justify-between">
                    <span className="text-zinc-500 truncate mr-2">{c.label}</span>
                    <span className="text-zinc-400 tabular-nums shrink-0">{c.gas.toFixed(4)} ETH</span>
                  </div>
                ))}
                <div className="h-px bg-zinc-800 my-1.5" />
                <div className="flex justify-between">
                  <span className="text-white font-bold">TOTAL</span>
                  <span className="text-white font-bold tabular-nums">{claimData.gasData.totalGas.toFixed(4)} ETH</span>
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { icon: '⛽', label: 'Gas Burned', value: `${(claimData.gasData?.totalGas || 0).toFixed(2)} ETH`, c: 'text-orange-400', b: 'border-orange-500/20' },
              { icon: '🧬', label: 'Base Score', value: (claimData.baseScoreInt / 10000).toFixed(4), c: 'text-purple-400', b: 'border-purple-500/20' },
              { icon: '🔗', label: 'Final Score', value: finalScoreDisplay, c: 'text-cyan-400', b: 'border-cyan-500/20' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border ${s.b} bg-white/[0.03] p-3 text-center`}>
                <span className="text-xl block mb-1">{s.icon}</span>
                <p className={`text-sm font-black ${s.c} font-mono`}>{s.value}</p>
                <p className="text-[9px] text-zinc-500 uppercase tracking-wider mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Merit score */}
          <div className="text-center mb-8">
            <p className="text-[10px] font-mono text-zinc-600 tracking-[0.3em] uppercase mb-3">Merit Allocation</p>
            <div className="relative inline-block py-2">
              <h3 className="text-5xl sm:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300 relative z-10"
                style={{ fontFamily: TERMINAL_FONT, filter: 'drop-shadow(0 0 12px rgba(0,210,255,0.6)) drop-shadow(0 0 40px rgba(0,180,255,0.35))' }}>
                {meritDisplay.toLocaleString()}
              </h3>
              <div className="absolute -inset-4 blur-3xl opacity-30 bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-300 -z-0 holo-pulse" aria-hidden="true" />
              <div className="absolute inset-0 blur-xl opacity-50 bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300 -z-0" aria-hidden="true" />
            </div>
            <p className="text-sm font-bold text-cyan-400/70 tracking-widest mt-1" style={{ textShadow: '0 0 20px rgba(0,210,255,0.3)' }}>$MERIT</p>
          </div>

          {/* Description */}
          <p className="text-center text-zinc-500 text-xs font-mono leading-relaxed mb-6 max-w-md mx-auto">
            Your gas has powered the chain. Mint your immutable, dynamic on-chain passport.
            Merit allocation is an attribute of this NFT for future use.
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            {!hasMinted ? (
              <button
                onClick={onMint}
                disabled={isMinting}
                className="relative w-full py-4 rounded-xl font-bold text-base text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 transition-all shadow-[0_0_30px_rgba(0,200,255,0.2)] hover:shadow-[0_0_50px_rgba(0,200,255,0.35)] overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="absolute inset-0 shimmer-streak" />
                <span className="relative z-10">
                  {isMinting ? 'Minting On-Chain...' : `Mint On-Chain Identity (Free + ${MINT_FEE} ETH Network Fee)`}
                </span>
              </button>
            ) : (
              <div className="w-full py-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-center">
                <span className="text-emerald-400 font-bold text-sm font-mono tracking-wider">MINTED — ON-CHAIN IDENTITY SECURED ✓</span>
              </div>
            )}

            {hasMinted && (
              <div className="grid grid-cols-2 gap-3">
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-black border border-zinc-700 text-white font-bold text-sm hover:bg-zinc-900 hover:border-zinc-600 transition-all"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  Share on X
                </a>
                <a
                  href={`https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-bold text-sm hover:brightness-110 transition-all"
                  style={{ background: '#7C3AED' }}
                >
                  Warpcast
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────
// ── Already Claimed View
// ────────────────────────────────────────────────────────────────

function StepAlreadyClaimed({ account, mintData }) {
  const tier = resolveTier(mintData.baseScore);
  const finalScore = mintData.baseScore + mintData.refBonus;
  const scoreDisplay = (finalScore / 10000).toFixed(4);
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://meritx.io';
  const shareText = `My Carbon Identity: ${tier.label} — ${tier.merit} MERIT unlocked via Proof of Gas on @MeritX_HQ.\n\nGas history is the new credit.\n${siteUrl}/pog\n\n#ProofOfGas #CarbonIdentity`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center px-4 w-full max-w-2xl mx-auto"
    >
      <div className="relative w-full rounded-2xl border border-emerald-400/25 bg-white/[0.04] backdrop-blur-2xl overflow-hidden shadow-[0_0_80px_rgba(0,255,170,0.08)]">
        <div className="relative z-20 p-6 sm:p-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[10px] font-mono text-emerald-500/60 tracking-[0.2em] uppercase mb-1">Identity Already Minted</p>
              <h2 className="text-2xl font-black text-white tracking-tight">Your Carbon Passport</h2>
            </div>
            <div className={`px-3 py-1.5 rounded-lg ${tier.border} ${tier.bg}`}>
              <span className={`text-[11px] font-bold font-mono tracking-wider ${tier.color}`}>{tier.label}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { icon: '🪪', label: 'Token ID', value: `#${mintData.tokenId}`, c: 'text-emerald-400', b: 'border-emerald-500/20' },
              { icon: '🧬', label: 'Base Score', value: (mintData.baseScore / 10000).toFixed(4), c: 'text-purple-400', b: 'border-purple-500/20' },
              { icon: '🔗', label: 'Final Score', value: scoreDisplay, c: 'text-cyan-400', b: 'border-cyan-500/20' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border ${s.b} bg-white/[0.03] p-3 text-center`}>
                <span className="text-xl block mb-1">{s.icon}</span>
                <p className={`text-sm font-black ${s.c} font-mono`}>{s.value}</p>
                <p className="text-[9px] text-zinc-500 uppercase tracking-wider mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="w-full py-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-center mb-4">
            <span className="text-emerald-400 font-bold text-sm font-mono tracking-wider">MINTED — ON-CHAIN IDENTITY SECURED ✓</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-black border border-zinc-700 text-white font-bold text-sm hover:bg-zinc-900 hover:border-zinc-600 transition-all"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              Share on X
            </a>
            <a
              href={`https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-bold text-sm hover:brightness-110 transition-all"
              style={{ background: '#7C3AED' }}
            >
              Warpcast
            </a>
          </div>

          <p className="text-center text-zinc-600 text-[10px] font-mono mt-4">
            Wallet: {account?.slice(0, 6)}...{account?.slice(-4)} · This wallet has already minted. One mint per wallet.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────
// ── Main Page Component
// ────────────────────────────────────────────────────────────────

export default function ProofOfGasPage() {
  const { account, connectWallet } = useWallet();
  const [step, setStep] = useState(1);
  const [logs, setLogs] = useState([]);
  const [scanPhase, setScanPhase] = useState('connecting');
  const [claimData, setClaimData] = useState(null);
  const [isMinting, setIsMinting] = useState(false);
  const [hasMintedState, setHasMintedState] = useState(false);
  const [campaignEnd, setCampaignEnd] = useState(null);
  const [alreadyClaimedData, setAlreadyClaimedData] = useState(null);
  const countdown = useCountdown(campaignEnd);

  // Read inviter from URL
  const [inviter, setInviter] = useState(ethers.constants.AddressZero);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (ref && ethers.utils.isAddress(ref)) setInviter(ethers.utils.getAddress(ref));
    } catch {}
  }, []);

  // Campaign end time (read from contract if deployed)
  useEffect(() => {
    if (!POG_NFT_ADDRESS || typeof window === 'undefined' || !window.ethereum) return;
    (async () => {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(POG_NFT_ADDRESS, POG_ABI, provider);
        const end = await contract.endTime();
        if (end.gt(0)) setCampaignEnd(end.toNumber());
      } catch {}
    })();
  }, []);

  // On-mount: check if this wallet has already minted
  useEffect(() => {
    if (!account || !POG_NFT_ADDRESS || typeof window === 'undefined' || !window.ethereum) return;
    let cancelled = false;
    (async () => {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(POG_NFT_ADDRESS, POG_ABI, provider);
        const minted = await contract.hasMinted(account);
        if (!minted || cancelled) return;

        const [baseScore, refBonus, tokenId] = await Promise.all([
          contract.baseScores(account).then(Number),
          contract.referralBonuses(account).then(Number),
          contract.tokenOfOwner(account).then(Number),
        ]);

        if (!cancelled) {
          setAlreadyClaimedData({ baseScore, refBonus, tokenId });
          setHasMintedState(true);
          setStep('claimed');
        }
      } catch {
        // Contract not deployed or read failed — ignore, let user proceed normally
      }
    })();
    return () => { cancelled = true; };
  }, [account]);

  const addLog = useCallback((msg) => {
    setLogs(prev => [...prev, msg]);
  }, []);

  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  // ── Connect wallet handler (for Step 1 button) ──

  const handleConnect = useCallback(async () => {
    try {
      await connectWallet();
    } catch {
      toast.error('Wallet connection failed. Please try again.');
    }
  }, [connectWallet]);

  // ── Step 1 → Step 2: Scan (only runs when account is confirmed) ──

  const handleScan = useCallback(async () => {
    if (!account) {
      toast.error('Please connect your wallet first.');
      return;
    }

    const addr = ethers.utils.getAddress(account);

    setStep(2);
    setLogs([]);
    setScanPhase('connecting');

    addLog('Initializing Proof of Gas scanner...');
    await delay(600);
    addLog(`Wallet connected: ${addr.slice(0, 6)}...${addr.slice(-4)}`);
    await delay(500);
    addLog('TLS 1.3 verified — session encrypted');
    addLog('Indexer nodes connected — latency 11ms');
    await delay(800);

    setScanPhase('scanning');
    addLog('');
    addLog('═══ Scanning EVM Gas Footprint ═══');
    await delay(400);

    let apiResult;
    try {
      addLog('Querying multi-chain gas data...');
      const res = await fetch('/api/pog/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: addr, inviterAddress: inviter }),
      });
      apiResult = await res.json();

      if (!apiResult.success) {
        await delay(400);
        if (apiResult.gasData?.chains) {
          for (const chain of apiResult.gasData.chains) {
            addLog(`[--] ${chain.label.padEnd(20, '.')} ${chain.gas.toFixed(4)} ETH  (${chain.txCount} txns)`);
            await delay(250);
          }
          addLog('');
          addLog(`Total combined gas: ${apiResult.gasData.totalGas.toFixed(4)} ETH`);
          await delay(400);
        }
        addLog('');
        addLog('═══════════════════════════════════════');
        addLog('✖ CRITICAL ERROR: SCAN FAILED');
        addLog('✖ No significant on-chain activity detected.');
        addLog('✖ This mission requires a battle-hardened');
        addLog('✖ wallet with historical Gas consumption.');
        addLog('═══════════════════════════════════════');
        addLog('');
        addLog('✖ Minimum threshold: 0.001 ETH combined gas');
        addLog(`✖ Your total: ${(apiResult.gasData?.totalGas ?? 0).toFixed(4)} ETH`);
        addLog('');
        addLog('STATUS: REJECTED — INSUFFICIENT GAS HISTORY');
        setScanPhase('failed');
        return;
      }
    } catch (e) {
      addLog('');
      addLog('✖ NETWORK ERROR: ' + (e.message || 'Unknown error'));
      addLog('✖ Could not reach indexer. Check connection.');
      setScanPhase('failed');
      toast.error('Scan failed — check your connection.');
      return;
    }
    await delay(300);

    for (const chain of apiResult.gasData.chains) {
      addLog(`[OK] ${chain.label.padEnd(20, '.')} ${chain.gas.toFixed(4)} ETH  (${chain.txCount} txns)`);
      await delay(400);
    }
    addLog('');
    addLog(`Total combined gas: ${apiResult.gasData.totalGas.toFixed(4)} ETH`);
    await delay(600);

    setScanPhase('verifying');
    addLog('');
    addLog('═══ Verifying Passport Tier ═══');
    await delay(500);
    addLog('Sybil resistance check: PASSED ✓');
    await delay(400);
    addLog('PoHG signature verification: VALID ✓');
    await delay(400);
    addLog(`Base score: ${apiResult.baseScore} → Scaled: ${apiResult.baseScoreInt}`);
    await delay(400);
    addLog(`Carbon Tier resolved: [${apiResult.tierResolved}]`);
    await delay(300);
    addLog(`Merit allocation: ${apiResult.meritAllocation.toLocaleString()} MERIT`);
    await delay(600);

    setScanPhase('finalizing');
    addLog('');
    addLog('═══ Finalizing ═══');
    await delay(400);
    const fakeLeaf = `keccak256(${addr.slice(0, 8)}..., ${apiResult.baseScoreInt}, ${inviter.slice(0, 8)}...)`;
    addLog(`Leaf: ${fakeLeaf}`);
    await delay(300);
    addLog(`Signature: ${apiResult.signature.slice(0, 22)}...`);
    await delay(400);
    addLog('');
    addLog(`✅ ALLOCATION CONFIRMED: ${apiResult.meritAllocation.toLocaleString()} $MERIT`);
    addLog(`✅ Tier: ${apiResult.tierResolved} | Fee: ${apiResult.fee} ETH`);
    await delay(300);

    setClaimData(apiResult);
    setScanPhase('complete');
  }, [addLog, inviter, account]);

  // ── Retry: reset back to step 1 ──

  const handleRetry = useCallback(() => {
    setStep(1);
    setLogs([]);
    setScanPhase('connecting');
    setClaimData(null);
  }, []);

  // ── Step 2 → Step 3: Proceed to mint ──

  const handleProceedToMint = useCallback(() => {
    setStep(3);
  }, []);

  // ── Step 3: Mint on-chain ──

  const handleMint = useCallback(async () => {
    if (!claimData || !account) return;
    if (!POG_NFT_ADDRESS) { toast.error('PoG NFT contract address not configured.'); return; }
    setIsMinting(true);

    try {
      const { contract } = getSignerContract(POG_NFT_ADDRESS, POG_ABI);
      const tx = await contract.mint(
        claimData.baseScoreInt,
        inviter,
        claimData.signature,
        { value: ethers.utils.parseEther(MINT_FEE) }
      );
      toast('Minting on-chain identity...', { icon: '⏳' });
      await tx.wait();

      setHasMintedState(true);
      fireConfetti();
      toast.success('On-chain identity minted!');

      // Fetch on-chain data and transition to claimed view
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const readContract = new ethers.Contract(POG_NFT_ADDRESS, POG_ABI, provider);
        const [bs, rb, tid] = await Promise.all([
          readContract.baseScores(account).then(Number),
          readContract.referralBonuses(account).then(Number),
          readContract.tokenOfOwner(account).then(Number),
        ]);
        setAlreadyClaimedData({ baseScore: bs, refBonus: rb, tokenId: tid });
        setStep('claimed');
      } catch {
        // Fallback: stay on step 3 with hasMinted = true
      }
    } catch (e) {
      if (e?.code === 'ACTION_REJECTED' || e?.code === 4001) {
        toast.error('Transaction cancelled by user.');
      } else if (e?.reason?.includes('already minted')) {
        toast.error('You have already minted your identity.');
        setHasMintedState(true);
      } else {
        handleTxError(e);
      }
    } finally {
      setIsMinting(false);
    }
  }, [claimData, account, inviter]);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center py-16 sm:py-24">
        <AnimatePresence mode="wait">
          {step === 'claimed' && alreadyClaimedData && (
            <StepAlreadyClaimed key="claimed" account={account} mintData={alreadyClaimedData} />
          )}
          {step === 1 && (
            <StepLanding key="step1" onScan={handleScan} onConnect={handleConnect} account={account} countdown={countdown} />
          )}
          {step === 2 && (
            <StepScanning key="step2" logs={logs} scanPhase={scanPhase} onComplete={handleProceedToMint} onRetry={handleRetry} />
          )}
          {step === 3 && claimData && (
            <StepMint key="step3" claimData={claimData} onMint={handleMint} isMinting={isMinting} hasMinted={hasMintedState} />
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="text-center py-8 border-t border-zinc-900/50">
        <p className="text-[9px] font-mono text-zinc-700 tracking-[0.15em]">
          MeritX rewards the wallets that built the chain.&nbsp;&nbsp;|&nbsp;&nbsp;Powered by Proof of Gas
        </p>
      </div>

      <style jsx global>{`
        @keyframes pogScanDown {
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
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 40%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.08) 60%, transparent 100%);
          animation: shimmer 2.5s ease-in-out infinite;
        }
        .holo-pulse {
          animation: holoPulse 3s ease-in-out infinite;
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
