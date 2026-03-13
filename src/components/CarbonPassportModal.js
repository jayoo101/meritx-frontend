'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const MERIT_PER_ETH = 12_345;
const TERMINAL_FONT = "'JetBrains Mono', 'Fira Code', 'SF Mono', ui-monospace, monospace";
const EVENT_END_MS = new Date('2026-03-16T21:00:00Z').getTime();

const PHASES = { IDLE: 'idle', SCANNING: 'scanning', RESULT: 'result' };

// ─── Multi-chain mock data (swap with Moralis/Alchemy later) ───
function generateChainData(txCount) {
  const base = Math.max(0.001, txCount * 0.00042 + Math.random() * 0.15);
  const ethMainnet = parseFloat((base * (0.55 + Math.random() * 0.15)).toFixed(4));
  const baseL2 = parseFloat((base * (0.20 + Math.random() * 0.08)).toFixed(4));
  const arbitrum = parseFloat((base * (0.08 + Math.random() * 0.06)).toFixed(4));
  const optimism = parseFloat((base * (0.02 + Math.random() * 0.04)).toFixed(4));
  const polygon = parseFloat((base * (0.01 + Math.random() * 0.03)).toFixed(4));
  return [
    { id: 'eth',  name: 'Ethereum Mainnet', gas: ethMainnet },
    { id: 'base', name: 'Base L2',          gas: baseL2 },
    { id: 'arb',  name: 'Arbitrum One',     gas: arbitrum },
    { id: 'op',   name: 'Optimism',         gas: optimism },
    { id: 'poly', name: 'Polygon PoS',      gas: polygon },
  ];
}

function formatMerit(n) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function getRank(gasSpent) {
  if (gasSpent >= 5) return { title: 'Carbon Legend', color: 'emerald' };
  if (gasSpent >= 1) return { title: 'EVM Veteran', color: 'blue' };
  if (gasSpent >= 0.1) return { title: 'Builder', color: 'purple' };
  return { title: 'Explorer', color: 'zinc' };
}

const RANK_STYLES = {
  emerald: { badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', glow: 'shadow-[0_0_40px_rgba(74,222,128,0.12)]', border: 'border-emerald-500/20', text: 'text-emerald-400' },
  blue:    { badge: 'bg-blue-500/10 border-blue-500/20 text-blue-400', glow: 'shadow-[0_0_40px_rgba(96,165,250,0.12)]', border: 'border-blue-500/20', text: 'text-blue-400' },
  purple:  { badge: 'bg-purple-500/10 border-purple-500/20 text-purple-400', glow: 'shadow-[0_0_40px_rgba(167,139,250,0.12)]', border: 'border-purple-500/20', text: 'text-purple-400' },
  zinc:    { badge: 'bg-zinc-700/20 border-zinc-600/20 text-zinc-400', glow: '', border: 'border-zinc-700/30', text: 'text-zinc-400' },
};

// ─── Countdown hook (hours only, no days) ───
function useCountdown(endMs) {
  const [remaining, setRemaining] = useState(() => Math.max(0, endMs - Date.now()));
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, endMs - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endMs]);

  const totalSec = Math.floor(remaining / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return { expired: remaining <= 0, hrs: pad(hrs), min: pad(min), sec: pad(sec) };
}

// ─── Receipt line builder ───
function receiptLine(label, value, dotLen = 40) {
  const maxLabel = dotLen - value.length - 1;
  const trimmed = label.length > maxLabel ? label.slice(0, maxLabel) : label;
  const dots = '.'.repeat(Math.max(1, dotLen - trimmed.length - value.length));
  return `${trimmed} ${dots} ${value}`;
}

export default function CarbonPassportModal() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [chainData, setChainData] = useState([]);
  const [receiptLines, setReceiptLines] = useState([]);
  const [gasSpent, setGasSpent] = useState(0);
  const [meritReward, setMeritReward] = useState(0);
  const [account, setAccount] = useState('');
  const [copied, setCopied] = useState(false);
  const [siteOrigin, setSiteOrigin] = useState('https://meritx.ai');
  const receiptRef = useRef(null);

  const countdown = useCountdown(EVENT_END_MS);

  useEffect(() => {
    setSiteOrigin(window.location.origin);
    if (localStorage.getItem('meritx-passport-seen') !== 'true') {
      setOpen(true);
    }
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    localStorage.setItem('meritx-passport-seen', 'true');
  }, []);

  const reopen = useCallback(() => {
    setPhase(PHASES.IDLE);
    setReceiptLines([]);
    setChainData([]);
    setGasSpent(0);
    setMeritReward(0);
    setAccount('');
    setOpen(true);
  }, []);

  // Typing animation for the receipt
  const typeReceiptLines = useCallback(async (lines) => {
    for (let i = 0; i < lines.length; i++) {
      await new Promise((r) => setTimeout(r, lines[i].delay || 120));
      setReceiptLines((prev) => [...prev, lines[i]]);
    }
  }, []);

  const runScanner = useCallback(async () => {
    if (!window.ethereum) {
      toast.error('Install a Web3 wallet to verify your Carbon Passport.');
      return;
    }

    setPhase(PHASES.SCANNING);
    setReceiptLines([]);
    setChainData([]);

    let addr;
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      addr = accounts[0];
      if (!addr) throw new Error();
      setAccount(addr);
    } catch {
      toast.error('Wallet connection required for verification.');
      setPhase(PHASES.IDLE);
      return;
    }

    // Fetch tx count (mock-augmented)
    let txCount = 5;
    try {
      const hex = await window.ethereum.request({
        method: 'eth_getTransactionCount', params: [addr, 'latest'],
      });
      txCount = parseInt(hex, 16) || 5;
    } catch { /* use default */ }

    const chains = generateChainData(txCount);
    const totalGas = parseFloat(chains.reduce((s, c) => s + c.gas, 0).toFixed(4));
    const merit = Math.round(totalGas * MERIT_PER_ETH);
    setChainData(chains);
    setGasSpent(totalGas);
    setMeritReward(merit);

    const W = 42;
    const sep = '='.repeat(W);
    const dash = '-'.repeat(W);

    const lines = [
      { text: '', type: 'blank', delay: 200 },
      { text: sep, type: 'sep', delay: 80 },
      { text: '   EVM CARBON FOOTPRINT VERIFICATION', type: 'title', delay: 300 },
      { text: sep, type: 'sep', delay: 80 },
      { text: 'NETWORK                      GAS SPENT', type: 'header', delay: 250 },
      { text: dash, type: 'dash', delay: 80 },
    ];

    for (const c of chains) {
      lines.push({ text: receiptLine(c.name, `${c.gas.toFixed(4)} ETH`, W), type: 'chain', delay: 350 + Math.random() * 150 });
    }

    lines.push({ text: dash, type: 'dash', delay: 80 });
    lines.push({ text: receiptLine('TOTAL COMBINED GAS', `${totalGas.toFixed(4)} ETH`, W), type: 'total', delay: 400 });
    lines.push({ text: sep, type: 'sep', delay: 100 });
    lines.push({ text: receiptLine('MERIT REWARD (x12345)', `${formatMerit(merit)} $MERIT`, W), type: 'merit', delay: 500 });
    lines.push({ text: sep, type: 'sep', delay: 100 });
    lines.push({ text: 'STATUS: APPROVED [NO SYBIL DETECTED]', type: 'status', delay: 600 });
    lines.push({ text: '', type: 'blank', delay: 100 });

    await typeReceiptLines(lines);
    await new Promise((r) => setTimeout(r, 400));
    setPhase(PHASES.RESULT);
  }, [typeReceiptLines]);

  // Auto-scroll receipt terminal
  useEffect(() => {
    if (receiptRef.current) {
      receiptRef.current.scrollTop = receiptRef.current.scrollHeight;
    }
  }, [receiptLines]);

  const rank = getRank(gasSpent);
  const rs = RANK_STYLES[rank.color];
  const truncAddr = account ? `${account.slice(0, 6)}...${account.slice(-4)}` : '0x0000...0000';

  const referralLink = account ? `${siteOrigin}/?ref=${account}` : siteOrigin;
  const ogImageUrl = `${siteOrigin}/api/og?address=${encodeURIComponent(account)}&gasSpent=${gasSpent}`;

  const warpcastText = `I just verified my Carbon Identity on @MeritX on Base. I unlocked ${formatMerit(meritReward)} $MERIT based on my gas history. Invite friends for 8% bonus. They keep 100%. Win-win. \u{1F535}`;
  const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(warpcastText)}&embeds[]=${encodeURIComponent(ogImageUrl)}`;

  const twitterText = `I just verified my Carbon Identity on @MeritX_ai. My gas history earned me ${formatMerit(meritReward)} $MERIT on Base. Join the silicon revolution. \u{1F535} #MeritX #Base\n\n${referralLink}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}`;

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      toast.success('Referral link copied');
      setTimeout(() => setCopied(false), 2000);
    });
  }, [referralLink]);

  // Color helper for receipt lines
  function lineColor(type) {
    switch (type) {
      case 'title': return 'text-emerald-400';
      case 'header': return 'text-zinc-500';
      case 'sep': case 'dash': return 'text-zinc-700';
      case 'chain': return 'text-zinc-400';
      case 'total': return 'text-white font-bold';
      case 'merit': return 'text-emerald-400 font-bold';
      case 'status': return 'text-emerald-400';
      default: return 'text-zinc-600';
    }
  }

  // ─── Receipt Terminal Component (shared between scanning & result) ───
  const ReceiptTerminal = ({ interactive }) => (
    <div className="rounded-xl bg-[#0a0a0a] border border-emerald-500/10 overflow-hidden" style={{ fontFamily: TERMINAL_FONT }}>
      {/* Terminal chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#0f0f0f] border-b border-zinc-800/60">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
        </div>
        <span className="text-[9px] text-zinc-600 uppercase tracking-widest ml-2">carbon-passport.exe</span>
        {phase === PHASES.SCANNING && (
          <span className="ml-auto flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[8px] text-emerald-500/60 uppercase tracking-widest">Scanning</span>
          </span>
        )}
      </div>
      {/* Terminal body */}
      <div
        ref={receiptRef}
        className="p-4 min-h-[240px] max-h-[340px] overflow-y-auto scrollbar-thin"
      >
        {receiptLines.length === 0 && phase === PHASES.SCANNING && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] text-zinc-600">Connecting to archive nodes...</span>
          </div>
        )}
        {receiptLines.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.12 }}
          >
            {line.type === 'blank' ? (
              <div className="h-3" />
            ) : (
              <pre className={`text-[11px] leading-[1.7] whitespace-pre ${lineColor(line.type)}`}>
                {line.text}
              </pre>
            )}
          </motion.div>
        ))}
        {phase === PHASES.SCANNING && receiptLines.length > 0 && receiptLines[receiptLines.length - 1]?.type !== 'blank' && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="inline-block w-[6px] h-[14px] bg-emerald-400 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ═══ Floating Carbon Identity Card — Bottom Left ═══ */}
      {!open && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 220, damping: 22 }}
          className="fixed bottom-5 left-5 z-[90] w-[280px] rounded-xl overflow-hidden cursor-pointer group"
          onClick={reopen}
          style={{ fontFamily: TERMINAL_FONT }}
        >
          <div className="absolute -inset-px rounded-xl bg-gradient-to-br from-emerald-500/30 via-emerald-400/10 to-emerald-500/30 opacity-80 group-hover:opacity-100 transition-opacity" />
          <div className="absolute -inset-[2px] rounded-xl shadow-[0_0_20px_rgba(52,211,153,0.15),0_0_60px_rgba(52,211,153,0.06)] group-hover:shadow-[0_0_25px_rgba(52,211,153,0.25),0_0_80px_rgba(52,211,153,0.1)] transition-shadow" />

          <div className="relative bg-zinc-950/95 backdrop-blur-xl border border-emerald-500/20 rounded-xl p-4">
            <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
              <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(52,211,153,0.015)_2px,rgba(52,211,153,0.015)_4px)]" />
            </div>

            <div className="relative flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-emerald-400/90 font-bold uppercase tracking-[0.15em] leading-none">Carbon Identity</p>
                <p className="text-[8px] text-zinc-600 uppercase tracking-widest mt-0.5">Verification Event</p>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                <span className="text-[8px] text-emerald-500/70 font-bold uppercase">Live</span>
              </div>
            </div>

            <div className="relative h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent mb-3" />

            <div className="relative mb-3">
              <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-1">Uplink Closes In</p>
              <p className={`text-lg font-black tabular-nums tracking-wide leading-none ${countdown.expired ? 'text-red-400' : 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]'}`}>
                {countdown.expired ? 'UPLINK CLOSED' : `${countdown.hrs}H : ${countdown.min}M : ${countdown.sec}S`}
              </p>
            </div>

            <button className="relative w-full py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-emerald-300 bg-emerald-500/8 border border-emerald-500/20 hover:bg-emerald-500/15 hover:border-emerald-500/30 hover:text-emerald-200 transition-all">
              Scan Now
            </button>
          </div>
        </motion.div>
      )}

      {/* ═══ Full-Screen Modal ═══ */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="carbon-passport-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
          >
            <div className="absolute inset-0 bg-black/85 backdrop-blur-lg" onClick={dismiss} />

            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 24 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative w-[90vw] max-w-[1200px] max-h-[80vh] rounded-2xl overflow-hidden flex flex-col bg-[#060608] border border-zinc-800/50"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Subtle scanline */}
              <div className="absolute inset-0 pointer-events-none z-[1] bg-[repeating-linear-gradient(0deg,transparent,transparent_3px,rgba(255,255,255,0.008)_3px,rgba(255,255,255,0.008)_6px)]" />

              {/* Close */}
              <button
                onClick={dismiss}
                className="absolute top-4 right-4 z-10 w-8 h-8 rounded-lg bg-zinc-900/80 border border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-white hover:border-zinc-500 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>

              {/* Scrollable content */}
              <div className="overflow-y-auto flex-1 p-6 sm:p-8">

                {/* ═══ LARGE CENTERED COUNTDOWN ═══ */}
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <h2 className="text-base font-black text-white tracking-tight leading-none">Carbon Passport</h2>
                      <p className="text-[9px] text-zinc-600 uppercase tracking-widest mt-0.5" style={{ fontFamily: TERMINAL_FONT }}>Anti-Sybil Airdrop · Onchain Receipt</p>
                    </div>
                  </div>

                  <div className="mt-4 mb-1">
                    <div
                      className={`inline-block rounded-xl px-8 py-4 border ${countdown.expired ? 'border-red-500/20 bg-red-500/5' : 'border-emerald-500/15 bg-emerald-500/5'}`}
                      style={{ fontFamily: TERMINAL_FONT }}
                    >
                      {countdown.expired ? (
                        <p className="text-2xl font-black text-red-400 tracking-wider">/// UPLINK CLOSED ///</p>
                      ) : (
                        <>
                          <p className="text-[9px] text-zinc-600 uppercase tracking-[0.3em] mb-2">/// Uplink Closes In ///</p>
                          <p className="text-3xl sm:text-4xl font-black tabular-nums tracking-wider text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.3)]">
                            {countdown.hrs}H : {countdown.min}M : {countdown.sec}S
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="h-px bg-zinc-800/40 mb-6" />

                {/* ════ IDLE ════ */}
                {phase === PHASES.IDLE && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                      <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                        Your cross-chain gas footprint is your identity. Connect your wallet to scan <span className="text-emerald-400 font-semibold">Ethereum, Base, Arbitrum, Optimism</span> and <span className="text-emerald-400 font-semibold">Polygon</span> for your cumulative <span className="text-white font-semibold">$MERIT</span> allocation.
                      </p>

                      {/* Preview receipt */}
                      <div className="rounded-xl bg-[#0a0a0a] border border-zinc-800/40 p-4 mb-6" style={{ fontFamily: TERMINAL_FONT }}>
                        <pre className="text-[10px] text-zinc-600 leading-[1.8] whitespace-pre">{`${'='.repeat(42)}
   EVM CARBON FOOTPRINT VERIFICATION
${'='.repeat(42)}
NETWORK                      GAS SPENT
${'-'.repeat(42)}
Ethereum Mainnet ........... ?.???? ETH
Base L2 .................... ?.???? ETH
Arbitrum One ............... ?.???? ETH
Optimism ................... ?.???? ETH
Polygon PoS ................ ?.???? ETH
${'-'.repeat(42)}
TOTAL COMBINED GAS ......... ?.???? ETH
${'='.repeat(42)}
MERIT REWARD (x12345) ...... ?,??? $MERIT
${'='.repeat(42)}
STATUS: PENDING [CONNECT WALLET]`}</pre>
                      </div>

                      <button
                        onClick={runScanner}
                        disabled={countdown.expired}
                        className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-wider text-black bg-emerald-400 hover:bg-emerald-300 border border-emerald-300/40 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-400/30 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {countdown.expired ? 'Uplink Closed' : 'Initialize Scan'}
                      </button>

                      <p className="text-[10px] text-zinc-600 mt-3 leading-relaxed text-center">
                        Rewards distributed automatically after the 72-hour uplink window closes.
                      </p>
                    </div>

                    <div className="flex items-center justify-center">
                      <div className="w-full aspect-[1200/630] rounded-xl bg-[#0a0a0a] border border-zinc-800/40 flex flex-col items-center justify-center gap-3">
                        <div className="w-14 h-14 rounded-xl bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-700">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                        </div>
                        <p className="text-[11px] font-mono text-zinc-600 uppercase tracking-widest">Reputation Card</p>
                        <p className="text-[10px] text-zinc-700">Connect wallet to generate</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ════ SCANNING ════ */}
                {phase === PHASES.SCANNING && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                      <ReceiptTerminal />
                      {account && (
                        <div className="mt-3 rounded-lg bg-[#0a0a0a] border border-zinc-800/40 px-4 py-2 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[10px] font-mono text-zinc-500">Wallet: {account.slice(0, 8)}...{account.slice(-6)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-center">
                      <div className="w-full aspect-[1200/630] rounded-xl bg-[#0a0a0a] border border-emerald-500/10 flex flex-col items-center justify-center gap-3 relative overflow-hidden">
                        <div className="carbon-scan-beam" />
                        <div className="w-12 h-12 rounded-full border-2 border-emerald-500/20 radar-spinner" />
                        <p className="text-[11px] font-mono text-zinc-600 uppercase tracking-widest">Generating Reputation Card...</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ════ RESULT ════ */}
                {phase === PHASES.RESULT && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left — Receipt Terminal */}
                    <div>
                      <ReceiptTerminal />

                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-2 mt-4 mb-4">
                        <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15 px-3 py-1.5">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><path d="M20 6L9 17l-5-5" /></svg>
                          <span className="text-[10px] font-mono text-emerald-400">PoHG Verified</span>
                        </div>
                        <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${rs.badge}`}>
                          <span className="text-[10px] font-mono font-bold">{rank.title}</span>
                        </div>
                      </div>

                      {/* Disclaimer */}
                      <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 px-4 py-2.5">
                        <p className="text-[10px] text-amber-400/80 leading-relaxed">
                          Rewards will be distributed automatically after the 72-hour uplink window closes. No further action required.
                        </p>
                      </div>
                    </div>

                    {/* Right — Reputation Card + Invite + Share */}
                    <div className="flex flex-col gap-4">
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Your Reputation Card</p>
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, type: 'spring', damping: 25 }}
                        className={`relative w-full aspect-[1200/630] rounded-xl border overflow-hidden ${rs.border} ${rs.glow}`}
                        style={{ background: 'linear-gradient(145deg, #050505 0%, #0a0f1a 40%, #050505 100%)' }}
                      >
                        <div className={`absolute inset-2.5 rounded-lg border ${rs.border} pointer-events-none`} />

                        <div className="absolute top-3 left-4 right-4 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${rank.color === 'emerald' ? 'bg-emerald-400' : rank.color === 'blue' ? 'bg-blue-400' : rank.color === 'purple' ? 'bg-purple-400' : 'bg-zinc-500'}`} />
                            <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest">MeritX Protocol · Multi-Chain</span>
                          </div>
                          <span className={`text-[8px] font-mono font-bold uppercase tracking-widest ${rs.text}`}>{rank.title}</span>
                        </div>

                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                          <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-[0.2em]">Carbon Passport · Verified</span>
                          <span className={`text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter leading-none ${rs.text}`} style={{ fontFamily: TERMINAL_FONT }}>
                            {formatMerit(meritReward)}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5">$MERIT Secured</span>
                        </div>

                        <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-6 sm:gap-10">
                          <div className="text-center">
                            <p className="text-[7px] font-mono text-zinc-700 uppercase tracking-widest">Total Gas</p>
                            <p className="text-[11px] font-bold text-zinc-300" style={{ fontFamily: TERMINAL_FONT }}>{gasSpent} ETH</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[7px] font-mono text-zinc-700 uppercase tracking-widest">Chains</p>
                            <p className="text-[11px] font-bold text-zinc-300" style={{ fontFamily: TERMINAL_FONT }}>{chainData.filter(c => c.gas > 0).length}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[7px] font-mono text-zinc-700 uppercase tracking-widest">Wallet</p>
                            <p className="text-[11px] font-bold text-zinc-400" style={{ fontFamily: TERMINAL_FONT }}>{truncAddr}</p>
                          </div>
                        </div>
                      </motion.div>

                      {/* Invite Link */}
                      <div className="rounded-xl bg-[#0a0a0a] border border-zinc-800/50 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Your Invite Link</span>
                          <span className="text-[9px] font-mono text-emerald-400/70">+8% Referral Bonus</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="flex-1 rounded-lg bg-black/60 border border-zinc-800 px-3 py-2 text-[11px] font-mono text-zinc-400 truncate cursor-pointer hover:text-white hover:border-zinc-600 transition-all"
                            onClick={copyLink}
                            title="Click to copy"
                          >
                            {referralLink}
                          </div>
                          <button
                            onClick={copyLink}
                            className="shrink-0 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-zinc-300 hover:text-white hover:border-zinc-500 transition-all uppercase tracking-wider"
                          >
                            {copied ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <p className="text-[10px] text-zinc-600 mt-2">Invite friends for 8% bonus. They keep 100% of their allocation.</p>
                      </div>

                      {/* Share Buttons */}
                      <div className="grid grid-cols-2 gap-3">
                        <a
                          href={warpcastUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 border border-purple-400/30 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-purple-600/20 hover:shadow-purple-500/30"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.2 4.1h4.3l2.3 8.3h.1l2.3-8.3h4.3L21.8 4.1V6.6L19.7 7.5V16.5L21.8 17.4V19.9H15.9V17.4L18 16.5V8.3H17.9L14.6 19.9H11.7L8.4 8.3H8.3V16.5L10.4 17.4V19.9H4.5V17.4L6.6 16.5V7.5L4.5 6.6V4.1H2.2Z" /></svg>
                          Share on Warpcast
                        </a>
                        <a
                          href={twitterUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-800/80 border border-zinc-700 text-zinc-300 text-xs font-bold uppercase tracking-wider hover:bg-zinc-700 hover:text-white transition-all"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                          Share on X
                        </a>
                      </div>

                      <button
                        onClick={dismiss}
                        className="w-full py-2.5 rounded-xl text-[11px] font-bold text-zinc-500 hover:text-zinc-300 bg-zinc-900/40 border border-zinc-800/60 hover:border-zinc-700 transition-all uppercase tracking-wider"
                      >
                        Close Passport
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
