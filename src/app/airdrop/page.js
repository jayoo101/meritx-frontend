'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SCAN_STATES = ['idle', 'connecting', 'scanning_history', 'analyzing_contracts', 'generating_proof', 'success'];
const TERMINAL_FONT = "'SF Mono', 'Fira Code', 'JetBrains Mono', 'Cascadia Code', Menlo, Consolas, monospace";

const MOCK_RESULT = {
  gasUsed: 1.84,
  ageMultiplier: 1.3,
  contractMultiplier: 1.2,
  meritScore: 12480,
  rank: 'Top 5%',
};

const TERMINAL_LOGS = {
  connecting: [
    'Establishing secure RPC tunnel to Base L2...',
    'Handshake: TLS 1.3 verified',
    'Session key: 0xA3F8...C912',
    'Indexer node connected — latency 12ms',
  ],
  scanning_history: [
    'Fetching EVM nonces from block 0 to HEAD...',
    'Scanning 1,847 transactions across 3 chains',
    'Ethereum Mainnet: 1,204 txns found',
    'Base L2: 583 txns found',
    'Arbitrum One: 60 txns found',
    'Calculating historical basefee deltas...',
    'Gas burned: aggregating wei totals...',
    'Cross-referencing MEV exposure windows...',
    'Block range verified: 14,000,001 — 19,842,117',
  ],
  analyzing_contracts: [
    'Indexing unique contract interactions...',
    'DeFi protocols detected: 14',
    'NFT mints: 7 collections',
    'Governance votes: 3 DAOs',
    'Bridge transactions: 2 (L1 → L2)',
    'Diversity score: EXCELLENT',
    'Sybil resistance check: PASSED',
    'PoHG signature: 0x7B2F...E4D1 [VALID]',
  ],
  generating_proof: [
    'Constructing Merkle proof...',
    'Leaf hash: keccak256(address, gasWei, nonce)',
    'Proof depth: 18 layers',
    'Root: 0x9C3A...71F0',
    'Allocation computed: 12,480 MERIT',
    'Proof generated successfully.',
  ],
};

const STEP_LABELS = {
  connecting: 'CONNECTING TO INDEXER',
  scanning_history: 'SCANNING ON-CHAIN HISTORY',
  analyzing_contracts: 'ANALYZING CONTRACT DIVERSITY',
  generating_proof: 'GENERATING MERIT PROOF',
};

const STEP_DURATION_MS = 1500;

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

function ScanlineOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
      <div
        className="absolute inset-x-0 h-[2px] opacity-[0.07]"
        style={{
          background: 'linear-gradient(90deg, transparent, #00ffaa, transparent)',
          animation: 'scanDown 3s ease-in-out infinite',
        }}
      />
    </div>
  );
}

function TerminalWindow({ logs }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  return (
    <div
      className="relative w-full max-w-2xl rounded-xl border border-emerald-500/20 bg-black/90 backdrop-blur-sm overflow-hidden shadow-[0_0_40px_rgba(0,255,170,0.06)]"
      style={{ fontFamily: TERMINAL_FONT }}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-emerald-500/10 bg-emerald-950/20">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
        <span className="ml-3 text-[10px] text-emerald-500/40 tracking-widest uppercase">meritx-indexer v2.1.0</span>
      </div>
      <div className="px-4 py-4 h-64 overflow-y-auto scrollbar-hide">
        {logs.map((log, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15 }}
            className="flex gap-2 text-[11px] leading-relaxed mb-1"
          >
            <span className="text-emerald-600/50 shrink-0 select-none">&gt;</span>
            <span className={i === logs.length - 1 ? 'text-emerald-400' : 'text-emerald-500/60'}>
              {log}
            </span>
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

function ResultCard({ data }) {
  const gasDisplay = useCountUp(data.gasUsed * 100, 1400, true);
  const scoreDisplay = useCountUp(data.meritScore, 1800, true);

  const tweetText = encodeURIComponent(
    `I contributed ${data.gasUsed} ETH gas to Ethereum.\nClaimed ${data.meritScore.toLocaleString()} MERIT on MeritX.\n\nWhat's your on-chain merit?\n\n@MeritX_HQ #ProofOfGas`
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-2xl"
    >
      <div className="relative rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-zinc-900/90 to-black/95 backdrop-blur-xl overflow-hidden shadow-[0_0_60px_rgba(0,200,255,0.08)]">
        <ScanlineOverlay />

        <div className="relative z-20 p-8 sm:p-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[10px] font-mono text-cyan-500/60 tracking-[0.2em] uppercase mb-1">Proof of Gas Verified</p>
              <h2 className="text-2xl font-black text-white tracking-tight">Merit Allocation</h2>
            </div>
            <div className="px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
              <span className="text-[11px] font-bold font-mono text-emerald-400 tracking-wider">{data.rank}</span>
            </div>
          </div>

          {/* Three Pillars */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            {[
              { icon: '⛽', label: 'Gas Burned', value: `${(gasDisplay / 100).toFixed(2)} ETH`, accent: 'text-orange-400', border: 'border-orange-500/20', bg: 'bg-orange-500/[0.05]' },
              { icon: '⏳', label: 'Wallet Age', value: `${data.ageMultiplier}x`, accent: 'text-purple-400', border: 'border-purple-500/20', bg: 'bg-purple-500/[0.05]' },
              { icon: '📜', label: 'Diversity', value: `${data.contractMultiplier}x`, accent: 'text-blue-400', border: 'border-blue-500/20', bg: 'bg-blue-500/[0.05]' },
            ].map(p => (
              <div key={p.label} className={`rounded-xl border ${p.border} ${p.bg} p-4 text-center`}>
                <span className="text-2xl block mb-2">{p.icon}</span>
                <p className={`text-lg font-black ${p.accent} font-mono`}>{p.value}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">{p.label}</p>
              </div>
            ))}
          </div>

          {/* Score */}
          <div className="text-center mb-10">
            <p className="text-[10px] font-mono text-zinc-600 tracking-[0.3em] uppercase mb-3">Total Merit Score</p>
            <div className="relative inline-block">
              <h3
                className="text-6xl sm:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300"
                style={{
                  fontFamily: TERMINAL_FONT,
                  filter: 'drop-shadow(0 0 30px rgba(0, 200, 255, 0.4))',
                }}
              >
                {scoreDisplay.toLocaleString()}
              </h3>
              <p className="text-sm font-bold text-cyan-500/60 tracking-widest mt-1">MERIT</p>
            </div>
          </div>

          {/* Formula */}
          <div className="flex items-center justify-center gap-2 mb-10 text-[10px] font-mono text-zinc-600">
            <span>Gas({data.gasUsed})</span>
            <span className="text-zinc-700">×</span>
            <span>Age({data.ageMultiplier}x)</span>
            <span className="text-zinc-700">×</span>
            <span>Div({data.contractMultiplier}x)</span>
            <span className="text-zinc-700">=</span>
            <span className="text-cyan-500 font-bold">{data.meritScore.toLocaleString()}</span>
          </div>

          {/* Share */}
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={`https://twitter.com/intent/tweet?text=${tweetText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white text-black font-bold text-sm hover:bg-zinc-200 transition-all shadow-lg"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              Share on X
            </a>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 py-3.5 rounded-xl border border-zinc-700 text-zinc-400 font-bold text-sm hover:border-cyan-500/40 hover:text-white transition-all"
            >
              Scan Again
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function AirdropPage() {
  const [scanStatus, setScanStatus] = useState('idle');
  const [terminalLogs, setTerminalLogs] = useState([]);
  const logIntervalRef = useRef(null);

  const isScanning = scanStatus !== 'idle' && scanStatus !== 'success';

  const drainLogs = useCallback((phase, onDone) => {
    const lines = TERMINAL_LOGS[phase] || [];
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
    }, STEP_DURATION_MS / lines.length);
  }, []);

  const simulateScan = useCallback(() => {
    setTerminalLogs([]);
    setScanStatus('connecting');

    const phases = ['connecting', 'scanning_history', 'analyzing_contracts', 'generating_proof'];
    let delay = 0;

    phases.forEach((phase, idx) => {
      setTimeout(() => {
        setScanStatus(phase);
        drainLogs(phase, idx === phases.length - 1 ? () => {
          setTimeout(() => setScanStatus('success'), 600);
        } : undefined);
      }, delay);
      delay += STEP_DURATION_MS;
    });
  }, [drainLogs]);

  useEffect(() => {
    return () => clearInterval(logIntervalRef.current);
  }, []);

  return (
    <div className="min-h-screen font-sans selection:bg-cyan-600/30 relative overflow-hidden" style={{ background: '#030712' }}>
      {/* Background grid effect */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,255,200,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,200,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <main className="relative z-10 max-w-4xl mx-auto px-4 flex flex-col items-center justify-center min-h-[calc(100vh-200px)] py-20">
        <AnimatePresence mode="wait">
          {/* ═══════ IDLE STATE ═══════ */}
          {scanStatus === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="text-center flex flex-col items-center"
            >
              <div className="mb-6">
                <span className="inline-block px-3 py-1 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-[10px] font-mono text-cyan-400 tracking-widest uppercase">
                  Season 1 — Base L2
                </span>
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter text-white mb-4 leading-[0.95]">
                The Merit<span className="text-cyan-400"> Drop</span>
              </h1>
              <p className="text-lg sm:text-xl text-zinc-400 max-w-lg leading-relaxed mb-3">
                The wallets that powered the chain deserve the future.
              </p>
              <p className="text-sm text-zinc-600 font-mono max-w-md mb-12">
                Your gas history is your credential. Every wei burned is proof of commitment.
              </p>

              <button
                onClick={simulateScan}
                className="group relative px-10 py-4 rounded-2xl font-bold text-base text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 transition-all duration-300 shadow-[0_0_40px_rgba(0,200,255,0.2)] hover:shadow-[0_0_60px_rgba(0,200,255,0.35)]"
              >
                <span className="absolute inset-0 rounded-2xl animate-pulse opacity-20 bg-cyan-400 blur-xl" />
                <span className="relative flex items-center gap-3">
                  <svg className="w-5 h-5 transition-transform group-hover:rotate-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  Initiate Proof of Gas Scan
                </span>
              </button>

              {/* Trust signals */}
              <div className="flex items-center gap-6 mt-16 text-[10px] font-mono text-zinc-700 uppercase tracking-widest">
                <span>Ethereum</span>
                <span className="w-1 h-1 rounded-full bg-zinc-800" />
                <span>Base L2</span>
                <span className="w-1 h-1 rounded-full bg-zinc-800" />
                <span>Arbitrum</span>
                <span className="w-1 h-1 rounded-full bg-zinc-800" />
                <span>Optimism</span>
              </div>
            </motion.div>
          )}

          {/* ═══════ SCANNING STATES ═══════ */}
          {isScanning && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="w-full flex flex-col items-center"
            >
              <div className="mb-4">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-[10px] font-mono text-emerald-400 tracking-widest uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  Scanning in progress
                </span>
              </div>

              <h2 className="text-2xl font-black text-white tracking-tight mb-8">
                {STEP_LABELS[scanStatus] || 'Processing...'}
              </h2>

              <ProgressSteps currentStep={scanStatus} />
              <TerminalWindow logs={terminalLogs} />
            </motion.div>
          )}

          {/* ═══════ SUCCESS STATE ═══════ */}
          {scanStatus === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="w-full flex flex-col items-center"
            >
              <div className="mb-6">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-mono text-emerald-400 tracking-widest uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  Proof Verified
                </span>
              </div>
              <ResultCard data={MOCK_RESULT} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="relative z-10 py-8 text-center border-t border-zinc-900">
        <p className="text-[11px] font-mono text-zinc-700 tracking-wider">
          MeritX rewards the wallets that built the chain.
          <span className="mx-2 text-zinc-800">|</span>
          <span className="text-zinc-600">TOTAL GAS REWARDED: 1,482 ETH</span>
        </p>
      </footer>

      <style jsx global>{`
        @keyframes scanDown {
          0%   { top: -2px; }
          100% { top: 100%; }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
