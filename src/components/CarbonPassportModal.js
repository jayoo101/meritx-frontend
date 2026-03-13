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

function rankLabel(g) {
  if (g >= 5)   return 'CARBON LEGEND';
  if (g >= 1)   return 'EVM VETERAN';
  if (g >= 0.1) return 'BUILDER';
  return 'EXPLORER';
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

    await new Promise(r => setTimeout(r, 2000));

    const chains = genChains(txCount);
    const total = parseFloat(chains.reduce((s, c) => s + c.gas, 0).toFixed(4));
    const merit = Math.round(total * MERIT_PER_ETH);
    setChainData(chains); setGasSpent(total); setMeritReward(merit);
    setPhase(PHASES.RESULT);
  }, []);

  const rank = rankLabel(gasSpent);
  const trAddr = account ? `${account.slice(0, 6)}...${account.slice(-4)}` : '0x0000...0000';
  const refLink = account ? `${siteOrigin}/?ref=${account}` : siteOrigin;
  const ogUrl = `${siteOrigin}/api/og?address=${encodeURIComponent(account)}&meritAmount=${meritReward}&rank=${encodeURIComponent(rank)}`;
  const wcText = `I just verified my Carbon Identity on @MeritX on Base. I unlocked ${fmt(meritReward)} $MERIT based on my gas history. Invite friends for 8% bonus. They keep 100%.\n\n${refLink}`;
  const wcUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(wcText)}&embeds[]=${encodeURIComponent(ogUrl)}`;
  const twText = `I just verified my Carbon Identity on @MeritX_ai. My gas history earned me ${fmt(meritReward)} $MERIT on Base. #MeritX #Base\n\n${refLink}`;
  const twUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twText)}`;

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(refLink).then(() => { setCopied(true); toast.success('Link copied.'); setTimeout(() => setCopied(false), 2000); });
  }, [refLink]);

  const isResult = phase === PHASES.RESULT;
  const isScanning = phase === PHASES.SCANNING;

  return (
    <>
      {/* ── Floating re-open widget ── */}
      {!open && (
        <div
          className="fixed bottom-5 left-5 z-[90] cursor-pointer rounded-2xl border border-blue-500/30 bg-gradient-to-br from-slate-900 to-black px-5 py-3 shadow-[0_0_30px_rgba(0,82,255,0.12)] hover:border-blue-400/50 transition-all"
          onClick={reopen}
        >
          <p className="text-[10px] text-blue-400 uppercase tracking-widest font-medium">Carbon Passport</p>
          <p className="text-sm text-white font-bold tabular-nums mt-0.5 font-mono">
            {cd.expired ? 'CLOSED' : `${cd.h}H : ${cd.m}M : ${cd.s}S`}
          </p>
        </div>
      )}

      {/* ── Modal ── */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">

            {/* Backdrop click */}
            <div className="absolute inset-0" onClick={dismiss} />

            {/* Main Modal Container */}
            <div
              className="relative w-full max-w-5xl h-auto flex flex-col rounded-3xl overflow-hidden bg-gradient-to-br from-[#0F172A] to-[#020617] border border-blue-500/30 shadow-[0_0_50px_rgba(0,82,255,0.15)]"
              onClick={e => e.stopPropagation()}
            >
              {/* Close */}
              <button onClick={dismiss} className="absolute top-4 right-5 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors text-lg">✕</button>

              {/* ═══ Columns Row ═══ */}
              <div className="flex flex-col md:flex-row flex-1">

              {/* ═══ LEFT COLUMN: Dashboard (2/5) ═══ */}
              <div className="w-full md:w-2/5 p-6 md:p-8 flex flex-col border-b md:border-b-0 md:border-r border-white/5 bg-black/20">

                {/* Header */}
                <div className="flex items-start gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(0,82,255,0.2)]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg tracking-tight leading-tight">CARBON IDENTITY PASSPORT</h2>
                    <p className="text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-0.5">Anti-Sybil Verification</p>
                  </div>
                </div>

                {/* FOMO Countdown */}
                <div className="mb-5">
                  <p className="text-[10px] text-green-500/80 font-mono uppercase tracking-widest mb-1.5">{'/// UPLINK CLOSES IN ///'}</p>
                  <p className="text-3xl md:text-4xl text-green-400 font-bold font-mono tabular-nums tracking-wider whitespace-nowrap" style={{ textShadow: '0 0 25px rgba(74,222,128,0.3)' }}>
                    {cd.expired ? '00H : 00M : 00S' : `${cd.h}H : ${cd.m}M : ${cd.s}S`}
                  </p>
                </div>

                {/* Scan button */}
                {phase === PHASES.IDLE && (
                  <button
                    onClick={runScanner}
                    disabled={cd.expired}
                    className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-bold text-sm uppercase tracking-widest hover:bg-blue-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(0,82,255,0.3)] mb-5"
                  >
                    {cd.expired ? 'Event Closed' : 'Verify Identity'}
                  </button>
                )}

                {isScanning && (
                  <div className="flex items-center gap-3 mb-5 py-2">
                    <div className="w-5 h-5 rounded-full border-2 border-blue-800 border-t-blue-400 animate-spin" />
                    <p className="text-sm text-gray-400">Querying 5 EVM networks...</p>
                  </div>
                )}

                {/* Terminal Gas Log */}
                <div className="flex-1 min-h-0">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">EVM Gas Footprint</p>
                  <div className="space-y-1.5 font-mono text-xs">
                    {isResult ? (
                      <>
                        {chainData.map(c => (
                          <div key={c.id} className="flex justify-between">
                            <span className="text-gray-500">{c.label}</span>
                            <span className="text-gray-400 tabular-nums">{c.gas.toFixed(4)} ETH</span>
                          </div>
                        ))}
                        <div className="h-px bg-white/5 my-2" />
                        <div className="flex justify-between">
                          <span className="text-white font-bold">TOTAL COMBINED GAS</span>
                          <span className="text-white font-bold tabular-nums">{gasSpent.toFixed(4)} ETH</span>
                        </div>
                      </>
                    ) : (
                      <>
                        {CHAINS.map(c => (
                          <div key={c.id} className="flex justify-between">
                            <span className="text-gray-600">{c.label}</span>
                            <span className="text-gray-700 tabular-nums">—</span>
                          </div>
                        ))}
                        <div className="h-px bg-white/5 my-2" />
                        <div className="flex justify-between">
                          <span className="text-gray-600">TOTAL</span>
                          <span className="text-gray-700">—</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

              </div>

              {/* ═══ RIGHT COLUMN: Sapphire Card & Actions (3/5) ═══ */}
              <div className="w-full md:w-3/5 p-6 md:p-8 flex flex-col gap-6 relative">

                {/* The 3D Sapphire Glass Card */}
                <div className="w-full aspect-[2/1] rounded-2xl bg-blue-950/40 backdrop-blur-xl border border-blue-500/40 shadow-[inset_0_0_30px_rgba(0,82,255,0.1),0_0_40px_rgba(0,82,255,0.08)] p-6 md:p-8 flex flex-col justify-between relative overflow-hidden group">

                  {/* Scan line effect */}
                  <div
                    className="absolute left-0 w-full h-[2px] pointer-events-none z-[1]"
                    style={{
                      background: 'linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.6) 30%, rgba(59,130,246,0.8) 50%, rgba(59,130,246,0.6) 70%, transparent 100%)',
                      animation: 'sapphire-scan 4s ease-in-out infinite',
                      boxShadow: '0 0 12px rgba(59,130,246,0.4)',
                    }}
                  />

                  {/* Subtle grid texture */}
                  <div
                    className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{
                      backgroundImage: 'linear-gradient(rgba(59,130,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.3) 1px, transparent 1px)',
                      backgroundSize: '40px 40px',
                    }}
                  />

                  {/* Card top */}
                  <div className="flex items-start justify-between relative z-[2]">
                    <div>
                      <p className="text-[10px] text-blue-400 uppercase tracking-[0.2em] font-medium">MERITX PROTOCOL</p>
                      <p className="text-[8px] text-blue-600 uppercase tracking-widest mt-0.5">BASE L2</p>
                    </div>
                    {isResult && (
                      <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                      </div>
                    )}
                  </div>

                  {/* Card center — reward */}
                  <div className="flex-1 flex flex-col justify-center relative z-[2]">
                    {isResult ? (
                      <>
                        <div className="text-5xl md:text-6xl font-black text-[#00FF00] tracking-tighter leading-none" style={{ filter: 'drop-shadow(0 0 20px rgba(0,255,0,0.4))' }}>
                          {fmt(meritReward)} <span className="text-2xl text-green-600 font-normal">$MERIT</span>
                        </div>
                        <p className="text-xs text-green-500/60 mt-2 uppercase tracking-widest font-mono">Verified Allocation</p>
                      </>
                    ) : isScanning ? (
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full border-2 border-blue-800 border-t-blue-400 animate-spin" />
                        <p className="text-sm text-blue-400/60">Scanning EVM footprint...</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-4xl font-black text-gray-700/50 tracking-tighter">— — —</p>
                        <p className="text-xs text-gray-600 mt-2 uppercase tracking-widest">Awaiting verification</p>
                      </>
                    )}
                  </div>

                  {/* Card bottom */}
                  <div className="flex items-end justify-between relative z-[2]">
                    <div>
                      <p className="text-[8px] text-blue-600 uppercase tracking-widest mb-0.5">Wallet</p>
                      <p className="text-xs text-gray-400 font-mono">{trAddr}</p>
                    </div>
                    {isResult && (
                      <span className="px-3 py-1 bg-blue-900/40 text-blue-300 border border-blue-500/50 rounded uppercase tracking-wider text-[11px] font-bold shadow-[0_0_15px_rgba(0,82,255,0.4)]">
                        {rank}
                      </span>
                    )}
                    {!isResult && (
                      <div className="text-right">
                        <p className="text-[8px] text-blue-600 uppercase tracking-widest">Rank</p>
                        <p className="text-xs text-gray-600">—</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Section */}
                <div className="flex-shrink-0">
                  {isResult ? (
                    <div className="space-y-3">
                      {/* Invite Link */}
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">Invite Link · +8% Bonus</p>
                        <div className="flex items-stretch rounded-xl overflow-hidden border border-white/10">
                          <input
                            readOnly
                            value={refLink}
                            className="flex-1 bg-black/50 text-gray-300 text-xs font-mono px-4 py-3 outline-none min-w-0"
                            onClick={copyLink}
                          />
                          <button
                            onClick={copyLink}
                            className="bg-blue-600 text-white font-bold text-xs uppercase tracking-widest px-5 hover:bg-blue-500 transition-colors shrink-0"
                          >
                            {copied ? 'COPIED' : 'COPY'}
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-600 mt-1">Invite friends for an 8% bonus. They keep 100% of their allocation.</p>
                      </div>

                      {/* Social Buttons */}
                      <div className="flex gap-4 mt-4">
                        <a
                          href={wcUrl} target="_blank" rel="noopener noreferrer"
                          className="flex-1 text-center text-white font-bold text-sm py-4 rounded-xl hover:brightness-110 transition-all shadow-lg"
                          style={{ background: WC }}
                        >
                          SHARE ON WARPCAST
                        </a>
                        <a
                          href={twUrl} target="_blank" rel="noopener noreferrer"
                          className="flex-1 bg-white text-black text-center font-bold text-sm py-4 rounded-xl hover:bg-gray-200 transition-all shadow-lg"
                        >
                          SHARE ON X
                        </a>
                      </div>

                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-sm text-gray-600">
                        {isScanning ? 'Verification in progress...' : 'Begin scan to unlock your $MERIT allocation and sharing tools.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              </div>{/* end columns row */}

              {/* ═══ Unified Status Bar ═══ */}
              {isResult && (
                <div className="w-full bg-green-950/30 border-t border-green-500/20 px-6 py-3 text-center">
                  <span className="text-green-400 font-mono text-xs sm:text-sm">
                    {'STATUS: [APPROVED] — $MERIT TOKENS WILL BE AUTOMATICALLY RELEASED AFTER 72H. NO ACTION REQUIRED.'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
