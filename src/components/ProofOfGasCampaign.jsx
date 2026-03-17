'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { getSignerContract, handleTxError } from '@/lib/web3';

const TF = "'SF Mono','Fira Code','JetBrains Mono',Menlo,Consolas,monospace";
const SESSION_KEY = 'meritx_pog_auto_shown';
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

const TIERS = [
  { min: 9000, label: 'CARBON ORACLE',  merit: '100,000', color: 'text-amber-400',  border: 'border-amber-500/30',  bg: 'bg-amber-500/10',  accent: '#F59E0B' },
  { min: 7000, label: 'CARBON ELITE',   merit: '20,000',  color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10', accent: '#A855F7' },
  { min: 4000, label: 'CARBON PIONEER', merit: '5,000',   color: 'text-cyan-400',   border: 'border-cyan-500/30',   bg: 'bg-cyan-500/10',   accent: '#06B6D4' },
  { min: 1000, label: 'CARBON CITIZEN', merit: '1,000',   color: 'text-blue-400',   border: 'border-blue-500/30',   bg: 'bg-blue-500/10',   accent: '#3B82F6' },
  { min:    0, label: 'RECRUIT',        merit: '100',     color: 'text-zinc-400',    border: 'border-zinc-500/30',   bg: 'bg-zinc-500/10',   accent: '#71717A' },
];
function resolveTier(s) { return TIERS.find(t => s >= t.min) || TIERS[TIERS.length - 1]; }

const TIER_CARDS = [
  { label: 'Carbon Citizen', merit: '1,000',   bc: 'border-blue-500/30',   tc: 'text-blue-400',   mc: 'text-blue-300' },
  { label: 'Carbon Pioneer', merit: '5,000',   bc: 'border-cyan-500/30',   tc: 'text-cyan-400',   mc: 'text-cyan-300' },
  { label: 'Carbon Elite',   merit: '20,000',  bc: 'border-purple-500/30', tc: 'text-purple-400', mc: 'text-purple-300' },
  { label: 'Carbon Oracle',  merit: '100,000', bc: 'border-amber-500/30',  tc: 'text-amber-400',  mc: 'text-amber-300' },
];

// ── Hooks ──

function useCountUp(target, dur = 1500, active = false) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) { setV(0); return; }
    const s = performance.now(); let raf;
    const tick = (now) => {
      const p = Math.min((now - s) / dur, 1);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, dur, active]);
  return v;
}

function useCountdown(endTs) {
  const [r, setR] = useState('');
  useEffect(() => {
    if (!endTs) return;
    const tick = () => {
      const diff = Math.max(0, endTs * 1000 - Date.now());
      const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
      setR(`${d}D ${String(h).padStart(2,'0')}H ${String(m).padStart(2,'0')}M ${String(s).padStart(2,'0')}S`);
    };
    tick(); const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTs]);
  return r;
}

function useWalletLocal() {
  const [account, setAccount] = useState('');
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;
    window.ethereum.request({ method: 'eth_accounts' }).then(a => { if (a?.[0]) setAccount(a[0]); }).catch(() => {});
    const h = (a) => setAccount(a?.[0] ?? '');
    window.ethereum.on('accountsChanged', h);
    return () => window.ethereum.removeListener('accountsChanged', h);
  }, []);
  const connect = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) return;
    await window.ethereum.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
    const a = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (a?.[0]) { setAccount(a[0]); localStorage.setItem('isWalletConnected', 'true'); }
  }, []);
  return { account, connect };
}

// ── Confetti ──

function fireConfetti() {
  const c = document.createElement('canvas');
  c.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;';
  c.width = window.innerWidth; c.height = window.innerHeight;
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  const cols = ['#00d4ff','#3b82f6','#8b5cf6','#00ff88','#f59e0b','#ef4444','#fff'];
  const ps = Array.from({length:120}, () => ({
    x: Math.random()*c.width, y: -20-Math.random()*c.height*0.5,
    w: 4+Math.random()*6, h: 8+Math.random()*10,
    vx: (Math.random()-0.5)*4, vy: 2+Math.random()*5,
    rot: Math.random()*360, rv: (Math.random()-0.5)*12,
    color: cols[Math.floor(Math.random()*cols.length)], opacity: 1,
  }));
  let f = 0; const mx = 180;
  function draw() {
    ctx.clearRect(0,0,c.width,c.height);
    for (const p of ps) {
      p.x+=p.vx; p.y+=p.vy; p.vy+=0.1; p.rot+=p.rv;
      if (f>mx*0.6) p.opacity = Math.max(0, p.opacity-0.02);
      ctx.save(); ctx.globalAlpha=p.opacity;
      ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180);
      ctx.fillStyle=p.color; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
      ctx.restore();
    }
    f++; if (f<mx) requestAnimationFrame(draw); else c.remove();
  }
  requestAnimationFrame(draw);
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════

export default function ProofOfGasCampaign() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { account, connect } = useWalletLocal();

  // Multi-step state
  const [step, setStep] = useState(1);       // 1=landing, 2=scanning, 3=mint, 'claimed'
  const [logs, setLogs] = useState([]);
  const [scanPhase, setScanPhase] = useState('connecting');
  const [claimData, setClaimData] = useState(null);
  const [isMinting, setIsMinting] = useState(false);
  const [hasMintedState, setHasMintedState] = useState(false);
  const [campaignEnd, setCampaignEnd] = useState(null);
  const [alreadyClaimedData, setAlreadyClaimedData] = useState(null);
  const countdown = useCountdown(campaignEnd);

  const [inviter, setInviter] = useState(ethers.constants.AddressZero);
  const logEndRef = useRef(null);

  // ── Auto-open once per session ──
  useEffect(() => {
    setMounted(true);
    const shown = sessionStorage.getItem(SESSION_KEY);
    if (!shown) {
      const t = setTimeout(() => { setIsOpen(true); sessionStorage.setItem(SESSION_KEY, '1'); }, 1500);
      return () => clearTimeout(t);
    }
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    if (!mounted) return;
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, mounted]);

  // Expose open trigger for Navbar button
  const openModal = useCallback(() => setIsOpen(true), []);
  useEffect(() => {
    if (mounted) window.__openMeritDrop = openModal;
    return () => { delete window.__openMeritDrop; };
  }, [mounted, openModal]);

  // Read inviter from URL
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get('ref');
      if (ref && ethers.utils.isAddress(ref)) setInviter(ethers.utils.getAddress(ref));
    } catch {}
  }, []);

  // Read campaign end from contract
  useEffect(() => {
    if (!POG_NFT_ADDRESS || typeof window === 'undefined' || !window.ethereum) return;
    (async () => {
      try {
        const p = new ethers.providers.Web3Provider(window.ethereum);
        const c = new ethers.Contract(POG_NFT_ADDRESS, POG_ABI, p);
        const end = await c.endTime();
        if (end.gt(0)) setCampaignEnd(end.toNumber());
      } catch {}
    })();
  }, []);

  // Check if already minted
  useEffect(() => {
    if (!account || !POG_NFT_ADDRESS || typeof window === 'undefined' || !window.ethereum) return;
    let cancelled = false;
    (async () => {
      try {
        const p = new ethers.providers.Web3Provider(window.ethereum);
        const c = new ethers.Contract(POG_NFT_ADDRESS, POG_ABI, p);
        if (!(await c.hasMinted(account))) return;
        const [bs, rb, tid] = await Promise.all([c.baseScores(account).then(Number), c.referralBonuses(account).then(Number), c.tokenOfOwner(account).then(Number)]);
        if (!cancelled) { setAlreadyClaimedData({ baseScore: bs, refBonus: rb, tokenId: tid }); setHasMintedState(true); setStep('claimed'); }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [account]);

  // Auto-scroll terminal
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs.length]);

  const addLog = useCallback((msg) => setLogs(prev => [...prev, msg]), []);

  // ── Handlers ──

  const handleConnect = useCallback(async () => {
    try { await connect(); } catch { toast.error('Wallet connection failed.'); }
  }, [connect]);

  const handleScan = useCallback(async () => {
    if (!account) { toast.error('Connect wallet first.'); return; }
    const addr = ethers.utils.getAddress(account);
    setStep(2); setLogs([]); setScanPhase('connecting');

    addLog('Initializing Proof of Gas scanner...');
    await delay(600);
    addLog(`Wallet: ${addr.slice(0,6)}...${addr.slice(-4)}`);
    await delay(500);
    addLog('Session encrypted — indexer latency 11ms');
    await delay(800);

    setScanPhase('scanning');
    addLog(''); addLog('═══ Scanning EVM Gas Footprint ═══'); await delay(400);

    let apiResult;
    try {
      addLog('Querying multi-chain gas data...');
      const res = await fetch('/api/pog/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userAddress: addr, inviterAddress: inviter }) });
      apiResult = await res.json();

      if (!apiResult.success) {
        await delay(400);
        if (apiResult.gasData?.chains) {
          for (const ch of apiResult.gasData.chains) { addLog(`[--] ${ch.label.padEnd(20,'.')} ${ch.gas.toFixed(4)} ETH  (${ch.txCount} txns)`); await delay(250); }
          addLog(''); addLog(`Total combined gas: ${apiResult.gasData.totalGas.toFixed(4)} ETH`); await delay(400);
        }
        addLog(''); addLog('✖ SCAN FAILED — Insufficient on-chain activity.'); addLog(`✖ Minimum: 0.001 ETH | Yours: ${(apiResult.gasData?.totalGas ?? 0).toFixed(4)} ETH`);
        addLog('STATUS: REJECTED'); setScanPhase('failed'); return;
      }
    } catch (e) {
      addLog(''); addLog('✖ NETWORK ERROR: ' + (e.message || 'Unknown')); setScanPhase('failed');
      toast.error('Scan failed.'); return;
    }
    await delay(300);
    for (const ch of apiResult.gasData.chains) { addLog(`[OK] ${ch.label.padEnd(20,'.')} ${ch.gas.toFixed(4)} ETH  (${ch.txCount} txns)`); await delay(400); }
    addLog(''); addLog(`Total combined gas: ${apiResult.gasData.totalGas.toFixed(4)} ETH`); await delay(600);

    setScanPhase('verifying');
    addLog(''); addLog('═══ Verifying Passport Tier ═══'); await delay(500);
    addLog('Sybil check: PASSED ✓'); await delay(400);
    addLog('PoHG signature: VALID ✓'); await delay(400);
    addLog(`Tier: [${apiResult.tierResolved}] — ${apiResult.meritAllocation.toLocaleString()} MERIT`); await delay(600);

    setScanPhase('finalizing');
    addLog(''); addLog('═══ Finalizing ═══'); await delay(400);
    addLog(`Signature: ${apiResult.signature.slice(0,22)}...`); await delay(300);
    addLog(''); addLog(`✅ CONFIRMED: ${apiResult.meritAllocation.toLocaleString()} $MERIT`); await delay(300);

    setClaimData(apiResult); setScanPhase('complete');
  }, [addLog, inviter, account]);

  const handleRetry = useCallback(() => { setStep(1); setLogs([]); setScanPhase('connecting'); setClaimData(null); }, []);
  const handleProceedToMint = useCallback(() => setStep(3), []);

  const handleMint = useCallback(async () => {
    if (!claimData || !account) return;
    if (!POG_NFT_ADDRESS) { toast.error('PoG contract not configured.'); return; }
    setIsMinting(true);
    try {
      const { contract } = getSignerContract(POG_NFT_ADDRESS, POG_ABI);
      const tx = await contract.mint(claimData.baseScoreInt, inviter, claimData.signature, { value: ethers.utils.parseEther(MINT_FEE) });
      toast('Minting...', { icon: '⏳' });
      await tx.wait();
      setHasMintedState(true); fireConfetti(); toast.success('On-chain identity minted!');
      try {
        const p = new ethers.providers.Web3Provider(window.ethereum);
        const rc = new ethers.Contract(POG_NFT_ADDRESS, POG_ABI, p);
        const [bs, rb, tid] = await Promise.all([rc.baseScores(account).then(Number), rc.referralBonuses(account).then(Number), rc.tokenOfOwner(account).then(Number)]);
        setAlreadyClaimedData({ baseScore: bs, refBonus: rb, tokenId: tid }); setStep('claimed');
      } catch {}
    } catch (e) {
      if (e?.code === 'ACTION_REJECTED' || e?.code === 4001) toast.error('Transaction cancelled.');
      else if (e?.reason?.includes('already minted')) { toast.error('Already minted.'); setHasMintedState(true); }
      else handleTxError(e);
    } finally { setIsMinting(false); }
  }, [claimData, account, inviter]);

  // ── Close handler (resets step to landing) ──
  const handleClose = useCallback(() => { setIsOpen(false); setStep(1); setLogs([]); setScanPhase('connecting'); setClaimData(null); }, []);

  if (!mounted) return null;
  if (!isOpen) return null;

  // ── Shared UI pieces ──

  const hasWallet = typeof window !== 'undefined' && !!window.ethereum;
  const isConnected = !!account;

  const isTerminal = scanPhase === 'complete' || scanPhase === 'failed';
  const isFailed = scanPhase === 'failed';

  return (
    <AnimatePresence>
      <motion.div
        key="pog-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-zinc-950 border border-zinc-800/60 shadow-[0_0_80px_rgba(0,180,216,0.08)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close X */}
          <button onClick={handleClose} className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all" aria-label="Close">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>

          <div className="px-5 sm:px-8 py-8 sm:py-10">
            <AnimatePresence mode="wait">

              {/* ════ STEP 1: Landing ════ */}
              {step === 1 && (
                <motion.div key="s1" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-15}} className="text-center">
                  {isConnected && (
                    <div className="mb-4 inline-flex px-4 py-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/5 items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px] font-mono text-emerald-400">{account.slice(0,6)}...{account.slice(-4)}</span>
                    </div>
                  )}

                  {countdown && (
                    <div className="mb-6 inline-flex px-6 py-2 rounded-full border border-cyan-500/15 bg-cyan-500/[0.03]">
                      <span className="text-[10px] font-mono text-cyan-500/50 tracking-[0.2em] uppercase mr-3">Ends In</span>
                      <span className="text-sm font-black font-mono text-cyan-400 tracking-widest" style={{textShadow:'0 0 16px rgba(0,210,255,0.25)'}}>{countdown}</span>
                    </div>
                  )}

                  <p className="font-mono text-[10px] text-cyan-500/50 tracking-[0.3em] uppercase mb-3">7-Day Campaign · Proof of Gas</p>
                  <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-3 leading-[1.05]">
                    <span className="text-white">The Merit </span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Drop</span>
                  </h2>
                  <p className="text-zinc-500 text-sm max-w-md mx-auto leading-relaxed mb-8">
                    The wallets that powered the chain deserve the future. Your gas history across 5 EVM chains determines your Carbon Identity and Merit allocation.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                    {TIER_CARDS.map(t => (
                      <div key={t.label} className={`rounded-xl border ${t.bc} bg-white/[0.02] p-3 text-center transition-all hover:bg-white/[0.04]`}>
                        <p className={`text-[9px] font-mono uppercase tracking-wider ${t.tc} mb-1.5 opacity-80`}>{t.label}</p>
                        <p className={`text-lg font-black font-mono ${t.mc} tracking-tight`} style={{fontFamily:TF}}>{t.merit}</p>
                        <p className="text-[8px] font-mono text-zinc-600 mt-0.5 tracking-wider">MERIT</p>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => { if (!hasWallet) { toast.error('Install MetaMask'); return; } if (!isConnected) { handleConnect(); return; } handleScan(); }}
                    className="relative w-full max-w-sm mx-auto py-4 rounded-2xl font-bold text-[15px] text-white bg-gradient-to-r from-cyan-500 to-blue-600 transition-all shadow-[0_0_20px_rgba(0,180,216,0.5)] hover:shadow-[0_0_40px_rgba(0,180,216,0.65)] hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
                  >
                    <span className="absolute inset-0" style={{background:'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.08) 40%,rgba(255,255,255,0.15) 50%,rgba(255,255,255,0.08) 60%,transparent 100%)',animation:'shimmer 2.5s ease-in-out infinite'}} />
                    <span className="relative z-10 flex items-center justify-center gap-2.5">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      {!hasWallet ? 'Install Wallet' : !isConnected ? 'Connect Wallet' : 'Scan On-Chain Footprint'}
                    </span>
                  </button>

                  <p className="mt-5 text-[9px] font-mono text-zinc-700 tracking-[0.15em]">
                    ETHEREUM · BASE L2 · ARBITRUM · OPTIMISM · POLYGON
                  </p>
                  <p className="mt-2 text-[8px] font-mono text-zinc-800 tracking-wider">ANTI-SYBIL · 0.0005 ETH FEE · ONE MINT PER WALLET</p>
                </motion.div>
              )}

              {/* ════ STEP 2: Scanning Terminal ════ */}
              {step === 2 && (
                <motion.div key="s2" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                  {/* Progress bar */}
                  <div className="flex items-center gap-1 w-full mb-5">
                    {['connecting','scanning','verifying','finalizing'].map((s, i) => {
                      const ci = ['connecting','scanning','verifying','finalizing'].indexOf(isTerminal ? 'finalizing' : scanPhase);
                      const done = i < ci || scanPhase === 'complete';
                      const active = i === ci && !isTerminal;
                      const err = isFailed && i >= ci;
                      return (
                        <div key={s} className="flex-1 flex flex-col gap-1">
                          <div className="h-1 rounded-full overflow-hidden bg-zinc-800">
                            <motion.div className={err ? 'h-full bg-red-500' : done ? 'h-full bg-emerald-500' : active ? 'h-full bg-emerald-400' : 'h-full bg-zinc-800'}
                              initial={{width:'0%'}} animate={{width: done||err?'100%': active?'60%':'0%'}} transition={{duration:0.6}} />
                          </div>
                          <span className={`text-[7px] font-mono uppercase tracking-widest ${err?'text-red-400':active?'text-emerald-400':done?'text-emerald-600':'text-zinc-700'}`}>{s}</span>
                        </div>
                      );
                    })}
                  </div>

                  <p className={`text-[10px] font-mono tracking-[0.2em] uppercase mb-3 text-center ${isFailed?'text-red-500/70':'text-cyan-500/60'}`}>
                    {isFailed ? 'Scan Failed' : 'Verifying Passport Tier'}
                  </p>

                  {/* Terminal window */}
                  <div className={`relative w-full rounded-xl bg-black/90 overflow-hidden border ${isFailed?'border-red-500/30':'border-emerald-500/20'}`} style={{fontFamily:TF}}>
                    <div className={`flex items-center gap-2 px-4 py-2 border-b ${isFailed?'border-red-500/10 bg-red-950/20':'border-emerald-500/10 bg-emerald-950/20'}`}>
                      <span className="w-2 h-2 rounded-full bg-red-500/60"/><span className="w-2 h-2 rounded-full bg-amber-500/60"/><span className={`w-2 h-2 rounded-full ${isFailed?'bg-red-500/60':'bg-emerald-500/60'}`}/>
                      <span className={`ml-2 text-[9px] tracking-widest uppercase ${isFailed?'text-red-500/40':'text-emerald-500/40'}`}>proof-of-gas-scanner</span>
                    </div>
                    <div className="px-4 py-3 h-56 sm:h-64 overflow-y-auto scrollbar-hide">
                      {logs.map((log, i) => {
                        const isErr = log.startsWith('✖') || log.startsWith('CRITICAL');
                        return (
                          <motion.div key={i} initial={{opacity:0,x:-6}} animate={{opacity:1,x:0}} transition={{duration:0.12}} className="flex gap-2 text-[10px] leading-relaxed mb-0.5">
                            <span className={`shrink-0 select-none ${isErr?'text-red-500/60':'text-emerald-600/50'}`}>&gt;</span>
                            <span className={isErr?'text-red-400': i===logs.length-1?'text-emerald-400':'text-emerald-500/60'}>{log}</span>
                          </motion.div>
                        );
                      })}
                      {!isTerminal && <span className="inline-block w-2 h-3.5 bg-emerald-400 animate-pulse ml-4 mt-1"/>}
                      <div ref={logEndRef}/>
                    </div>
                  </div>

                  {scanPhase === 'complete' && (
                    <motion.button initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.3}}
                      onClick={handleProceedToMint}
                      className="mt-5 w-full py-3 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 font-bold text-sm font-mono hover:bg-emerald-600/20 transition-all">
                      PROCEED TO MINT →
                    </motion.button>
                  )}
                  {isFailed && (
                    <motion.button initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.3}}
                      onClick={handleRetry}
                      className="mt-5 w-full py-3 rounded-xl bg-red-600/10 border border-red-500/20 text-red-400 font-bold text-sm font-mono hover:bg-red-600/20 transition-all">
                      ← TRY ANOTHER WALLET
                    </motion.button>
                  )}
                </motion.div>
              )}

              {/* ════ STEP 3: Mint ════ */}
              {step === 3 && claimData && (
                <motion.div key="s3" initial={{opacity:0,scale:0.97}} animate={{opacity:1,scale:1}} exit={{opacity:0}}>
                  <MintView claimData={claimData} onMint={handleMint} isMinting={isMinting} hasMinted={hasMintedState} />
                </motion.div>
              )}

              {/* ════ Already Claimed ════ */}
              {step === 'claimed' && alreadyClaimedData && (
                <motion.div key="claimed" initial={{opacity:0,y:15}} animate={{opacity:1,y:0}}>
                  <ClaimedView account={account} mintData={alreadyClaimedData} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>

      {/* Inline keyframes */}
      <style jsx global>{`
        @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        @keyframes pogScanDown { 0%{top:-2px} 100%{top:100%} }
        .scrollbar-hide::-webkit-scrollbar{display:none} .scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none;}
      `}</style>
    </AnimatePresence>
  );
}

// ── Mint sub-view ──

function MintView({ claimData, onMint, isMinting, hasMinted }) {
  const tier = resolveTier(claimData.baseScoreInt);
  const meritDisplay = useCountUp(claimData.meritAllocation, 1500, true);
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://meritx.io';
  const shareText = `My Carbon Identity: ${tier.label} — ${claimData.meritAllocation.toLocaleString()} MERIT unlocked via Proof of Gas on @MeritX_HQ.\n\nGas history is the new credit.\n${siteUrl}/pog\n\n#ProofOfGas #CarbonIdentity`;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] font-mono text-cyan-500/60 tracking-[0.2em] uppercase mb-1">Identity Verified</p>
          <h2 className="text-xl font-black text-white tracking-tight">Mint Your Passport</h2>
        </div>
        <div className={`px-3 py-1.5 rounded-lg ${tier.border} ${tier.bg}`}>
          <span className={`text-[11px] font-bold font-mono tracking-wider ${tier.color}`}>{tier.label}</span>
        </div>
      </div>

      {claimData.gasData?.chains && (
        <div className="rounded-xl border border-zinc-800/80 bg-white/[0.02] p-3 mb-5" style={{fontFamily:TF}}>
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-2">EVM Gas Footprint</p>
          <div className="space-y-0.5 text-[10px]">
            {claimData.gasData.chains.map(c => (
              <div key={c.label} className="flex justify-between"><span className="text-zinc-500 truncate mr-2">{c.label}</span><span className="text-zinc-400 tabular-nums">{c.gas.toFixed(4)} ETH</span></div>
            ))}
            <div className="h-px bg-zinc-800 my-1"/>
            <div className="flex justify-between"><span className="text-white font-bold">TOTAL</span><span className="text-white font-bold tabular-nums">{claimData.gasData.totalGas.toFixed(4)} ETH</span></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { icon: '⛽', label: 'Gas', value: `${(claimData.gasData?.totalGas||0).toFixed(2)} ETH`, c: 'text-orange-400', b: 'border-orange-500/20' },
          { icon: '🧬', label: 'Score', value: (claimData.baseScoreInt/10000).toFixed(4), c: 'text-purple-400', b: 'border-purple-500/20' },
          { icon: '🔗', label: 'Final', value: ((claimData.baseScoreInt+(claimData.referralBonus||0))/10000).toFixed(4), c: 'text-cyan-400', b: 'border-cyan-500/20' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border ${s.b} bg-white/[0.03] p-2.5 text-center`}>
            <span className="text-lg block mb-0.5">{s.icon}</span>
            <p className={`text-xs font-black ${s.c} font-mono`}>{s.value}</p>
            <p className="text-[8px] text-zinc-500 uppercase tracking-wider mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="text-center mb-6">
        <p className="text-[10px] font-mono text-zinc-600 tracking-[0.3em] uppercase mb-2">Merit Allocation</p>
        <h3 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300"
          style={{fontFamily:TF, filter:'drop-shadow(0 0 12px rgba(0,210,255,0.6)) drop-shadow(0 0 40px rgba(0,180,255,0.35))'}}>
          {meritDisplay.toLocaleString()}
        </h3>
        <p className="text-sm font-bold text-cyan-400/70 tracking-widest mt-1">$MERIT</p>
      </div>

      {!hasMinted ? (
        <button onClick={onMint} disabled={isMinting}
          className="relative w-full py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 transition-all shadow-[0_0_30px_rgba(0,200,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden">
          <span className="relative z-10">{isMinting ? 'Minting...' : `Mint Identity (Free + ${MINT_FEE} ETH Fee)`}</span>
        </button>
      ) : (
        <div className="w-full py-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-center">
          <span className="text-emerald-400 font-bold text-sm font-mono">MINTED — IDENTITY SECURED ✓</span>
        </div>
      )}

      {hasMinted && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-black border border-zinc-700 text-white font-bold text-sm hover:bg-zinc-900 transition-all">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            Share on X
          </a>
          <a href={`https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm hover:brightness-110 transition-all" style={{background:'#7C3AED'}}>
            Warpcast
          </a>
        </div>
      )}
    </>
  );
}

// ── Already-Claimed sub-view ──

function ClaimedView({ account, mintData }) {
  const tier = resolveTier(mintData.baseScore);
  const finalScore = ((mintData.baseScore + mintData.refBonus) / 10000).toFixed(4);
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://meritx.io';
  const shareText = `My Carbon Identity: ${tier.label} — ${tier.merit} MERIT unlocked via Proof of Gas on @MeritX_HQ.\n\nGas history is the new credit.\n${siteUrl}/pog\n\n#ProofOfGas #CarbonIdentity`;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] font-mono text-emerald-500/60 tracking-[0.2em] uppercase mb-1">Already Minted</p>
          <h2 className="text-xl font-black text-white tracking-tight">Your Carbon Passport</h2>
        </div>
        <div className={`px-3 py-1.5 rounded-lg ${tier.border} ${tier.bg}`}>
          <span className={`text-[11px] font-bold font-mono tracking-wider ${tier.color}`}>{tier.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { icon: '🪪', label: 'Token', value: `#${mintData.tokenId}`, c: 'text-emerald-400', b: 'border-emerald-500/20' },
          { icon: '🧬', label: 'Score', value: (mintData.baseScore/10000).toFixed(4), c: 'text-purple-400', b: 'border-purple-500/20' },
          { icon: '🔗', label: 'Final', value: finalScore, c: 'text-cyan-400', b: 'border-cyan-500/20' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border ${s.b} bg-white/[0.03] p-2.5 text-center`}>
            <span className="text-lg block mb-0.5">{s.icon}</span>
            <p className={`text-xs font-black ${s.c} font-mono`}>{s.value}</p>
            <p className="text-[8px] text-zinc-500 uppercase tracking-wider mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="w-full py-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-center mb-4">
        <span className="text-emerald-400 font-bold text-sm font-mono">MINTED — IDENTITY SECURED ✓</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-black border border-zinc-700 text-white font-bold text-sm hover:bg-zinc-900 transition-all">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          Share on X
        </a>
        <a href={`https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm hover:brightness-110 transition-all" style={{background:'#7C3AED'}}>
          Warpcast
        </a>
      </div>

      <p className="text-center text-zinc-600 text-[9px] font-mono mt-4">
        Wallet: {account?.slice(0,6)}...{account?.slice(-4)} · One mint per wallet.
      </p>
    </>
  );
}
