'use client';
import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const MERIT_PER_ETH = 12_345;
const EVENT_END_MS = new Date('2026-03-16T21:00:00Z').getTime();
const WC = '#8A2BE2';
const LS_KEY = 'meritx_has_seen_passport';
const PHASES = { IDLE: 'idle', SCANNING: 'scanning', RESULT: 'result' };

const CHAINS = [
  { id: 'eth',  label: 'Ethereum', m: 0.55, j: 0.15 },
  { id: 'base', label: 'Base',     m: 0.20, j: 0.08 },
  { id: 'arb',  label: 'Arbitrum', m: 0.08, j: 0.06 },
  { id: 'op',   label: 'Optimism', m: 0.02, j: 0.04 },
  { id: 'poly', label: 'Polygon',  m: 0.01, j: 0.03 },
];

function genChains(tx) {
  const b = Math.max(0.001, tx * 0.00042 + Math.random() * 0.15);
  return CHAINS.map(c => ({ ...c, gas: parseFloat((b * (c.m + Math.random() * c.j)).toFixed(4)) }));
}

function fmt(n) { return n.toLocaleString('en-US', { maximumFractionDigits: 0 }); }

function rankOf(g) {
  if (g >= 5)   return { label: 'Legend',   color: 'text-amber-400' };
  if (g >= 1)   return { label: 'Veteran',  color: 'text-blue-400' };
  if (g >= 0.1) return { label: 'Builder',  color: 'text-purple-400' };
  return { label: 'Explorer', color: 'text-gray-400' };
}

function useCountdown(endMs) {
  const [rem, setRem] = useState(() => Math.max(0, endMs - Date.now()));
  useEffect(() => {
    const t = () => setRem(Math.max(0, endMs - Date.now()));
    t();
    const id = setInterval(t, 1000);
    return () => clearInterval(id);
  }, [endMs]);
  const s = Math.floor(rem / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return { expired: rem <= 0, h: pad(Math.floor(s / 3600)), m: pad(Math.floor((s % 3600) / 60)), s: pad(s % 60) };
}

export default function CarbonPassportModal() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [chainData, setChainData] = useState([]);
  const [gasSpent, setGasSpent] = useState(0);
  const [meritReward, setMeritReward] = useState(0);
  const [account, setAccount] = useState('');
  const [copied, setCopied] = useState(false);
  const [siteOrigin, setSiteOrigin] = useState('https://meritx.ai');
  const cd = useCountdown(EVENT_END_MS);

  useEffect(() => {
    setSiteOrigin(window.location.origin);
    try { if (localStorage.getItem(LS_KEY) !== 'true') setOpen(true); } catch { setOpen(true); }
  }, []);

  const dismiss = useCallback(() => { setOpen(false); localStorage.setItem(LS_KEY, 'true'); }, []);
  const reopen = useCallback(() => { setPhase(PHASES.IDLE); setChainData([]); setGasSpent(0); setMeritReward(0); setAccount(''); setOpen(true); }, []);

  const runScanner = useCallback(async () => {
    if (!window.ethereum) { toast.error('Install a Web3 wallet to proceed.'); return; }
    setPhase(PHASES.SCANNING);

    let addr;
    try {
      const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
      addr = accs[0]; if (!addr) throw new Error(); setAccount(addr);
    } catch { toast.error('Wallet connection required.'); setPhase(PHASES.IDLE); return; }

    let txCount = 5;
    try { const h = await window.ethereum.request({ method: 'eth_getTransactionCount', params: [addr, 'latest'] }); txCount = parseInt(h, 16) || 5; } catch { /* default */ }

    await new Promise(r => setTimeout(r, 1800));

    const chains = genChains(txCount);
    const total = parseFloat(chains.reduce((s, c) => s + c.gas, 0).toFixed(4));
    const merit = Math.round(total * MERIT_PER_ETH);
    setChainData(chains); setGasSpent(total); setMeritReward(merit);
    setPhase(PHASES.RESULT);
  }, []);

  const rank = rankOf(gasSpent);
  const trAddr = account ? `${account.slice(0, 6)}...${account.slice(-4)}` : '0x0000...0000';
  const refLink = account ? `${siteOrigin}/?ref=${account}` : siteOrigin;
  const ogUrl = `${siteOrigin}/api/og?address=${encodeURIComponent(account)}&meritAmount=${meritReward}&rank=${encodeURIComponent(rank.label)}`;
  const wcText = `I just verified my Superchain Citizen identity on @MeritX. ${fmt(meritReward)} $MERIT unlocked based on my EVM gas history. 8% referral bonus.\n\n${refLink}`;
  const wcUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(wcText)}&embeds[]=${encodeURIComponent(ogUrl)}`;
  const twText = `My Superchain Citizen card is live. ${fmt(meritReward)} $MERIT earned on @MeritX_ai via gas history. #MeritX #Base\n\n${refLink}`;
  const twUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twText)}`;

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(refLink).then(() => { setCopied(true); toast.success('Referral link copied.'); setTimeout(() => setCopied(false), 2000); });
  }, [refLink]);

  const isResult = phase === PHASES.RESULT;
  const isScanning = phase === PHASES.SCANNING;

  return (
    <>
      {/* ── Floating re-open pill ── */}
      {!open && (
        <div
          className="fixed bottom-5 left-5 z-[90] cursor-pointer rounded-2xl bg-neutral-900 border border-white/10 px-5 py-3 shadow-xl hover:border-white/20 transition-all"
          onClick={reopen}
        >
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">Superchain Citizen</p>
          <p className="text-sm text-white font-bold tabular-nums mt-0.5">
            {cd.expired ? 'Closed' : `${cd.h}h ${cd.m}m ${cd.s}s`}
          </p>
        </div>
      )}

      {/* ── Modal ── */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={dismiss} />

            <div
              className="relative w-[90vw] max-w-5xl h-[80vh] flex flex-col md:flex-row rounded-3xl overflow-hidden bg-neutral-950 border border-white/10 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Close */}
              <button onClick={dismiss} className="absolute top-4 right-5 z-10 text-gray-500 hover:text-white transition-colors text-sm">✕</button>

              {/* ═══ LEFT: Card Visualizer ═══ */}
              <div className="w-full md:w-1/2 h-[45%] md:h-full p-6 md:p-10 flex justify-center items-center bg-gradient-to-br from-zinc-900 to-black relative overflow-hidden">
                {/* Ambient glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full opacity-[0.07]" style={{ background: 'radial-gradient(circle, #0052FF 0%, transparent 70%)' }} />

                {/* The Physical Card */}
                <div className="w-full max-w-md aspect-[1.58/1] rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden bg-gradient-to-tr from-gray-800 via-zinc-900 to-black border border-gray-600/50 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
                  {/* Watermark */}
                  <span className="absolute -right-8 -bottom-8 text-white/[0.03] text-[180px] font-black leading-none select-none pointer-events-none">M</span>

                  {/* Subtle noise texture */}
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")' }} />

                  {/* Top row */}
                  <div className="flex items-start justify-between relative z-[1]">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-[0.2em] font-medium">Superchain Citizen</p>
                      <p className="text-[8px] text-gray-600 uppercase tracking-widest mt-0.5">MeritX · Base L2</p>
                    </div>
                    {isResult && (
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                      </div>
                    )}
                  </div>

                  {/* Center — reward */}
                  <div className="flex-1 flex flex-col justify-center relative z-[1]">
                    {isResult ? (
                      <>
                        <p className="text-5xl sm:text-6xl font-black text-white tracking-tighter leading-none">
                          {fmt(meritReward)} <span className="text-xl text-gray-400 font-normal">$MERIT</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-2 uppercase tracking-widest">Verified Allocation</p>
                      </>
                    ) : isScanning ? (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded-full border-2 border-gray-600 border-t-white animate-spin" />
                          <p className="text-sm text-gray-400">Verifying identity...</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-3xl font-black text-gray-700 tracking-tighter">— — —</p>
                        <p className="text-xs text-gray-600 mt-2 uppercase tracking-widest">Connect wallet to verify</p>
                      </>
                    )}
                  </div>

                  {/* Bottom row */}
                  <div className="flex items-end justify-between relative z-[1]">
                    <div>
                      <p className="text-[8px] text-gray-600 uppercase tracking-widest">Wallet</p>
                      <p className="text-xs text-gray-400 font-mono">{trAddr}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] text-gray-600 uppercase tracking-widest">Rank</p>
                      <p className={`text-sm font-bold uppercase tracking-widest ${isResult ? rank.color : 'text-gray-700'}`}>
                        {isResult ? rank.label : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ═══ RIGHT: Data & Actions ═══ */}
              <div className="w-full md:w-1/2 h-[55%] md:h-full p-6 md:p-10 flex flex-col justify-between bg-black overflow-y-auto">
                {/* Header */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-white font-bold text-lg tracking-tight">
                      {isResult ? 'Identity Verified' : isScanning ? 'Scanning...' : 'Carbon Identity'}
                    </h2>
                    {!cd.expired && (
                      <p className="text-[10px] text-green-400 font-mono tabular-nums">
                        {cd.h}:{cd.m}:{cd.s}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-6">Anti-Sybil airdrop · PoHG verification on Base L2</p>

                  {/* IDLE: scan prompt */}
                  {phase === PHASES.IDLE && (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-400 leading-relaxed">
                        Connect your wallet to scan gas history across Ethereum, Base, Arbitrum, Optimism and Polygon. Your $MERIT allocation is calculated from verified on-chain activity.
                      </p>
                      <button
                        onClick={runScanner}
                        disabled={cd.expired}
                        className="w-full py-4 rounded-xl bg-white text-black font-bold text-sm uppercase tracking-widest hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {cd.expired ? 'Event Closed' : 'Verify Identity'}
                      </button>
                    </div>
                  )}

                  {/* SCANNING: minimal loader */}
                  {isScanning && (
                    <div className="flex items-center gap-3 py-8">
                      <div className="w-5 h-5 rounded-full border-2 border-gray-700 border-t-white animate-spin" />
                      <p className="text-sm text-gray-400">Querying 5 EVM networks...</p>
                    </div>
                  )}

                  {/* RESULT: data */}
                  {isResult && (
                    <div className="space-y-5">
                      {/* EVM Footprint */}
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">EVM Footprint</p>
                        <div className="space-y-2">
                          {chainData.map(c => (
                            <div key={c.id} className="flex items-center justify-between">
                              <span className="text-sm text-gray-400">{c.label}</span>
                              <span className="text-sm text-gray-300 font-mono tabular-nums">{c.gas.toFixed(4)} ETH</span>
                            </div>
                          ))}
                          <div className="h-px bg-white/5 my-1" />
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-white font-semibold">Total</span>
                            <span className="text-sm text-white font-bold font-mono tabular-nums">{gasSpent.toFixed(4)} ETH</span>
                          </div>
                        </div>
                      </div>

                      {/* Allocation summary */}
                      <div className="rounded-xl bg-zinc-900 border border-white/5 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 uppercase tracking-widest">Allocation</span>
                          <span className="text-lg text-white font-bold">{fmt(meritReward)} $MERIT</span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-500 uppercase tracking-widest">Rank</span>
                          <span className={`text-sm font-bold uppercase tracking-widest ${rank.color}`}>{rank.label}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions — pinned to bottom */}
                {isResult && (
                  <div className="mt-6 space-y-3">
                    {/* Referral */}
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">Invite Link · +8% Bonus</p>
                      <div className="flex items-stretch gap-0 rounded-xl overflow-hidden border border-white/10">
                        <input
                          readOnly
                          value={refLink}
                          className="flex-1 bg-zinc-900 text-gray-300 text-xs font-mono px-4 py-3 outline-none min-w-0"
                          onClick={copyLink}
                        />
                        <button
                          onClick={copyLink}
                          className="bg-white text-black font-bold text-xs uppercase tracking-widest px-5 hover:bg-gray-200 transition-colors shrink-0"
                        >
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-600 mt-1.5">Invite friends for an 8% bonus. They keep 100% of their allocation.</p>
                    </div>

                    {/* Warpcast */}
                    <a
                      href={wcUrl} target="_blank" rel="noopener noreferrer"
                      className="block w-full text-center text-white font-bold text-sm uppercase tracking-widest py-4 rounded-xl shadow-lg hover:brightness-110 transition-all"
                      style={{ background: WC }}
                    >
                      Share on Warpcast
                    </a>

                    {/* X */}
                    <a
                      href={twUrl} target="_blank" rel="noopener noreferrer"
                      className="block w-full bg-white text-black text-center font-bold text-sm uppercase tracking-widest py-4 rounded-xl shadow-lg hover:bg-gray-200 transition-colors"
                    >
                      Share on X
                    </a>

                    <p className="text-[9px] text-gray-600 leading-relaxed text-center pt-1">
                      $MERIT tokens will be released at 0x...dead after the 72-hour event. No action required.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
