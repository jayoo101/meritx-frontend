'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';

const TERMINAL_FONT = "'SF Mono', 'Fira Code', 'JetBrains Mono', 'Cascadia Code', Menlo, Consolas, monospace";

const AGENTS = {
  malpha: {
    name: 'Merit-Alpha-01',
    symbol: 'MALPHA',
    address: '0xA1fa82e300000000000000000000000000000001',
    state: 3,
    description: 'Autonomous High-Frequency Liquidity Provider. Executes cross-dex arbitrage on Base using MAS-20 settlement. Optimized for low-latency order routing across Uniswap V3, Aerodrome, and BaseSwap pools.',
    totalFunded: '0.082 ETH',
    tvl: '0.0791 ETH',
    softCap: '0.1 ETH',
    progress: 82,
    pohgVerified: true,
    masEndpoint: 'https://api.meritx.io/v1/agents/malpha/mas20',
    status: 'ACTIVE',
    statusColor: 'emerald',
    deployedAt: '2025-12-14T08:31:00Z',
    txCount: 1_847,
    uptime: '99.97%',
    logs: [
      { time: '00:00:12', text: 'Arb detected: WETH/USDC spread 0.18% across BaseSwap <-> Uniswap V3', type: 'arb' },
      { time: '00:00:09', text: 'Executed swap: 0.5 ETH -> 1,247.3 Compute_Credits via MAS-20', type: 'swap' },
      { time: '00:00:07', text: 'Settlement confirmed: Tx 0x8f2a…c901 on Base L2 (12ms)', type: 'settle' },
      { time: '00:00:05', text: 'PoP yield distribution: 0.0003 ETH to liquidity sink', type: 'yield' },
      { time: '00:00:03', text: 'A2A handshake: Merit-Alpha-01 <-> DeepScan_Base_GPT [OK]', type: 'a2a' },
      { time: '00:00:01', text: 'Heartbeat: All systems nominal. Gas: 0.2 gwei', type: 'system' },
    ],
  },
  dscan: {
    name: 'DeepScan_Base_GPT',
    symbol: 'DSCAN',
    address: '0xD5ca9b0200000000000000000000000000000002',
    state: 0,
    description: 'On-chain Research Agent. Autonomously purchases premium RPC compute via PoHG-verified gateways. Indexes all Base L2 contract deployments and classifies risk vectors using a fine-tuned GPT model.',
    totalFunded: '0.045 ETH',
    tvl: '—',
    softCap: '0.1 ETH',
    progress: 45,
    pohgVerified: true,
    masEndpoint: 'https://api.meritx.io/v1/agents/dscan/mas20',
    status: 'IAO LIVE',
    statusColor: 'blue',
    deployedAt: null,
    txCount: 0,
    uptime: '—',
    logs: [
      { time: '00:00:14', text: 'IAO sponsor received: 0.008 ETH from 0x7c3f…a210', type: 'fund' },
      { time: '00:00:11', text: 'PoHG gate check: Wallet 0x7c3f…a210 — PASS (412 txs, 0.31 ETH gas)', type: 'pohg' },
      { time: '00:00:08', text: 'Progress update: 45.0% of Soft Cap reached', type: 'system' },
      { time: '00:00:05', text: 'New sponsor connected: 0xb901…ff42 via MetaMask', type: 'fund' },
      { time: '00:00:03', text: 'Anti-Stealth: 6h public notice timer active — 4h 12m remaining', type: 'system' },
      { time: '00:00:01', text: 'IAO radar: 12 unique sponsors, 0 flagged by Sybil filter', type: 'system' },
    ],
  },
  sent: {
    name: 'BaseGuard_Sentinel',
    symbol: 'SENT',
    address: '0x5e41ae1300000000000000000000000000000003',
    state: 0,
    description: 'Security Audit Agent. The first sentinel node deployed via PoHG Sybil-defense protocol. Monitors all new contract deployments on Base for known exploit patterns and rug-pull signatures.',
    totalFunded: '0.000 ETH',
    tvl: '—',
    softCap: '0.1 ETH',
    progress: 0,
    pohgVerified: false,
    masEndpoint: 'https://api.meritx.io/v1/agents/sent/mas20',
    status: 'UPCOMING',
    statusColor: 'amber',
    deployedAt: null,
    txCount: 0,
    uptime: '—',
    logs: [
      { time: '00:00:06', text: 'Agent registered on MeritX Factory — awaiting first sponsor', type: 'system' },
      { time: '00:00:04', text: 'MAS-20 interface initialized: /v1/agents/sent/mas20', type: 'system' },
      { time: '00:00:02', text: 'PoHG gate: Pending — requires sponsor wallet verification', type: 'pohg' },
      { time: '00:00:01', text: 'Sentinel monitoring module: Standby. Awaiting IAO completion.', type: 'system' },
    ],
  },
};

const LOG_COLORS = {
  arb: 'text-cyan-400',
  swap: 'text-blue-400',
  settle: 'text-emerald-400',
  yield: 'text-purple-400',
  a2a: 'text-blue-300',
  system: 'text-zinc-500',
  fund: 'text-emerald-400',
  pohg: 'text-amber-400',
};

const STATUS_STYLES = {
  emerald: { badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400', glow: 'shadow-[0_0_6px_rgba(52,211,153,0.7)]' },
  blue:    { badge: 'text-blue-400 bg-blue-500/10 border-blue-500/20',          dot: 'bg-blue-400',    glow: 'shadow-[0_0_6px_rgba(96,165,250,0.7)]' },
  amber:   { badge: 'text-amber-400 bg-amber-500/10 border-amber-500/20',       dot: 'bg-amber-400',   glow: 'shadow-[0_0_6px_rgba(251,191,36,0.7)]' },
};

const PROTOCOL_FEED_ENTRIES = [
  { tag: 'MAS-20',          text: 'Initiating payment for API_Compute_Node_7',                          color: 'text-blue-400' },
  { tag: 'PoHG',            text: 'Verifying historical gas footprint... [SUCCESS]',                    color: 'text-emerald-400' },
  { tag: 'SETTLEMENT',      text: '0.042 WETH routed to Provider_0x71... via Base L2',                  color: 'text-cyan-400' },
  { tag: 'PoP_ENGINE',      text: 'Adjusting emission curve: S(P) updated.',                            color: 'text-purple-400' },
  { tag: 'AGENT_HANDSHAKE', text: 'Merit-Alpha-01 <-> DeepScan_Base_GPT',                               color: 'text-blue-300' },
  { tag: 'LIQUIDITY',       text: '95% POL locked in UniV3 — LP NFT immutable.',                        color: 'text-emerald-400' },
  { tag: 'SETTLEMENT',      text: '0.018 WETH settled: DeepScan -> Compute_Provider_12 (8ms)',           color: 'text-cyan-400' },
  { tag: 'MAS-20',          text: 'Agent Merit-Alpha-01 registered new service endpoint /v1/arb',        color: 'text-blue-400' },
  { tag: 'PoHG',            text: 'Wallet 0xb901…ff42 gas check: 847 txs, 1.24 ETH — PASS',            color: 'text-emerald-400' },
  { tag: 'ANTI_STEALTH',    text: '6h public notice broadcast for BaseGuard_Sentinel IAO.',             color: 'text-amber-400' },
  { tag: 'PoP_ENGINE',      text: 'Inflation minted: 42,100 $MALPHA at P/P₀ = 1.032',                  color: 'text-purple-400' },
  { tag: 'AGENT_HANDSHAKE', text: 'BaseGuard_Sentinel <-> SecurityOracle_Base [PENDING]',               color: 'text-blue-300' },
];

function generateTimestamp() {
  const h = String(9 + Math.floor(Math.random() * 3)).padStart(2, '0');
  const m = String(Math.floor(Math.random() * 60)).padStart(2, '0');
  const s = String(Math.floor(Math.random() * 60)).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export default function AgentDetailPage() {
  const params = useParams();
  const agent = AGENTS[params?.id];

  const [copied, setCopied] = useState(false);
  const [liveLogs, setLiveLogs] = useState([]);
  const [protocolFeed, setProtocolFeed] = useState([]);

  useEffect(() => {
    if (!agent) return;
    setLiveLogs(agent.logs.map((l, i) => ({ ...l, id: i })));

    let counter = agent.logs.length;
    const interval = setInterval(() => {
      setLiveLogs(prev => {
        const src = agent.logs[Math.floor(Math.random() * agent.logs.length)];
        const secs = String(Math.floor(Math.random() * 15)).padStart(2, '0');
        const entry = { ...src, time: `00:00:${secs}`, id: counter++ };
        return [entry, ...prev].slice(0, 12);
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [agent]);

  useEffect(() => {
    const initial = PROTOCOL_FEED_ENTRIES.slice(0, 5).map((e, i) => ({
      ...e, id: i, timestamp: generateTimestamp(),
    }));
    setProtocolFeed(initial);

    let feedId = 5;
    const interval = setInterval(() => {
      setProtocolFeed(prev => {
        const src = PROTOCOL_FEED_ENTRIES[Math.floor(Math.random() * PROTOCOL_FEED_ENTRIES.length)];
        const entry = { ...src, id: feedId++, timestamp: generateTimestamp() };
        return [entry, ...prev].slice(0, 20);
      });
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = () => {
    if (!agent) return;
    navigator.clipboard.writeText(agent.masEndpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!agent) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#050505' }}>
        <div className="text-center space-y-4">
          <p className="text-zinc-500 font-mono text-sm">Agent not found</p>
          <Link href="/" className="text-blue-400 text-xs font-bold hover:underline">&larr; Back to Directory</Link>
        </div>
      </div>
    );
  }

  const sts = STATUS_STYLES[agent.statusColor];
  const pct = Math.min(100, agent.progress);

  return (
    <div className="min-h-screen font-sans selection:bg-blue-600/30" style={{ background: '#050505' }}>
      <div className="max-w-6xl mx-auto px-4 pb-24 text-zinc-300">

        {/* Breadcrumb */}
        <div className="pt-6 pb-4 flex items-center gap-2 text-[10px] font-mono text-zinc-600">
          <Link href="/" className="hover:text-blue-400 transition-colors">DIRECTORY</Link>
          <span>/</span>
          <span className="text-zinc-400">{agent.symbol}</span>
        </div>

        {/* ═══════════════ HEADER ═══════════════ */}
        <header className="pb-8 border-b border-zinc-800/60">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 rounded-2xl bg-black border border-zinc-800 flex items-center justify-center shrink-0">
                <span className="text-3xl font-black text-blue-500">{agent.name.charAt(0)}</span>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{agent.name}</h1>
                  <span className={`flex items-center gap-1.5 text-[9px] font-bold px-2 py-1 rounded border uppercase tracking-widest ${sts.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${sts.dot} ${sts.glow}`} />
                    {agent.status}
                  </span>
                </div>
                <p className="text-sm font-mono text-zinc-500 mb-3">
                  ${agent.symbol} &middot; {agent.address.slice(0, 6)}...{agent.address.slice(-4)}
                </p>
                <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">{agent.description}</p>
              </div>
            </div>

            {agent.pohgVerified && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 shrink-0">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">PoHG Verified</span>
              </div>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-8">

          {/* ═══════════════ MAIN CONTENT (2 cols) ═══════════════ */}
          <div className="lg:col-span-2 space-y-8">

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Funded', value: agent.totalFunded, accent: 'text-blue-400' },
                { label: 'TVL', value: agent.tvl, accent: 'text-emerald-400' },
                { label: 'Transactions', value: agent.txCount.toLocaleString(), accent: 'text-cyan-400' },
                { label: 'Uptime', value: agent.uptime, accent: 'text-purple-400' },
              ].map(s => (
                <div key={s.label} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
                  <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-1">{s.label}</p>
                  <p className={`text-lg font-black font-mono ${s.accent}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Funding Progress */}
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider">IAO Progress</p>
                <p className="text-sm font-black font-mono text-white">{pct.toFixed(1)}%</p>
              </div>
              <div className="w-full h-2 bg-zinc-800/80 rounded-full overflow-hidden mb-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  className={`h-full rounded-full ${
                    agent.state === 3
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.6)]'
                      : 'bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-500 shadow-[0_0_12px_rgba(6,182,212,0.6)]'
                  }`}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-zinc-600">
                <span>Raised: {agent.totalFunded}</span>
                <span>Soft Cap: {agent.softCap}</span>
              </div>
            </div>

            {/* Activity Log */}
            <div className="rounded-xl border border-zinc-800/60 bg-black/50 overflow-hidden" style={{ fontFamily: TERMINAL_FONT }}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/40">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Activity Log</span>
                </div>
                <span className="text-[9px] text-zinc-700 uppercase tracking-widest">Live</span>
              </div>
              <div className="p-4 space-y-0 max-h-[380px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgb(63 63 70) transparent' }}>
                <AnimatePresence initial={false}>
                  {liveLogs.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className="flex items-start gap-3 py-1.5 border-b border-zinc-800/20 last:border-0"
                    >
                      <span className="text-[10px] text-zinc-700 tabular-nums shrink-0 pt-px">{log.time}</span>
                      <span className={`text-[11px] leading-relaxed ${LOG_COLORS[log.type] || 'text-zinc-500'}`}>
                        {log.text}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* ═══════════════ ACTION SIDEBAR ═══════════════ */}
          <aside className="space-y-6">

            {/* Fund Button */}
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 space-y-4">
              <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">{agent.state === 3 ? 'Agent Operations' : 'Sponsor Compute'}</p>
              <button className={`w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-wider transition-all shadow-lg ${
                agent.state === 3
                  ? 'text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 shadow-emerald-600/20 hover:shadow-emerald-500/30'
                  : agent.state === 0
                    ? 'text-white bg-blue-600 hover:bg-blue-500 border border-blue-500 shadow-blue-600/20 hover:shadow-blue-500/30'
                    : 'text-zinc-400 bg-zinc-800 border border-zinc-700 cursor-not-allowed shadow-none'
              }`}>
                {agent.state === 3 ? 'View Agent Dashboard' : agent.state === 0 ? 'Fund this Agent' : 'Coming Soon'}
              </button>
              {agent.state === 0 && (
                <p className="text-[10px] text-zinc-600 font-mono text-center">
                  PoHG verification required &middot; Min 0.001 ETH
                </p>
              )}
            </div>

            {/* MAS-20 API Endpoint */}
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 space-y-3">
              <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">MAS-20 API Endpoint</p>
              <div
                onClick={handleCopy}
                className="group flex items-center gap-2 p-3 rounded-lg bg-black/60 border border-zinc-800 hover:border-blue-500/30 cursor-pointer transition-all"
              >
                <code className="text-[10px] text-blue-400/80 truncate flex-1" style={{ fontFamily: TERMINAL_FONT }}>
                  {agent.masEndpoint}
                </code>
                <span className="text-[9px] font-mono text-zinc-600 group-hover:text-blue-400 transition-colors shrink-0">
                  {copied ? 'COPIED' : 'COPY'}
                </span>
              </div>
              <p className="text-[10px] text-zinc-600 font-mono leading-relaxed">
                Use this endpoint for Agent-to-Agent commerce via the MAS-20 standard.
              </p>
            </div>

            {/* Protocol Details */}
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 space-y-3">
              <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Protocol Details</p>
              <div className="space-y-2">
                {[
                  { label: 'Token Standard', value: 'MAS-20' },
                  { label: 'Settlement Layer', value: 'Base L2' },
                  { label: 'Liquidity Lock', value: '95% POL' },
                  { label: 'PoP Engine', value: 'S(P)=S₀×(P/P₀)⁰·¹⁵' },
                  ...(agent.deployedAt ? [{ label: 'Deployed', value: new Date(agent.deployedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }] : []),
                ].map(d => (
                  <div key={d.label} className="flex justify-between items-center">
                    <span className="text-[10px] font-mono text-zinc-600">{d.label}</span>
                    <span className="text-[10px] font-mono text-zinc-300">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* PoP Formula */}
            <div className="rounded-xl border border-emerald-500/10 bg-black/50 p-4 text-center" style={{ fontFamily: TERMINAL_FONT }}>
              <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-2">Price-of-Proof Engine</p>
              <span className="text-emerald-400 text-sm font-bold">
                S<span className="text-zinc-500 text-xs">(P)</span>
                <span className="text-zinc-500 mx-1">=</span>
                <span className="text-zinc-300">40.95M</span>
                <span className="text-zinc-500 mx-1">&times;</span>
                <span className="text-zinc-500">(</span>
                <span className="text-zinc-300">P</span>
                <span className="text-zinc-600">/</span>
                <span className="text-zinc-300">P<sub>0</sub></span>
                <span className="text-zinc-500">)</span>
                <sup className="text-emerald-400/80 text-[10px] ml-0.5">0.15</sup>
              </span>
            </div>

            {/* Back Link */}
            <Link
              href="/"
              className="flex items-center justify-center gap-2 py-3 rounded-xl border border-zinc-800/60 text-zinc-500 text-xs font-mono hover:text-white hover:border-zinc-700 transition-all"
            >
              &larr; Back to Directory
            </Link>
          </aside>

        </div>

        {/* ═══════════════ REAL-TIME PROTOCOL ACTIVITY — CENTERPIECE ═══════════════ */}
        <div className="mt-12">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(37,99,235,0.7)]" />
            <h2 className="text-lg font-black text-white tracking-tight">Real-time Protocol Activity</h2>
            <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest ml-auto">MAS-20 Standard</span>
          </div>

          <div
            className="protocol-terminal rounded-2xl border border-zinc-800/60 overflow-hidden"
            style={{ background: '#0a0a0a', fontFamily: TERMINAL_FONT }}
          >
            {/* Terminal chrome */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800/40" style={{ background: '#0d0d0d' }}>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
              </div>
              <span className="text-[10px] text-zinc-600 tracking-wider flex-1 text-center">meritx://protocol-bus/{agent?.symbol?.toLowerCase() || 'agent'}/live</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                <span className="text-[9px] text-emerald-500/70 uppercase tracking-widest">Connected</span>
              </div>
            </div>

            {/* Feed body */}
            <div
              className="p-5 space-y-0 max-h-[420px] overflow-y-auto relative"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgb(39 39 42) transparent' }}
            >
              <AnimatePresence initial={false}>
                {protocolFeed.map((entry) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -12, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: 'auto' }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="flex items-start gap-0 py-2 border-b border-zinc-800/15 last:border-0"
                  >
                    <span className="text-[10px] text-zinc-700 tabular-nums shrink-0 w-[72px]">[{entry.timestamp}]</span>
                    <span className="text-[10px] text-zinc-600 mx-1.5 shrink-0">—</span>
                    <span className={`text-[10px] font-bold shrink-0 mr-1.5 ${entry.color}`}>{entry.tag}:</span>
                    <span className="text-[11px] text-zinc-400 leading-relaxed">{entry.text}</span>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Blinking cursor at bottom */}
              <div className="flex items-center gap-2 pt-3">
                <span className="text-[10px] text-zinc-700">&gt;</span>
                <span className="w-2 h-4 bg-blue-500/70 animate-pulse" />
              </div>
            </div>

            {/* Terminal footer */}
            <div className="flex items-center justify-between px-5 py-2.5 border-t border-zinc-800/30" style={{ background: '#080808' }}>
              <div className="flex items-center gap-4 text-[9px] text-zinc-700 font-mono">
                <span>Base L2</span>
                <span>&middot;</span>
                <span>Block: {(19_847_291 + Math.floor(Math.random() * 100)).toLocaleString()}</span>
                <span>&middot;</span>
                <span>Gas: 0.{Math.floor(Math.random() * 9) + 1} gwei</span>
              </div>
              <span className="text-[9px] text-zinc-700 font-mono">MeritX Protocol v1.0</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
