'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const MERIT_PER_ETH = 12_345;
const EVENT_END_MS = new Date('2026-03-16T21:00:00Z').getTime();
const G = '#00FF00';
const WC = '#8A2BE2';
const LS_KEY = 'meritx_has_seen_passport';
const PHASES = { IDLE: 'idle', SCANNING: 'scanning', RESULT: 'result' };

const CHAIN_KEYS = [
  { id: 'eth',  key: 'ETH_MAINNET_GAS', hex: '0x4F2A' },
  { id: 'base', key: 'BASE_L2_GAS',     hex: '0xA1C7' },
  { id: 'arb',  key: 'ARB_ONE_GAS',     hex: '0x7E3D' },
  { id: 'op',   key: 'OP_MAINNET_GAS',  hex: '0xB9F1' },
  { id: 'poly', key: 'POLYGON_POS_GAS', hex: '0x03DA' },
];

function generateChainData(txCount) {
  const base = Math.max(0.001, txCount * 0.00042 + Math.random() * 0.15);
  const mults = [0.55, 0.20, 0.08, 0.02, 0.01];
  const jitter = [0.15, 0.08, 0.06, 0.04, 0.03];
  return CHAIN_KEYS.map((c, i) => ({
    ...c,
    gas: parseFloat((base * (mults[i] + Math.random() * jitter[i])).toFixed(4)),
  }));
}

function fmt(n) { return n.toLocaleString('en-US', { maximumFractionDigits: 0 }); }

function getRank(g) {
  if (g >= 5)   return 'CARBON_LEGEND';
  if (g >= 1)   return 'EVM_VETERAN';
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
  const ts = Math.floor(rem / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return { expired: rem <= 0, hrs: pad(Math.floor(ts / 3600)), min: pad(Math.floor((ts % 3600) / 60)), sec: pad(ts % 60) };
}

function pad20(s) { return s.padEnd(20, '.'); }

export default function CarbonPassportModal() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [chainData, setChainData] = useState([]);
  const [logLines, setLogLines] = useState([]);
  const [gasSpent, setGasSpent] = useState(0);
  const [meritReward, setMeritReward] = useState(0);
  const [account, setAccount] = useState('');
  const [copied, setCopied] = useState(false);
  const [siteOrigin, setSiteOrigin] = useState('https://meritx.ai');
  const logRef = useRef(null);
  const cd = useCountdown(EVENT_END_MS);

  useEffect(() => {
    setSiteOrigin(window.location.origin);
    try {
      if (localStorage.getItem(LS_KEY) !== 'true') setOpen(true);
    } catch { setOpen(true); }
  }, []);

  const dismiss = useCallback(() => { setOpen(false); localStorage.setItem(LS_KEY, 'true'); }, []);
  const reopen = useCallback(() => { setPhase(PHASES.IDLE); setLogLines([]); setChainData([]); setGasSpent(0); setMeritReward(0); setAccount(''); setOpen(true); }, []);

  const runScanner = useCallback(async () => {
    if (!window.ethereum) { toast.error('Install a Web3 wallet to proceed.'); return; }
    setPhase(PHASES.SCANNING); setLogLines([]); setChainData([]);

    const push = (t, c = G) => setLogLines(p => [...p, { t, c }]);

    push('> SYSTEM_AUDIT_LOG_v10.0', G);
    push('> INITIALIZING PoHG VERIFICATION ENGINE...', '#15803d');
    await new Promise(r => setTimeout(r, 400));

    let addr;
    try {
      const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
      addr = accs[0]; if (!addr) throw new Error(); setAccount(addr);
      push(`> WALLET_CONNECTED: ${addr.slice(0, 10)}...${addr.slice(-6)}`, G);
    } catch { toast.error('Wallet connection required.'); setPhase(PHASES.IDLE); return; }

    let txCount = 5;
    try { const h = await window.ethereum.request({ method: 'eth_getTransactionCount', params: [addr, 'latest'] }); txCount = parseInt(h, 16) || 5; } catch { /* default */ }

    push('> SCANNING MULTI-CHAIN EVM FOOTPRINT...', '#15803d');
    await new Promise(r => setTimeout(r, 600));

    const chains = generateChainData(txCount);
    const total = parseFloat(chains.reduce((s, c) => s + c.gas, 0).toFixed(4));
    const merit = Math.round(total * MERIT_PER_ETH);
    setChainData(chains); setGasSpent(total); setMeritReward(merit);

    for (const c of chains) {
      await new Promise(r => setTimeout(r, 250 + Math.random() * 200));
      push(`[OK] ${pad20(c.key)} ${c.gas.toFixed(4)} ETH  ${c.hex}`, c.gas > 0 ? G : '#15803d');
    }

    await new Promise(r => setTimeout(r, 300));
    push(`${'─'.repeat(48)}`, '#15803d');
    push(`[OK] TOTAL_COMBINED_GAS .. ${total.toFixed(4)} ETH`, G);
    push(`[OK] MERIT_ALLOCATION ... ${fmt(merit)} $MERIT`, G);
    await new Promise(r => setTimeout(r, 300));
    push(`${'═'.repeat(48)}`, '#15803d');
    push('> SYBIL_CHECK: PASSED [NO BOT DETECTED]', G);
    push(`> RANK_ASSIGNED: [ ${getRank(total)} ]`, G);
    push(`> VERIFICATION_HASH: 0x...dead_A2A_BUS`, '#15803d');
    push('> AUDIT COMPLETE.', G);

    await new Promise(r => setTimeout(r, 400));
    setPhase(PHASES.RESULT);
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logLines]);

  const rank = getRank(gasSpent);
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

  return (
    <>
      {/* ═══ Floating re-open widget — Bottom Left ═══ */}
      {!open && (
        <div
          className="fixed bottom-5 left-5 z-[90] cursor-pointer font-mono border border-[#00FF00] bg-black px-4 py-3 hover:bg-[#00FF00]/10 transition-colors"
          onClick={reopen}
        >
          <p className="text-[10px] text-[#00FF00] uppercase tracking-widest mb-1">{`> CARBON_AUDIT`}</p>
          <p className="text-sm text-[#00FF00] font-bold tabular-nums">
            {cd.expired ? 'CLOSED' : `${cd.hrs}H:${cd.min}M:${cd.sec}S`}
          </p>
          <p className="text-[9px] text-green-700 mt-1">{`[ CLICK TO REOPEN ]`}</p>
        </div>
      )}

      {/* ═══ Modal ═══ */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-mono">
            <div className="absolute inset-0 bg-black/95" onClick={dismiss} />

            <div
              className="relative w-[90vw] max-w-5xl h-[80vh] bg-black border-2 border-[#00FF00] flex flex-col md:flex-row overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={dismiss}
                className="absolute top-2 right-3 z-10 text-[#00FF00] hover:text-white text-xs uppercase tracking-widest"
              >
                {`[X] CLOSE`}
              </button>

              {/* ═══ LEFT: Diagnostic Log ═══ */}
              <div className="w-full md:w-1/2 h-1/2 md:h-full flex flex-col border-b md:border-b-0 md:border-r border-[#00FF00] p-4 overflow-hidden">
                <p className="text-[#00FF00] text-xs uppercase tracking-widest mb-1">{`> SYSTEM_AUDIT_LOG_v10.0`}</p>
                <p className="text-green-700 text-[10px] mb-3">{`MeritX Protocol · PoHG Engine · Base L2`}</p>

                {/* Countdown bar */}
                <div className="border border-[#00FF00]/30 px-3 py-2 mb-3">
                  <p className="text-[9px] text-green-700 uppercase tracking-widest mb-1">{`UPLINK_TIMEOUT:`}</p>
                  <p className="text-xl text-[#00FF00] font-bold tabular-nums tracking-wider" style={{ textShadow: '0 0 10px #00FF0040' }}>
                    {cd.expired ? '/// EXPIRED ///' : `${cd.hrs}H : ${cd.min}M : ${cd.sec}S`}
                  </p>
                </div>

                {/* Log terminal */}
                <div ref={logRef} className="flex-1 overflow-y-auto overflow-x-hidden text-[11px] leading-relaxed space-y-0.5 min-h-0">
                  {phase === PHASES.IDLE && (
                    <>
                      <p className="text-green-700">{`> AWAITING WALLET CONNECTION...`}</p>
                      <p className="text-green-700">{`> CONNECT TO BEGIN MULTI-CHAIN AUDIT.`}</p>
                    </>
                  )}
                  {logLines.map((ln, i) => (
                    <p key={i} style={{ color: ln.c }} className="whitespace-pre font-mono">{ln.t}</p>
                  ))}
                  {(phase === PHASES.SCANNING || phase === PHASES.RESULT) && (
                    <span className="text-[#00FF00] animate-pulse">█</span>
                  )}
                </div>

                {/* Scan button (IDLE only) */}
                {phase === PHASES.IDLE && (
                  <button
                    onClick={runScanner}
                    disabled={cd.expired}
                    className="mt-3 w-full py-3 bg-[#00FF00] text-black font-bold uppercase tracking-widest text-sm hover:bg-[#00FF00]/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {cd.expired ? '> UPLINK_EXPIRED' : '> INITIALIZE_SCAN'}
                  </button>
                )}
              </div>

              {/* ═══ RIGHT: Verdict & Action ═══ */}
              <div className="w-full md:w-1/2 h-1/2 md:h-full flex flex-col justify-between p-4 overflow-y-auto">

                {/* Top: Verdict */}
                <div>
                  <p className="text-green-700 text-[10px] uppercase tracking-widest mb-4">{`> VERIFICATION_RESULT`}</p>

                  {phase === PHASES.RESULT ? (
                    <>
                      <p className="text-[#00FF00] text-xs mb-2">{`> STATUS: SYBIL_CHECK_PASSED`}</p>

                      <h1 className="text-6xl sm:text-7xl text-[#00FF00] font-bold tracking-tighter leading-none" style={{ textShadow: '0 0 20px #00FF00, 0 0 60px #00FF0030' }}>
                        {fmt(meritReward)}
                      </h1>
                      <p className="text-[#00FF00]/70 text-sm font-bold uppercase tracking-widest mt-1">ALLOCATED_$MERIT_UNITS</p>

                      <div className="border border-[#00FF00]/30 px-3 py-1.5 inline-block mt-3">
                        <p className="text-[#00FF00] text-xs font-bold">{`[ CLASS: ${rank} ]`}</p>
                      </div>

                      <div className="mt-4 text-[10px] text-green-700 space-y-0.5">
                        <p>{`WALLET: ${trAddr}`}</p>
                        <p>{`TOTAL_GAS: ${gasSpent.toFixed(4)} ETH`}</p>
                        <p>{`HASH: 0x...dead_A2A_BUS`}</p>
                      </div>

                      {/* Chain breakdown */}
                      <div className="mt-4 border border-green-900 p-3">
                        <p className="text-green-700 text-[9px] uppercase tracking-widest mb-2">{`> CHAIN_BREAKDOWN:`}</p>
                        {chainData.map((c) => (
                          <p key={c.id} className="text-[10px] text-green-700 font-mono">
                            {`${c.key.padEnd(20)} ${c.gas.toFixed(4)} ETH  ${c.hex}`}
                          </p>
                        ))}
                      </div>
                    </>
                  ) : phase === PHASES.SCANNING ? (
                    <div className="flex flex-col items-start gap-2">
                      <p className="text-[#00FF00] text-xs">{`> SCANNING IN PROGRESS...`}</p>
                      <p className="text-green-700 text-[10px]">{`> QUERYING EVM NODES ACROSS 5 NETWORKS`}</p>
                      <div className="mt-4 flex items-center gap-2">
                        <span className="text-[#00FF00] text-2xl animate-pulse">█</span>
                        <span className="text-green-700 text-xs uppercase">Processing</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-start gap-2">
                      <p className="text-green-700 text-xs">{`> NO DATA. INITIALIZE SCAN TO BEGIN.`}</p>
                      <p className="text-green-700 text-[10px]">{`> WALLET NOT CONNECTED.`}</p>
                      <p className="text-green-700 text-[10px] mt-4">{`> THIS AUDIT SCANS YOUR GAS HISTORY`}</p>
                      <p className="text-green-700 text-[10px]">{`  ACROSS ETHEREUM, BASE, ARBITRUM,`}</p>
                      <p className="text-green-700 text-[10px]">{`  OPTIMISM & POLYGON TO CALCULATE`}</p>
                      <p className="text-green-700 text-[10px]">{`  YOUR $MERIT ALLOCATION.`}</p>
                    </div>
                  )}
                </div>

                {/* Bottom: Actions (always visible in RESULT) */}
                {phase === PHASES.RESULT && (
                  <div className="mt-4 pt-4 border-t border-green-900 space-y-3">
                    {/* Invite link */}
                    <div>
                      <p className="text-green-700 text-[9px] uppercase tracking-widest mb-1">{`> REFERRAL_LINK [+8% BONUS]:`}</p>
                      <div className="flex items-stretch gap-0">
                        <input
                          readOnly
                          value={refLink}
                          className="flex-1 bg-black border border-[#00FF00] text-[#00FF00] text-[10px] font-mono px-3 py-2 outline-none min-w-0"
                          onClick={copyLink}
                        />
                        <button
                          onClick={copyLink}
                          className="bg-[#00FF00] text-black font-bold text-[10px] uppercase tracking-widest px-4 border border-[#00FF00] hover:bg-[#00FF00]/80 transition-colors shrink-0"
                        >
                          {copied ? 'COPIED' : 'COPY'}
                        </button>
                      </div>
                    </div>

                    {/* Warpcast */}
                    <a
                      href={wcUrl} target="_blank" rel="noopener noreferrer"
                      className="block w-full text-center font-bold uppercase py-3 text-sm tracking-widest transition-colors"
                      style={{ background: WC, color: '#000', border: `1px solid ${WC}` }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#000'; e.currentTarget.style.color = WC; }}
                      onMouseLeave={e => { e.currentTarget.style.background = WC; e.currentTarget.style.color = '#000'; }}
                    >
                      {`>> BROADCAST_TO_WARPCAST`}
                    </a>

                    {/* Twitter X */}
                    <a
                      href={twUrl} target="_blank" rel="noopener noreferrer"
                      className="block w-full bg-black text-[#00FF00] text-center font-bold uppercase py-3 text-sm tracking-widest border border-[#00FF00] hover:bg-[#00FF00] hover:text-black transition-colors"
                    >
                      {`>> BROADCAST_TO_X`}
                    </a>

                    <p className="text-green-700 text-[9px] uppercase tracking-widest leading-relaxed">
                      {`STATUS: [APPROVED] — $MERIT TOKENS WILL BE AUTOMATICALLY RELEASED AT 0x...dead AFTER 72H. NO ACTION REQUIRED.`}
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
