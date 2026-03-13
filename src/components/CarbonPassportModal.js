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

function formatMerit(n) { return n.toLocaleString('en-US', { maximumFractionDigits: 0 }); }

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

// ─── Scanner lines for typing animation ───
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
  lines.push({ t: receiptLine('MERIT REWARD (x12345)', `${formatMerit(merit)} $MERIT`, W), k: 'merit', d: 450 });
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
    if (localStorage.getItem('meritx-passport-seen') !== 'true') setOpen(true);
  }, []);

  const dismiss = useCallback(() => { setOpen(false); localStorage.setItem('meritx-passport-seen', 'true'); }, []);
  const reopen = useCallback(() => { setPhase(PHASES.IDLE); setRLines([]); setChainData([]); setGasSpent(0); setMeritReward(0); setAccount(''); setOpen(true); }, []);

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
  const ogUrl = `${siteOrigin}/api/og?address=${encodeURIComponent(account)}&gasSpent=${gasSpent}`;
  const wcText = `I just verified my Carbon Identity on @MeritX on Base. I unlocked ${formatMerit(meritReward)} $MERIT based on my gas history. Invite friends for 8% bonus. They keep 100%. \u{1F535}`;
  const wcUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(wcText)}&embeds[]=${encodeURIComponent(ogUrl)}`;
  const twText = `I just verified my Carbon Identity on @MeritX_ai. My gas history earned me ${formatMerit(meritReward)} $MERIT on Base. \u{1F535} #MeritX #Base\n\n${refLink}`;
  const twUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twText)}`;

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(refLink).then(() => { setCopied(true); toast.success('Referral link copied'); setTimeout(() => setCopied(false), 2000); });
  }, [refLink]);

  // ─── Shared sub-components ───

  const ShieldIcon = ({ size = 20, color = BASE_BLUE }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );

  const CountdownDisplay = ({ large }) => (
    <div className="text-center" style={{ fontFamily: TF }}>
      <p className="text-[9px] uppercase tracking-[0.3em] mb-2" style={{ color: cd.expired ? '#f87171' : NEON_GREEN }}>
        /// Uplink Closes In ///
      </p>
      <p
        className={`font-black tabular-nums tracking-wider ${large ? 'text-3xl sm:text-4xl md:text-5xl' : 'text-2xl sm:text-3xl'}`}
        style={{ color: cd.expired ? '#f87171' : NEON_GREEN, textShadow: cd.expired ? 'none' : `0 0 30px ${NEON_GREEN}40, 0 0 60px ${NEON_GREEN}15` }}
      >
        {cd.expired ? '/// UPLINK CLOSED ///' : `${cd.hrs}H : ${cd.min}M : ${cd.sec}S`}
      </p>
    </div>
  );

  const ReputationCard = () => (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, type: 'spring', damping: 25 }}
      className="relative w-full max-w-[560px] mx-auto aspect-[1.7/1] rounded-2xl overflow-hidden cursor-default transition-transform duration-300 hover:scale-[1.02]"
      style={{ background: 'linear-gradient(135deg, #111318 0%, #0a0a0f 50%, #0d1117 100%)', boxShadow: `0 0 30px ${BASE_BLUE}30, 0 4px 40px rgba(0,0,0,0.6)`, border: `1px solid ${BASE_BLUE}25` }}
    >
      {/* Circuit grid pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: `linear-gradient(${BASE_BLUE}30 1px, transparent 1px), linear-gradient(90deg, ${BASE_BLUE}30 1px, transparent 1px)`, backgroundSize: '24px 24px' }} />
      {/* Inner glow border */}
      <div className="absolute inset-[6px] rounded-xl pointer-events-none" style={{ border: `1px solid ${BASE_BLUE}12` }} />
      {/* Smart chip */}
      <div className="absolute top-4 left-5 w-9 h-7 rounded-md" style={{ background: `linear-gradient(135deg, ${BASE_BLUE}30, ${BASE_BLUE}10)`, border: `1px solid ${BASE_BLUE}25` }}>
        <div className="absolute inset-[3px] rounded-sm" style={{ background: `linear-gradient(135deg, ${BASE_BLUE}15, transparent)` }} />
      </div>

      {/* Top Right: Protocol label */}
      <div className="absolute top-4 right-5">
        <p className="text-[7px] font-mono uppercase tracking-[0.2em]" style={{ color: `${BASE_BLUE}90` }}>MeritX Protocol · Base L2</p>
      </div>

      {/* Center: MERIT amount */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[8px] font-mono uppercase tracking-[0.25em] mb-1.5" style={{ color: '#52525b' }}>Carbon Passport · Verified</p>
        <p className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter leading-none" style={{ fontFamily: TF, color: NEON_GREEN, textShadow: `0 0 20px ${NEON_GREEN}35` }}>
          {formatMerit(meritReward)}
        </p>
        <p className="text-xs font-bold uppercase tracking-[0.15em] mt-1" style={{ color: `${NEON_GREEN}80` }}>$MERIT Secured</p>
      </div>

      {/* Bottom row */}
      <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between">
        <div>
          <p className="text-[7px] font-mono uppercase tracking-widest" style={{ color: '#3f3f46' }}>Wallet</p>
          <p className="text-[11px] font-bold font-mono" style={{ color: '#a1a1aa' }}>{trAddr}</p>
        </div>
        <div className="text-right">
          <p className="text-[7px] font-mono uppercase tracking-widest" style={{ color: '#3f3f46' }}>Rank</p>
          <p className="text-[11px] font-bold font-mono" style={{ color: rank.color }}>{rank.title}</p>
        </div>
      </div>
    </motion.div>
  );

  const GasReport = () => (
    <div className="max-w-[560px] mx-auto rounded-xl overflow-hidden" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)', fontFamily: TF }}>
      <div className="px-4 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: '#0c0c0c' }}>
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />
          <span className="w-2 h-2 rounded-full" style={{ background: '#eab308' }} />
          <span className="w-2 h-2 rounded-full" style={{ background: NEON_GREEN }} />
        </div>
        <span className="text-[8px] uppercase tracking-widest ml-1.5" style={{ color: '#52525b' }}>carbon-passport.exe</span>
      </div>
      <div ref={termRef} className="px-4 py-3 max-h-[200px] overflow-y-auto">
        {phase === PHASES.SCANNING && rLines.length === 0 && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: NEON_GREEN }} />
            <span className="text-[10px]" style={{ color: '#52525b' }}>Connecting to archive nodes...</span>
          </div>
        )}
        {rLines.map((ln, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.1 }}>
            {ln.k === 'blank' ? <div className="h-2.5" /> : (
              <pre className="text-[10px] leading-[1.65] whitespace-pre" style={lineClr(ln.k)}>{ln.t}</pre>
            )}
          </motion.div>
        ))}
        {phase === PHASES.SCANNING && rLines.length > 0 && (
          <span className="inline-block w-[5px] h-[13px] animate-pulse mt-0.5" style={{ background: NEON_GREEN }} />
        )}
      </div>
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
            <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none opacity-[0.02]" style={{ backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${BASE_BLUE} 2px, ${BASE_BLUE} 4px)` }} />

            <div className="relative flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${BASE_BLUE}12`, border: `1px solid ${BASE_BLUE}20` }}>
                <ShieldIcon size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] leading-none" style={{ color: BASE_BLUE }}>Carbon Passport</p>
                <p className="text-[8px] uppercase tracking-widest mt-0.5" style={{ color: '#52525b' }}>Anti-Sybil Verification</p>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: NEON_GREEN, boxShadow: `0 0 6px ${NEON_GREEN}70` }} />
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
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
          >
            <div className="absolute inset-0 backdrop-blur-xl" style={{ background: 'rgba(0,0,0,0.90)' }} onClick={dismiss} />

            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 24 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative w-[90vw] max-w-[720px] max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
              style={{ background: 'rgba(5,5,8,0.97)', border: '1px solid rgba(255,255,255,0.07)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Scanline */}
              <div className="absolute inset-0 pointer-events-none z-[1] opacity-30" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.008) 3px, rgba(255,255,255,0.008) 6px)' }} />

              {/* Close */}
              <button onClick={dismiss} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:opacity-100 opacity-50" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>

              <div className="overflow-y-auto flex-1 p-6 sm:p-8 relative z-[2]">

                {/* ─── A. HEADER ─── */}
                <div className="flex items-center justify-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${BASE_BLUE}12`, border: `1px solid ${BASE_BLUE}20`, boxShadow: `0 0 20px ${BASE_BLUE}15` }}>
                    <ShieldIcon size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white tracking-tight uppercase">Carbon Passport</h2>
                    <p className="text-[9px] font-mono uppercase tracking-[0.2em]" style={{ color: '#52525b' }}>Anti-Sybil Airdrop Verification</p>
                  </div>
                </div>

                {/* ─── B. FOMO TIMER ─── */}
                <div className="my-6 py-5 rounded-xl text-center" style={{ background: `linear-gradient(180deg, ${BASE_BLUE}06, transparent)`, border: `1px solid ${BASE_BLUE}10` }}>
                  <CountdownDisplay large />
                </div>

                {/* ════ IDLE ════ */}
                {phase === PHASES.IDLE && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                    {/* Placeholder card */}
                    <div className="max-w-[560px] mx-auto aspect-[1.7/1] rounded-2xl flex flex-col items-center justify-center gap-3 mb-6" style={{ background: 'linear-gradient(135deg, #111318, #0a0a0f)', border: '1px solid rgba(255,255,255,0.05)', boxShadow: `0 0 30px ${BASE_BLUE}10` }}>
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: `${BASE_BLUE}08`, border: `1px solid ${BASE_BLUE}12` }}>
                        <ShieldIcon size={26} color="#3f3f46" />
                      </div>
                      <p className="text-[11px] font-mono uppercase tracking-widest" style={{ color: '#3f3f46' }}>Reputation Card</p>
                      <p className="text-[10px]" style={{ color: '#27272a' }}>Connect wallet to generate</p>
                    </div>

                    <p className="text-sm text-center leading-relaxed mb-6 max-w-md mx-auto" style={{ color: '#71717a' }}>
                      Your cross-chain gas footprint is your identity. Connect your wallet to scan
                      <span style={{ color: BASE_BLUE, fontWeight: 600 }}> Ethereum, Base, Arbitrum, Optimism </span>
                      and <span style={{ color: BASE_BLUE, fontWeight: 600 }}>Polygon</span> for your <span className="font-semibold text-white">$MERIT</span> allocation.
                    </p>

                    <div className="flex justify-center mb-4">
                      <button
                        onClick={runScanner}
                        disabled={cd.expired}
                        className="px-10 py-3.5 rounded-xl font-black text-sm uppercase tracking-wider text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{ background: BASE_BLUE, boxShadow: cd.expired ? 'none' : `0 0 25px ${BASE_BLUE}40`, border: `1px solid ${BASE_BLUE}80` }}
                      >
                        {cd.expired ? 'Uplink Closed' : 'Initialize Scan'}
                      </button>
                    </div>
                    <p className="text-[10px] text-center" style={{ color: '#3f3f46' }}>
                      Rewards distributed automatically after the 72-hour uplink closes.
                    </p>
                  </motion.div>
                )}

                {/* ════ SCANNING ════ */}
                {phase === PHASES.SCANNING && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <GasReport />
                    {account && (
                      <div className="max-w-[560px] mx-auto mt-3 rounded-lg px-4 py-2 flex items-center gap-2" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: BASE_BLUE }} />
                        <span className="text-[10px] font-mono" style={{ color: '#52525b' }}>Wallet: {account.slice(0, 8)}...{account.slice(-6)}</span>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ════ RESULT ════ */}
                {phase === PHASES.RESULT && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                    {/* C. Reputation Card */}
                    <div className="mb-6">
                      <ReputationCard />
                    </div>

                    {/* D. Compact Gas Report */}
                    <div className="max-w-[560px] mx-auto rounded-xl px-4 py-3 mb-6" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.05)', fontFamily: TF }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px]" style={{ color: '#52525b' }}>EVM FOOTPRINT</span>
                        <span className="text-[10px] font-bold" style={{ color: NEON_GREEN }}>[VERIFIED]</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px]" style={{ color: '#71717a' }}>TOTAL COMBINED GAS</span>
                        <span className="text-[10px] font-bold text-white">{gasSpent.toFixed(4)} ETH</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px]" style={{ color: '#71717a' }}>$MERIT ALLOCATION</span>
                        <span className="text-[10px] font-bold" style={{ color: NEON_GREEN }}>{formatMerit(meritReward)} $MERIT</span>
                      </div>
                    </div>

                    {/* E. Actions */}
                    <div className="max-w-[560px] mx-auto">
                      {/* Invite link */}
                      <div className="rounded-xl px-4 py-3 mb-4" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: '#52525b' }}>Your Invite Link</span>
                          <span className="text-[9px] font-mono" style={{ color: `${BASE_BLUE}90` }}>+8% Referral Bonus</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="flex-1 rounded-lg px-3 py-2 text-[11px] font-mono truncate cursor-pointer transition-all"
                            style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)', color: '#71717a' }}
                            onClick={copyLink} title="Click to copy"
                          >
                            {refLink}
                          </div>
                          <button
                            onClick={copyLink}
                            className="shrink-0 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                            style={{ background: BASE_BLUE, color: '#fff', border: `1px solid ${BASE_BLUE}80` }}
                          >
                            {copied ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <p className="text-[10px] mt-2" style={{ color: '#3f3f46' }}>Invite friends for an 8% bonus. They keep 100% of their allocation.</p>
                      </div>

                      {/* Share buttons — full width */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <a
                          href={wcUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-xs font-bold uppercase tracking-wider transition-all hover:opacity-90"
                          style={{ background: WARPCAST_PURPLE, border: `1px solid ${WARPCAST_PURPLE}80`, boxShadow: `0 0 20px ${WARPCAST_PURPLE}25` }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.2 4.1h4.3l2.3 8.3h.1l2.3-8.3h4.3L21.8 4.1V6.6L19.7 7.5V16.5L21.8 17.4V19.9H15.9V17.4L18 16.5V8.3H17.9L14.6 19.9H11.7L8.4 8.3H8.3V16.5L10.4 17.4V19.9H4.5V17.4L6.6 16.5V7.5L4.5 6.6V4.1H2.2Z" /></svg>
                          Share on Warpcast
                        </a>
                        <a
                          href={twUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-xs font-bold uppercase tracking-wider transition-all hover:opacity-90"
                          style={{ background: '#000', border: '1px solid #333' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                          Share on X
                        </a>
                      </div>
                    </div>

                    {/* F. Status Footer */}
                    <div className="mt-4 -mx-6 sm:-mx-8 -mb-6 sm:-mb-8 px-6 sm:px-8 py-3.5 text-center" style={{ background: `linear-gradient(90deg, ${NEON_GREEN}08, ${NEON_GREEN}15, ${NEON_GREEN}08)`, borderTop: `1px solid ${NEON_GREEN}18` }}>
                      <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: NEON_GREEN }}>
                        Status: <span className="font-bold">[Approved]</span> — $MERIT tokens will be automatically released after 72H. No action required.
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
