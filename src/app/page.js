'use client';
import { useState, useEffect, useMemo, Component } from 'react';
import { ethers } from 'ethers';
import useSWR from 'swr';
import { AnimatePresence, motion } from 'framer-motion';
import { FACTORY_ADDRESS, RPC_URL } from '@/lib/constants';
import { FACTORY_ABI, FUND_ABI, TOKEN_ABI } from '@/lib/abis';
import { ipfsToHttp, fetchIPFSMetadata } from '@/lib/ipfs';
import HowItWorks from '@/components/HowItWorks';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function safeCall(fn, fallback = '') {
  try { return await fn(); } catch { return fallback; }
}

const BATCH_SIZE = 5;

async function fetchAllProjects() {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
  const addresses = await factory.getAllProjects();

  const results = [];
  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(addr => readProject(addr, provider)));
    results.push(...batchResults);
  }
  return results.filter(Boolean);
}

async function readProject(addr, provider) {
  try {
    const fund = new ethers.Contract(addr, FUND_ABI, provider);
    const [tokenAddr, raised, softCap, state, endTime, ipfsURI] = await Promise.all([
      fund.projectToken(),
      fund.totalRaised(),
      fund.SOFT_CAP(),
      fund.currentState(),
      fund.raiseEndTime(),
      safeCall(() => fund.ipfsURI(), ''),
    ]);

    const token = new ethers.Contract(tokenAddr, TOKEN_ABI, provider);
    const [name, symbol] = await Promise.all([
      safeCall(() => token.name(), 'Unknown'),
      safeCall(() => token.symbol(), '???'),
    ]);

    let avatarUrl = null;
    let description = '';
    if (ipfsURI) {
      const meta = await fetchIPFSMetadata(ipfsURI);
      if (meta) {
        avatarUrl = meta.image ? ipfsToHttp(meta.image) : null;
        description = meta.description || '';
      }
    }

    const raisedNum = Number(ethers.utils.formatEther(raised));
    const capNum = Number(ethers.utils.formatEther(softCap));

    return {
      address: addr,
      name, symbol,
      state: Number(state),
      raised: raisedNum,
      softCap: capNum,
      progress: capNum > 0 ? (raisedNum / capNum) * 100 : 0,
      endTime: Number(endTime) * 1000,
      avatarUrl,
      description,
    };
  } catch (err) {
    console.error(`Failed to load ${addr}:`, err);
    return null;
  }
}

function statusBadge(state) {
  switch (state) {
    case 0: return { text: '[IAO]\u00A0FUNDING', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' };
    case 1: return { text: '[ERR]\u00A0IAO_FAILED', color: 'text-red-400 bg-red-500/10 border-red-500/20' };
    case 2: return { text: '[PREP]\u00A0INITIALIZING', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
    case 3: return { text: '[LIVE]\u00A0AGENT_ACTIVE', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    default: return { text: 'UNKNOWN', color: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20' };
  }
}

function CardCountdown({ endTime, state }) {
  const [text, setText] = useState('--:--:--');
  useEffect(() => {
    if (state !== 0) { setText(state === 1 ? 'TERMINATED' : 'ENDED'); return; }
    const tick = () => {
      const diff = endTime - Date.now();
      if (diff <= 0) { setText('00:00:00'); return; }
      const h = String(Math.floor(diff / 3_600_000)).padStart(2, '0');
      const m = String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, '0');
      const s = String(Math.floor((diff % 60_000) / 1000)).padStart(2, '0');
      setText(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime, state]);
  return <span className="text-[10px] font-mono tabular-nums text-zinc-500">{text}</span>;
}

function SkeletonCard() {
  return (
    <div className="relative p-6 rounded-2xl bg-zinc-900/20 backdrop-blur-md border border-zinc-800 overflow-hidden">
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
      <div className="flex justify-between items-start mb-6">
        <div className="w-12 h-12 rounded-xl bg-zinc-800/80" />
        <div className="w-32 h-5 rounded bg-zinc-800/60" />
      </div>
      <div className="w-40 h-6 rounded bg-zinc-800/80 mb-2" />
      <div className="w-48 h-3 rounded bg-zinc-800/40 mb-4" />
      <div className="w-full h-3 rounded bg-zinc-800/30 mb-2" />
      <div className="w-3/4 h-3 rounded bg-zinc-800/20 mb-6" />
      <div className="space-y-3">
        <div className="flex justify-between">
          <div className="w-24 h-3 rounded bg-zinc-800/40" />
          <div className="w-12 h-3 rounded bg-zinc-800/40" />
        </div>
        <div className="w-full h-1 rounded-full bg-zinc-800" />
        <div className="flex justify-between">
          <div className="w-20 h-2.5 rounded bg-zinc-800/30" />
          <div className="w-20 h-2.5 rounded bg-zinc-800/30" />
        </div>
      </div>
      <div className="mt-8 flex items-center justify-between">
        <div className="w-16 h-3 rounded bg-zinc-800/40" />
        <div className="w-28 h-8 rounded-lg bg-zinc-800/60" />
      </div>
    </div>
  );
}

class ProjectErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { console.error('ProjectGrid render error:', err); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 rounded-xl border border-red-500/20 bg-red-500/5 text-center">
          <p className="text-red-400 text-sm font-mono mb-3">Render error — project grid crashed</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="text-xs font-bold text-blue-400 hover:underline"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AvatarImg({ src, alt, className = 'w-full h-full object-cover' }) {
  const [status, setStatus] = useState('loading');
  return (
    <>
      {status === 'loading' && (
        <div className="absolute inset-0 bg-zinc-800 animate-pulse rounded-xl" />
      )}
      {status === 'error' ? (
        <span className="text-2xl font-black text-blue-500">{(alt || '?').charAt(0)}</span>
      ) : (
        <img
          src={src}
          alt={alt}
          className={className}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          style={status === 'loading' ? { opacity: 0, position: 'absolute' } : undefined}
        />
      )}
    </>
  );
}

function readHiddenMap() {
  try { return JSON.parse(localStorage.getItem('meritx-hidden-projects') || '{}'); } catch { return {}; }
}

export default function Home() {
  const { data: allProjects, error, isValidating, mutate } = useSWR(
    'meritx-projects',
    fetchAllProjects,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 15_000,
      dedupingInterval: 5_000,
      errorRetryCount: 3,
      errorRetryInterval: 5_000,
      fallbackData: [],
    }
  );

  const [hiddenMap, setHiddenMap] = useState({});
  useEffect(() => {
    setHiddenMap(readHiddenMap());
    const onStorage = (e) => { if (e.key === 'meritx-hidden-projects') setHiddenMap(readHiddenMap()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const projects = useMemo(() => {
    return (allProjects || []).filter(p => !hiddenMap[p.address]);
  }, [allProjects, hiddenMap]);

  const isFirstLoad = !allProjects || (allProjects.length === 0 && isValidating && !error);

  const [activeTab, setActiveTab] = useState('live');

  const { live, launching, completed, archived } = useMemo(() => {
    const now = Date.now();
    const live = [], launching = [], completed = [], archived = [];

    for (const p of projects) {
      const age = now - p.endTime;
      if (p.state === 0) {
        live.push(p);
      } else if (p.state === 1) {
        age > SEVEN_DAYS_MS ? archived.push(p) : live.push(p);
      } else if (p.state === 2) {
        launching.push(p);
      } else if (p.state === 3) {
        age > THIRTY_DAYS_MS ? archived.push(p) : completed.push(p);
      } else {
        archived.push(p);
      }
    }

    live.sort((a, b) => b.progress - a.progress);
    launching.sort((a, b) => a.endTime - b.endTime);
    completed.sort((a, b) => b.progress - a.progress);

    return { live, launching, completed, archived };
  }, [projects]);

  const TAB_CONFIG = [
    { key: 'live', label: 'Funding Agents', count: live.length },
    { key: 'launching', label: 'Initializing', count: launching.length },
    { key: 'completed', label: 'Active Agents', count: completed.length },
    { key: 'archived', label: 'Archived', count: archived.length },
  ];
  const tabMap = { live, launching, completed, archived };
  const tabProjects = tabMap[activeTab] || live;

  const [a2aLogs, setA2aLogs] = useState([]);
  useEffect(() => {
    const logs = [
      '> Agent_Alpha invoked Compute_Node_7 [12ms]',
      '> Settlement successful: 0.002 ETH via Base L2',
      '> opML Verification: Proof verified by TEE',
      '> Yield distributed to PoP liquidity sink',
      '> A2A handshake: QuantMind <-> ResearchBot',
    ];
    let id = 0;
    setA2aLogs([{ id: id++, text: logs[0] }]);
    const interval = setInterval(() => {
      setA2aLogs(prev => {
        const next = { id: id++, text: logs[Math.floor(Math.random() * logs.length)] };
        return [next, ...prev].slice(0, 5);
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen font-sans selection:bg-blue-600/30" style={{ background: '#050505' }}>
      <main className="max-w-6xl mx-auto mt-12 px-4 pb-24 text-zinc-300">

        {/* Hero header */}
        <div className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between border-b border-zinc-900 pb-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">BASE L2</span>
              <span className="text-zinc-500 text-[10px] font-mono animate-pulse tracking-widest uppercase">Uplink: Secure</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-white mb-4">
              Tokenize the Future of <span className="text-blue-500">AI Agents.</span>
            </h1>
            <p className="text-white/40 text-sm max-w-xl leading-relaxed">
              The decentralized settlement layer for Autonomous AI Economies.<br/>
              Fair-launch your Agent&apos;s token via Initial Agent Offerings (IAO), powered by Base and the 0.15 Price-of-Proof engine.
            </p>
          </div>

          <div className="hidden lg:block w-64 h-24 bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 overflow-hidden">
            <p className="text-[9px] text-zinc-600 font-bold mb-2 uppercase tracking-widest">IAO_LIVE_FEED</p>
            <div className="text-[9px] font-mono text-blue-400/60 space-y-1">
              {a2aLogs.map((log) => <div key={log.id} className="truncate">{log.text}</div>)}
            </div>
          </div>
        </div>

        {/* Live indicator */}
        {!error && (
          <div className="flex items-center gap-2 mb-6">
            <span className={`w-2 h-2 rounded-full ${isValidating ? 'bg-blue-500 animate-pulse' : 'bg-blue-500/40'}`} />
            <span className="text-[10px] font-mono text-zinc-600 tracking-wider">
              {isValidating && isFirstLoad
                ? 'Scanning IAOs...'
                : isValidating
                  ? 'Refreshing...'
                  : `IAO radar \u2014 ${live.length} funding \u00B7 ${launching.length} initializing \u00B7 ${completed.length} active \u00B7 auto-sync 15s`}
            </span>
            {!isFirstLoad && (
              <button
                onClick={() => mutate()}
                disabled={isValidating}
                className="text-[9px] font-mono text-zinc-600 hover:text-blue-400 transition-colors disabled:opacity-30 ml-2"
              >
                REFRESH
              </button>
            )}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="mb-8 p-5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-center space-y-3">
            <p className="text-amber-400 text-sm font-mono">Syncing blockchain data...</p>
            <p className="text-amber-400/50 text-[10px] font-mono">
              {error.message?.includes('rate') || error.message?.includes('429')
                ? 'RPC rate limit reached — data will refresh automatically.'
                : error.message || 'Temporary network issue — retrying soon.'}
            </p>
            <button
              onClick={() => mutate()}
              className="text-xs font-bold text-blue-400 hover:underline"
            >
              Retry now
            </button>
          </div>
        )}

        {/* Tab Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-zinc-900/60 border border-zinc-800/60 rounded-xl mb-6">
          {TAB_CONFIG.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={[
                'py-2.5 px-3 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1.5',
                activeTab === tab.key
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300',
              ].join(' ')}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={[
                  'inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[9px] font-black px-1',
                  activeTab === tab.key ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800/80 text-zinc-600',
                ].join(' ')}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <ProjectErrorBoundary>
          {isFirstLoad && !error ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {tabProjects.length === 0 ? (
                  <div className="text-center py-20 space-y-3">
                    <p className="text-zinc-600 font-mono text-sm">
                      {activeTab === 'live' && 'No agents currently in IAO.'}
                      {activeTab === 'launching' && 'No agents initializing.'}
                      {activeTab === 'completed' && 'No active agents yet.'}
                      {activeTab === 'archived' && 'No archived agents.'}
                    </p>
                    {activeTab === 'live' && (
                      <a href="/launch" className="text-blue-400 text-xs font-bold hover:underline">Launch the first IAO &rarr;</a>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tabProjects.map((p) => {
                      const badge = statusBadge(p.state);
                      const isFailed = p.state === 1;
                      return (
                        <div
                          key={p.address}
                          onClick={() => window.location.href = '/invest/' + encodeURIComponent(p.address)}
                          className="relative group cursor-pointer p-6 rounded-2xl transition-all duration-500 bg-zinc-900/20 backdrop-blur-md border border-zinc-800 hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(37,99,235,0.1)]"
                        >
                          <div className="flex justify-between items-start mb-6">
                            <div className="w-12 h-12 rounded-xl bg-black border border-zinc-800 flex items-center justify-center overflow-hidden shadow-inner shrink-0">
                              {p.avatarUrl ? (
                                <AvatarImg src={p.avatarUrl} alt={p.name} />
                              ) : (
                                <span className="text-2xl font-black text-blue-500">{p.name.charAt(0)}</span>
                              )}
                            </div>
                            <span className={`text-[9px] font-bold px-2 py-1 rounded border uppercase tracking-widest ${badge.color}`}>
                              {badge.text}
                            </span>
                          </div>

                          <h3 className="text-xl font-bold text-white mb-1 tracking-tight group-hover:text-blue-400 transition-colors">{p.name}</h3>
                          <p className="text-xs text-zinc-500 font-mono mb-4 uppercase tracking-tighter">
                            ${p.symbol} &middot; {p.address.slice(0, 6)}...{p.address.slice(-4)}
                          </p>

                          <p className="text-sm text-zinc-400 line-clamp-2 min-h-[40px] mb-6 leading-relaxed">
                            {p.description || 'AI Agent tokenized via Initial Agent Offering on Base.'}
                          </p>

                          <div className="space-y-3">
                            <div className="flex justify-between text-xs font-mono">
                              <span className="text-zinc-500 uppercase">IAO Progress</span>
                              <span className="text-white font-bold">{Math.min(p.progress, 100).toFixed(1)}%</span>
                            </div>
                            <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-1000 ${isFailed ? 'bg-red-500/80' : p.state === 3 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]' : 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.8)]'}`}
                                style={{ width: `${Math.min(100, p.progress)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] font-mono text-zinc-600">
                              <span>Raised: {p.raised.toFixed(4)} ETH</span>
                              <span>Target: {p.softCap.toFixed(4)} ETH</span>
                            </div>
                          </div>

                          <div className="mt-8 flex items-center justify-between">
                            <CardCountdown endTime={p.endTime} state={p.state} />
                            <span className={`text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-lg ${
                              p.state === 0
                                ? 'text-white bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                                : p.state === 3
                                  ? 'text-white bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                                  : p.state === 2
                                    ? 'text-white bg-purple-600 hover:bg-purple-500 shadow-purple-600/20'
                                    : 'text-zinc-400 bg-zinc-800 shadow-none'
                            }`}>
                              {p.state === 0 ? 'Sponsor Compute' : p.state === 3 ? 'View Agent' : p.state === 2 ? 'Initializing' : 'Details'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </ProjectErrorBoundary>

        {/* Protocol Lifecycle Timeline */}
        <div className="py-20">
          <HowItWorks />
        </div>
      </main>
    </div>
  );
}
