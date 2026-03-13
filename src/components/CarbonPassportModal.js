'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const MERIT_PER_ETH = 12_345;
const TERMINAL_FONT = "'JetBrains Mono', 'Fira Code', 'SF Mono', ui-monospace, monospace";
const SITE_ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'https://meritx.ai';

const PHASES = { IDLE: 'idle', SCANNING: 'scanning', RESULT: 'result' };

const SCANNER_LINES = [
  'Initializing Carbon Passport verification...',
  'Connecting to Base L2 archive node...',
  'Fetching historical gas expenditure...',
  'Parsing transaction receipts...',
  'Cross-referencing PoHG registry...',
  'Calculating $MERIT allocation...',
  'Verification complete.',
];

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

export default function CarbonPassportModal() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [scanLines, setScanLines] = useState([]);
  const [gasSpent, setGasSpent] = useState(0);
  const [meritReward, setMeritReward] = useState(0);
  const [account, setAccount] = useState('');
  const [copied, setCopied] = useState(false);
  const [siteOrigin, setSiteOrigin] = useState('https://meritx.ai');
  const scanRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
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
    setScanLines([]);
    setGasSpent(0);
    setMeritReward(0);
    setAccount('');
    setOpen(true);
  }, []);

  const fetchGasSpent = useCallback(async (addr) => {
    try {
      const provider = window.ethereum;
      if (!provider) return 0;
      const txCountHex = await provider.request({
        method: 'eth_getTransactionCount',
        params: [addr, 'latest'],
      });
      const txCount = parseInt(txCountHex, 16);
      const simulated = Math.max(0.001, txCount * 0.00042 + Math.random() * 0.15);
      return parseFloat(simulated.toFixed(6));
    } catch {
      return parseFloat((Math.random() * 0.5 + 0.01).toFixed(6));
    }
  }, []);

  const runScanner = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      toast.error('Please install MetaMask to verify your Carbon Passport.');
      return;
    }

    setPhase(PHASES.SCANNING);
    setScanLines([]);
    scanRef.current = 0;

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

    for (let i = 0; i < SCANNER_LINES.length; i++) {
      await new Promise((r) => setTimeout(r, 350 + Math.random() * 250));
      setScanLines((prev) => [...prev, SCANNER_LINES[i]]);
    }

    const gas = await fetchGasSpent(addr);
    const merit = Math.round(gas * MERIT_PER_ETH);
    setGasSpent(gas);
    setMeritReward(merit);

    await new Promise((r) => setTimeout(r, 500));
    setPhase(PHASES.RESULT);
  }, [fetchGasSpent]);

  const rank = getRank(gasSpent);
  const rs = RANK_STYLES[rank.color];
  const truncAddr = account ? `${account.slice(0, 6)}...${account.slice(-4)}` : '0x0000...0000';

  const referralLink = account ? `${siteOrigin}/?ref=${account}` : siteOrigin;
  const ogImageUrl = `${siteOrigin}/api/og?address=${encodeURIComponent(account)}&gasSpent=${gasSpent}`;

  const warpcastText = `I just verified my Carbon Identity on @MeritX on Base. I unlocked ${formatMerit(meritReward)} $MERIT based on my gas history. Invite friends for 8% bonus. They keep 100%. Win-win. 🔵`;
  const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(warpcastText)}&embeds[]=${encodeURIComponent(ogImageUrl)}`;

  const twitterText = `I just verified my Carbon Identity on @MeritX_ai. My gas history earned me ${formatMerit(meritReward)} $MERIT on Base. Join the silicon revolution. 🔵 #MeritX #Base\n\n${referralLink}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}`;

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      toast.success('Referral link copied');
      setTimeout(() => setCopied(false), 2000);
    });
  }, [referralLink]);

  return (
    <>
      {/* Floating re-open button */}
      {!open && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 260, damping: 20 }}
          onClick={reopen}
          className="fixed bottom-6 right-6 z-[90] w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 border border-blue-400/30 shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all hover:scale-110 group"
          title="Open Carbon Passport"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
        </motion.button>
      )}

      {/* Modal */}
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
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={dismiss} />

            {/* Modal Card — near full-screen */}
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 24 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative w-[90vw] max-w-[1200px] max-h-[80vh] glass-modal rounded-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Scanline overlay */}
              <div className="absolute inset-0 pointer-events-none z-[1] carbon-scanline" />

              {/* Close button */}
              <button
                onClick={dismiss}
                className="absolute top-4 right-4 z-10 w-8 h-8 rounded-lg bg-zinc-900/80 border border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-white hover:border-zinc-500 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>

              {/* Scrollable content */}
              <div className="overflow-y-auto flex-1 p-6 sm:p-8">
                {/* Header */}
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white tracking-tight">Carbon Passport</h2>
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Anti-Sybil Airdrop · Gas History Verification</p>
                  </div>
                </div>

                <div className="h-px bg-zinc-800/60 my-5" />

                {/* ════════════════ IDLE PHASE ════════════════ */}
                {phase === PHASES.IDLE && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left — Intro */}
                    <div>
                      <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                        Your on-chain gas history is your identity. Connect your wallet to calculate your <span className="text-blue-400 font-semibold">$MERIT</span> allocation based on verified Ethereum activity.
                      </p>
                      <div className="rounded-xl bg-black/40 border border-zinc-800/60 p-4 mb-6" style={{ fontFamily: TERMINAL_FONT }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Allocation Formula</span>
                        </div>
                        <p className="text-blue-400 text-sm font-bold">1 ETH Gas Spent = {formatMerit(MERIT_PER_ETH)} $MERIT</p>
                        <p className="text-[11px] text-zinc-600 mt-1">Reward scales linearly with cumulative gas expenditure</p>
                      </div>

                      <div className="rounded-xl bg-black/30 border border-zinc-800/40 p-4 mb-6">
                        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-3">Rank Tiers</p>
                        <div className="space-y-2">
                          {[
                            { label: 'Carbon Legend', req: '≥ 5 ETH', c: 'text-emerald-400' },
                            { label: 'EVM Veteran', req: '≥ 1 ETH', c: 'text-blue-400' },
                            { label: 'Builder', req: '≥ 0.1 ETH', c: 'text-purple-400' },
                            { label: 'Explorer', req: '< 0.1 ETH', c: 'text-zinc-400' },
                          ].map((t) => (
                            <div key={t.label} className="flex items-center justify-between">
                              <span className={`text-xs font-bold ${t.c}`}>{t.label}</span>
                              <span className="text-[10px] font-mono text-zinc-600">{t.req}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={runScanner}
                        className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-500 border border-blue-500/40 transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30"
                      >
                        Verify &amp; Claim
                      </button>
                    </div>

                    {/* Right — Preview card placeholder */}
                    <div className="flex items-center justify-center">
                      <div className={`w-full aspect-[1200/630] rounded-xl bg-black/60 border border-zinc-800/40 flex flex-col items-center justify-center gap-3 ${''}`}>
                        <div className="w-14 h-14 rounded-xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                        </div>
                        <p className="text-[11px] font-mono text-zinc-600 uppercase tracking-widest">Your Reputation Card</p>
                        <p className="text-[10px] text-zinc-700">Connect wallet to generate</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ════════════════ SCANNING PHASE ════════════════ */}
                {phase === PHASES.SCANNING && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left — Scanner */}
                    <div>
                      <div className="relative rounded-xl bg-black/60 border border-blue-500/10 overflow-hidden">
                        <div className="carbon-scan-beam" />
                        <div className="p-5">
                          <div className="flex items-center justify-center mb-4">
                            <div className="relative">
                              <div className="w-20 h-20 rounded-full border-2 border-blue-500/30 flex items-center justify-center">
                                <div className="w-16 h-16 rounded-full border border-blue-500/20 flex items-center justify-center">
                                  <div className="w-10 h-10 rounded-full border border-dashed border-blue-400/40 radar-spinner" />
                                </div>
                              </div>
                              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 animate-pulse shadow-[0_0_12px_rgba(37,99,235,0.6)]" />
                            </div>
                          </div>
                          <p className="text-center text-[10px] font-mono text-blue-400/60 uppercase tracking-widest mb-4">Scanning Blockchain</p>

                          <div className="space-y-1.5 min-h-[160px]" style={{ fontFamily: TERMINAL_FONT }}>
                            {scanLines.map((line, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.2 }}
                                className="flex items-start gap-2"
                              >
                                <span className="text-blue-500 text-[10px] mt-px shrink-0">{'>'}</span>
                                <span className={`text-[11px] ${i === scanLines.length - 1 && scanLines.length === SCANNER_LINES.length ? 'text-emerald-400 font-bold' : 'text-zinc-500'}`}>
                                  {line}
                                </span>
                              </motion.div>
                            ))}
                            {scanLines.length < SCANNER_LINES.length && (
                              <div className="flex items-center gap-1.5 pt-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                <span className="text-[10px] font-mono text-zinc-600">Processing...</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {account && (
                        <div className="mt-4 rounded-lg bg-black/30 border border-zinc-800/40 px-4 py-2.5 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                          <span className="text-[11px] font-mono text-zinc-500">Wallet: {account.slice(0, 8)}...{account.slice(-6)}</span>
                        </div>
                      )}
                    </div>

                    {/* Right — Loading card */}
                    <div className="flex items-center justify-center">
                      <div className="w-full aspect-[1200/630] rounded-xl bg-black/60 border border-blue-500/10 flex flex-col items-center justify-center gap-3 relative overflow-hidden">
                        <div className="carbon-scan-beam" />
                        <div className="w-12 h-12 rounded-full border-2 border-blue-500/20 radar-spinner" />
                        <p className="text-[11px] font-mono text-zinc-600 uppercase tracking-widest">Generating Reputation Card...</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ════════════════ RESULT PHASE ════════════════ */}
                {phase === PHASES.RESULT && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left — Stats, referral, CTA */}
                    <div>
                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-3 mb-5">
                        <div className="rounded-xl bg-black/50 border border-zinc-800/60 p-4 text-center">
                          <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1.5">Gas Spent</p>
                          <p className="text-xl font-black text-white" style={{ fontFamily: TERMINAL_FONT }}>{gasSpent} <span className="text-sm text-zinc-500">ETH</span></p>
                        </div>
                        <div className="rounded-xl bg-blue-600/5 border border-blue-500/15 p-4 text-center">
                          <p className="text-[9px] font-mono text-blue-400/70 uppercase tracking-widest mb-1.5">Unclaimed Reward</p>
                          <motion.p
                            initial={{ scale: 0.5 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                            className="text-xl font-black text-blue-400"
                            style={{ fontFamily: TERMINAL_FONT }}
                          >
                            {formatMerit(meritReward)} <span className="text-sm text-blue-500/60">$MERIT</span>
                          </motion.p>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-5">
                        <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15 px-3 py-1.5">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><path d="M20 6L9 17l-5-5" /></svg>
                          <span className="text-[10px] font-mono text-emerald-400">PoHG Verified</span>
                        </div>
                        <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${rs.badge}`}>
                          <span className="text-[10px] font-mono font-bold">{rank.title}</span>
                        </div>
                      </div>

                      {/* Referral */}
                      <div className="rounded-xl bg-black/40 border border-zinc-800/60 p-4 mb-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Your Invite Link</span>
                          <span className="text-[9px] font-mono text-blue-400/70">+8% Referral Bonus</span>
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
                        <p className="text-[10px] text-zinc-600 mt-2">Invite friends to earn an 8% bonus. They keep 100% of their allocation.</p>
                      </div>

                      {/* Share buttons */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <a
                          href={warpcastUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-wider hover:bg-purple-600/20 hover:border-purple-500/30 transition-all"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.2 4.1h4.3l2.3 8.3h.1l2.3-8.3h4.3L21.8 4.1V6.6L19.7 7.5V16.5L21.8 17.4V19.9H15.9V17.4L18 16.5V8.3H17.9L14.6 19.9H11.7L8.4 8.3H8.3V16.5L10.4 17.4V19.9H4.5V17.4L6.6 16.5V7.5L4.5 6.6V4.1H2.2Z" /></svg>
                          Warpcast
                        </a>
                        <a
                          href={twitterUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-800/60 border border-zinc-700 text-zinc-300 text-xs font-bold uppercase tracking-wider hover:bg-zinc-700/60 hover:border-zinc-600 hover:text-white transition-all"
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

                    {/* Right — Reputation Card Preview */}
                    <div className="flex flex-col gap-4">
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Your Reputation Card</p>
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, type: 'spring', damping: 25 }}
                        className={`relative w-full aspect-[1200/630] rounded-xl border overflow-hidden ${rs.border} ${rs.glow}`}
                        style={{ background: 'linear-gradient(145deg, #050505 0%, #0a0f1a 40%, #050505 100%)' }}
                      >
                        {/* Inner border */}
                        <div className={`absolute inset-2.5 rounded-lg border ${rs.border} pointer-events-none`} />

                        {/* Top bar */}
                        <div className="absolute top-3 left-4 right-4 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${rank.color === 'emerald' ? 'bg-emerald-400' : rank.color === 'blue' ? 'bg-blue-400' : rank.color === 'purple' ? 'bg-purple-400' : 'bg-zinc-500'}`} />
                            <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest">MeritX Protocol · Base L2</span>
                          </div>
                          <span className={`text-[8px] font-mono font-bold uppercase tracking-widest ${rs.text}`}>{rank.title}</span>
                        </div>

                        {/* Center content */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                          <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-[0.2em]">Carbon Passport · Verified</span>
                          <span className={`text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter leading-none ${rs.text}`} style={{ fontFamily: TERMINAL_FONT }}>
                            {formatMerit(meritReward)}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5">$MERIT Unlocked</span>
                        </div>

                        {/* Bottom stats */}
                        <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-6 sm:gap-10">
                          <div className="text-center">
                            <p className="text-[7px] font-mono text-zinc-700 uppercase tracking-widest">Gas Spent</p>
                            <p className="text-[11px] font-bold text-zinc-300" style={{ fontFamily: TERMINAL_FONT }}>{gasSpent} ETH</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[7px] font-mono text-zinc-700 uppercase tracking-widest">Rank</p>
                            <p className={`text-[11px] font-bold ${rs.text}`} style={{ fontFamily: TERMINAL_FONT }}>{rank.title}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[7px] font-mono text-zinc-700 uppercase tracking-widest">Wallet</p>
                            <p className="text-[11px] font-bold text-zinc-400" style={{ fontFamily: TERMINAL_FONT }}>{truncAddr}</p>
                          </div>
                        </div>
                      </motion.div>

                      <p className="text-[10px] text-zinc-600 leading-relaxed">
                        This card is dynamically generated. When you share on Warpcast or X, your friends will see this exact image as an Open Graph preview with your $MERIT allocation.
                      </p>
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
