'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import {
  FACTORY_ADDRESS,
  TREASURY_WALLET,
  SOFT_CAP_ETH,
  MAX_INVEST_ETH,
  LISTING_FEE_ETH,
} from '@/lib/constants';
import { fmtEth, truncAddr } from '@/lib/fmt';
import { FACTORY_ABI, FUND_ABI, TOKEN_ABI } from '@/lib/abis';
import { getSignerContract, handleTxError } from '@/lib/web3';

const ADMIN_WALLET = "0x9638B4Aa8D48222D89f320417D5c5f3ED4c51b67".toLowerCase();

const STATE_LABELS = {
  0: { text: 'FUNDING',   color: 'text-blue-400',    dot: 'bg-blue-500 animate-pulse', bg: 'bg-blue-500/10 border-blue-500/20' },
  1: { text: 'FAILED',    color: 'text-red-400',     dot: 'bg-red-500',                bg: 'bg-red-500/10 border-red-500/20' },
  2: { text: 'PREPARING', color: 'text-amber-400',   dot: 'bg-amber-500 animate-pulse',bg: 'bg-amber-500/10 border-amber-500/20' },
  3: { text: 'DEX READY', color: 'text-emerald-400', dot: 'bg-emerald-500',            bg: 'bg-emerald-500/10 border-emerald-500/20' },
};
const STATE_FALLBACK = { text: 'UNKNOWN', color: 'text-zinc-500', dot: 'bg-zinc-500', bg: 'bg-zinc-500/10 border-zinc-500/20' };

export default function AdminDashboard() {
  const [account, setAccount] = useState('');
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [treasuryBalance, setTreasuryBalance] = useState(null);
  const [factoryBalance, setFactoryBalance] = useState(null);

  const [pohgGas, setPohgGas] = useState(1.0);
  const [pohgCap, setPohgCap] = useState(0.05);
  const [pohgSaving, setPohgSaving] = useState(false);
  const [pohgLoaded, setPohgLoaded] = useState(false);

  const isAuthorized = account && account.toLowerCase() === ADMIN_WALLET;

  const totalProjects = projects.length;
  const totalRaisedAll = useMemo(() => projects.reduce((sum, p) => sum + Number(p.totalRaised), 0), [projects]);
  const countByState = useMemo(() => projects.reduce((acc, p) => { acc[p.state] = (acc[p.state] || 0) + 1; return acc; }, {}), [projects]);

  const fetchSystemData = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum || !isAuthorized) return;
    setProjectsLoading(true);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
      const addresses = await factory.getAllProjects();

      const [treasuryBal, factoryBal] = await Promise.all([
        provider.getBalance(TREASURY_WALLET),
        provider.getBalance(FACTORY_ADDRESS),
      ]);
      setTreasuryBalance(ethers.utils.formatEther(treasuryBal));
      setFactoryBalance(ethers.utils.formatEther(factoryBal));

      let launchWindowSec = 30 * 86400;
      let preLaunchNoticeSec = 21600;
      let launchExpirationSec = 86400;
      if (addresses.length > 0) {
        try {
          const probe = new ethers.Contract(addresses[0], FUND_ABI, provider);
          const [lw, pln, lex] = await Promise.all([
            probe.LAUNCH_WINDOW(),
            probe.PRE_LAUNCH_NOTICE().catch(() => ethers.BigNumber.from(21600)),
            probe.LAUNCH_EXPIRATION().catch(() => ethers.BigNumber.from(86400)),
          ]);
          launchWindowSec = Number(lw);
          preLaunchNoticeSec = Number(pln);
          launchExpirationSec = Number(lex);
        } catch {}
      }

      const results = await Promise.all(
        addresses.map(async (addr) => {
          try {
            const fund = new ethers.Contract(addr, FUND_ABI, provider);
            const [tokenAddr, raised, state, softCap, endTime, finalized, lpId, pool, announceTime] = await Promise.all([
              fund.projectToken(),
              fund.totalRaised(),
              fund.currentState(),
              fund.SOFT_CAP(),
              fund.raiseEndTime(),
              fund.isFinalized().catch(() => false),
              fund.lpTokenId().catch(() => ethers.BigNumber.from(0)),
              fund.uniswapPool().catch(() => ethers.constants.AddressZero),
              fund.launchAnnouncementTime().catch(() => ethers.BigNumber.from(0)),
            ]);

            const token = new ethers.Contract(tokenAddr, TOKEN_ABI, provider);
            const [name, symbol] = await Promise.all([token.name(), token.symbol()]);

            const raisedEth = Number(ethers.utils.formatEther(raised));
            const capEth = Number(ethers.utils.formatEther(softCap));
            const endSec = Number(endTime);
            const endMs = endSec * 1000;
            const stateNum = Number(state);
            const launchDeadlineMs = (endSec + launchWindowSec) * 1000;
            const announceSec = Number(announceTime);
            const noticeEndMs = announceSec > 0 ? (announceSec + preLaunchNoticeSec) * 1000 : 0;
            const launchExpirationMs = announceSec > 0 ? (announceSec + preLaunchNoticeSec + launchExpirationSec) * 1000 : 0;

            return {
              address: addr,
              name: name || 'Unknown',
              symbol: symbol || '???',
              totalRaised: raisedEth,
              softCap: capEth,
              endTime: endMs,
              launchDeadline: launchDeadlineMs,
              state: stateNum,
              progress: capEth > 0 ? Math.min((raisedEth / capEth) * 100, 100) : 0,
              isFinalized: finalized,
              lpTokenId: lpId.toString(),
              uniswapPool: pool,
              announcementTime: announceSec,
              noticeEndMs,
              launchExpirationMs,
            };
          } catch (err) {
            return { address: addr, name: '—', symbol: '—', totalRaised: 0, softCap: 0, endTime: 0, launchDeadline: 0, state: -1, progress: 0, isFinalized: false, lpTokenId: '0', uniswapPool: ethers.constants.AddressZero, announcementTime: 0, noticeEndMs: 0, launchExpirationMs: 0 };
          }
        })
      );
      setProjects(results);
    } catch (err) {
      console.error('System scan failed:', err);
      toast.error('Failed to scan on-chain state');
    } finally {
      setProjectsLoading(false);
    }
  }, [isAuthorized]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;
    const eth = window.ethereum;
    eth.request({ method: 'eth_accounts' }).then((accounts) => {
      if (accounts[0]) setAccount(accounts[0].toLowerCase());
    }).catch(() => {});
    const handleAccounts = (accounts) => {
      setAccount(accounts.length > 0 ? accounts[0].toLowerCase() : '');
    };
    eth.on('accountsChanged', handleAccounts);
    return () => eth.removeListener('accountsChanged', handleAccounts);
  }, []);

  useEffect(() => {
    if (isAuthorized) fetchSystemData();
  }, [isAuthorized, fetchSystemData]);

  useEffect(() => {
    if (!isAuthorized) return;
    fetch('/api/admin/config')
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data) {
          setPohgGas(json.data.gasPercentage);
          setPohgCap(json.data.hardCapEth);
          setPohgLoaded(true);
        }
      })
      .catch(() => {});
  }, [isAuthorized]);

  const savePoHGConfig = useCallback(async () => {
    if (!isAuthorized) return;
    setPohgSaving(true);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-wallet': account,
        },
        body: JSON.stringify({ gasPercentage: pohgGas, hardCapEth: pohgCap }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('PoHG parameters updated');
      } else {
        toast.error(json.error || 'Failed to save config');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setPohgSaving(false);
    }
  }, [isAuthorized, account, pohgGas, pohgCap]);

  const connectWallet = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) return toast.error('Please install MetaMask');
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts[0]) setAccount(accounts[0].toLowerCase());
    } catch { toast.error('Connection failed'); }
  }, []);

  const disconnectWallet = () => setAccount('');

  const [collectingFees, setCollectingFees] = useState({});
  const [hiddenProjects, setHiddenProjects] = useState({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem('meritx-hidden-projects');
      if (stored) setHiddenProjects(JSON.parse(stored));
    } catch {}
  }, []);

  const toggleVisibility = useCallback(async (addr) => {
    const nowHidden = !hiddenProjects[addr];
    const next = { ...hiddenProjects, [addr]: nowHidden };
    if (!nowHidden) delete next[addr];
    setHiddenProjects(next);
    try { localStorage.setItem('meritx-hidden-projects', JSON.stringify(next)); } catch {}
    try {
      await fetch('/api/admin/toggle-visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr, hidden: nowHidden }),
      });
    } catch {}
  }, [hiddenProjects]);

  const handleCollectFees = useCallback(async (fundAddr) => {
    if (typeof window === 'undefined' || !window.ethereum || !isAuthorized) return;
    setCollectingFees(prev => ({ ...prev, [fundAddr]: true }));
    try {
      const { contract } = getSignerContract(fundAddr, FUND_ABI);
      const tx = await contract.collectTradingFees({ gasLimit: 300000 });
      await tx.wait();
      toast.success('Fees collected!');
      fetchSystemData();
    } catch (err) {
      handleTxError(err);
    } finally {
      setCollectingFees(prev => ({ ...prev, [fundAddr]: false }));
    }
  }, [isAuthorized, fetchSystemData]);

  // --- 🔒 Access Control UI ---
  if (!account) {
    return (
      <div className="min-h-screen bg-[#020202] flex flex-col items-center justify-center font-mono space-y-6">
        <div className="text-2xl font-black tracking-tighter text-white">Merit<span className="text-blue-500">X</span>.</div>
        <p className="text-white/20 text-sm tracking-widest uppercase animate-pulse">Awaiting Protocol Operator...</p>
        <button onClick={connectWallet} className="px-8 py-3 rounded-full border border-blue-500/30 text-blue-500 font-bold text-sm hover:bg-blue-500 hover:text-black transition-all">
          CONNECT WALLET
        </button>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0a0000] flex flex-col items-center justify-center font-mono space-y-5 px-6 text-center">
        <div className="w-20 h-20 rounded-full border-2 border-red-500/30 flex items-center justify-center animate-pulse">
          <span className="text-red-500 text-4xl">⚠️</span>
        </div>
        <h1 className="text-3xl font-black text-red-500 tracking-wider">ACCESS DENIED</h1>
        <p className="text-red-400/60 text-sm max-w-md leading-relaxed">
          Connected wallet <span className="text-red-400 font-mono">{truncAddr(account)}</span> is
          not the designated Protocol Operator.
        </p>
        <p className="text-zinc-600 text-[10px] uppercase">Authorized: {truncAddr(ADMIN_WALLET, 10, 6)}</p>
        <a href="/" className="mt-4 text-xs text-white/20 hover:text-white/50 transition-colors underline underline-offset-4">
          Return to Agent Directory
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-blue-600/30">
      <div className="max-w-6xl mx-auto px-8 pt-10 pb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-zinc-800/60">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-widest uppercase flex items-center gap-3">
            <span className="text-blue-500">MERITX</span>
            <span className="text-zinc-600">//</span>
            PROTOCOL ANALYTICS
          </h1>
          <p className="text-[11px] font-mono text-zinc-600 mt-1.5 tracking-wider">
            Operator Dashboard — Secure Admin Architecture v6.6
          </p>
        </div>
        <button onClick={disconnectWallet}
          className="group shrink-0 px-4 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-red-500/40 text-xs font-mono flex items-center gap-2 transition-all">
          <span className="w-2 h-2 rounded-full bg-blue-500 group-hover:bg-red-500 transition-colors" />
          <span className="text-zinc-400 group-hover:hidden">{truncAddr(account)}</span>
          <span className="hidden group-hover:inline text-red-400 font-bold">DISCONNECT</span>
        </button>
      </div>

      <main className="max-w-6xl mx-auto px-8 py-8 space-y-6">
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl backdrop-blur-md overflow-hidden">
          <div className="h-0.5 bg-gradient-to-r from-blue-500/80 via-blue-500/30 to-transparent" />
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-500 mb-1">Protocol Parameters</h2>
                <p className="text-[10px] text-zinc-600 font-mono">On-chain constants — immutable after deployment</p>
              </div>
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-500/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> SECURE-ACCESS
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
              <Stat label="Total Projects" value={totalProjects} />
              <Stat label="Global TVL" value={fmtEth(totalRaisedAll)} unit="ETH" color="text-emerald-400" sub="sum across all projects" />
              <Stat label="Soft Cap" value={SOFT_CAP_ETH} unit="ETH" sub="per project target" />
              <Stat label="Max Allocation" value={MAX_INVEST_ETH} unit="ETH" sub="per wallet hard limit" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3 mt-3">
              <Stat label="Listing Fee" value={LISTING_FEE_ETH} unit="ETH" color="text-white" sub="anti-spam cost" />
              <Stat label="Platform Fee" value="5" unit="%" sub="on successful raises" />
              <Stat label="Treasury Wallet" value={treasuryBalance !== null ? Number(treasuryBalance).toFixed(4) : '—'} unit="ETH" color="text-blue-400" sub="fees forwarded here" />
              <Stat label="Factory Contract" value={factoryBalance !== null ? Number(factoryBalance).toFixed(4) : '—'} unit="ETH" color="text-zinc-400" sub="no withdraw() exists" />
            </div>
          </div>
        </div>

        {/* PoHG Macro-Controls */}
        <div className="bg-zinc-900/40 border border-cyan-500/20 rounded-xl backdrop-blur-md overflow-hidden">
          <div className="h-0.5 bg-gradient-to-r from-cyan-500/80 via-purple-500/40 to-transparent" />
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400 mb-1">PoHG Macro-Controls (Central Bank)</h2>
                <p className="text-[10px] text-zinc-600 font-mono">
                  Dynamic allocation parameters — applied to all new signature requests
                </p>
              </div>
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-500/50">
                <span className={`w-1.5 h-1.5 rounded-full ${pohgLoaded ? 'bg-cyan-500' : 'bg-zinc-600 animate-pulse'}`} />
                {pohgLoaded ? 'SYNCED' : 'LOADING'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Gas Conversion Rate</label>
                  <span className="text-lg font-black font-mono tabular-nums text-cyan-400">{pohgGas.toFixed(1)}%</span>
                </div>
                <input
                  type="range" min="1.0" max="3.0" step="0.1" value={pohgGas}
                  onChange={(e) => setPohgGas(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer bg-zinc-800 accent-cyan-500"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Absolute Hard Cap</label>
                  <span className="text-lg font-black font-mono tabular-nums text-purple-400">{pohgCap.toFixed(2)} ETH</span>
                </div>
                <input
                  type="range" min="0.05" max="0.15" step="0.01" value={pohgCap}
                  onChange={(e) => setPohgCap(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer bg-zinc-800 accent-purple-500"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center gap-4">
              <button
                onClick={savePoHGConfig}
                disabled={pohgSaving}
                className={[
                  'px-6 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all',
                  pohgSaving
                    ? 'bg-cyan-600/20 text-cyan-400 animate-pulse'
                    : 'bg-gradient-to-r from-cyan-600/20 to-purple-600/20 text-white border border-cyan-500/30 hover:border-cyan-400/60',
                ].join(' ')}
              >
                {pohgSaving ? 'Saving...' : 'Save Parameters'}
              </button>
            </div>
          </div>
        </div>

        {/* State Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(state => {
            const cfg = STATE_LABELS[state] || STATE_FALLBACK;
            return (
              <div key={state} className={`p-4 rounded-xl border ${cfg.bg} backdrop-blur-sm`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className={`text-[9px] font-bold uppercase tracking-widest ${cfg.color}`}>{cfg.text}</span>
                </div>
                <p className="text-2xl font-black font-mono text-white">{countByState[state] || 0}</p>
              </div>
            );
          })}
        </div>

        {/* Project Table (Condensed) */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-6">
           <div className="flex justify-between items-center mb-4">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400">Directory</h2>
              <button onClick={fetchSystemData} className="text-[10px] font-mono text-zinc-600 hover:text-white">REFRESH</button>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px] text-[12px]">
                 <thead className="text-zinc-500 border-b border-zinc-800/50">
                    <tr>
                       <th className="py-2">AGENT</th>
                       <th className="py-2 text-center">STATUS</th>
                       <th className="py-2 text-center">VISIBLE</th>
                       <th className="py-2 text-right">RAISED</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-zinc-800/30">
                    {projects.map(p => {
                       const cfg = STATE_LABELS[p.state] || STATE_FALLBACK;
                       return (
                          <tr key={p.address} className="hover:bg-white/5">
                             <td className="py-3">
                                <div className="font-bold text-white">{p.name}</div>
                                <div className="text-[10px] font-mono text-zinc-600">{truncAddr(p.address)}</div>
                             </td>
                             <td className="py-3 text-center">
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>{cfg.text}</span>
                             </td>
                             <td className="py-3 text-center">
                                <button onClick={() => toggleVisibility(p.address)} className={`w-8 h-4 rounded-full relative transition-colors ${hiddenProjects[p.address] ? 'bg-zinc-800' : 'bg-blue-600'}`}>
                                   <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${hiddenProjects[p.address] ? 'left-0.5' : 'left-4.5'}`} />
                                </button>
                             </td>
                             <td className="py-3 text-right font-mono text-white">{p.totalRaised.toFixed(3)} ETH</td>
                          </tr>
                       );
                    })}
                 </tbody>
              </table>
           </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, unit, sub, color }) {
  return (
    <div className="p-3 rounded-lg bg-black/30 border border-zinc-800/60">
      <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1.5 font-bold">{label}</p>
      <p className={`text-lg font-black font-mono tabular-nums ${color || 'text-white'}`}>
        {value}
        {unit && <span className="text-[10px] text-zinc-600 ml-1 font-normal">{unit}</span>}
      </p>
      {sub && <p className="text-[9px] text-zinc-600 font-mono mt-0.5">{sub}</p>}
    </div>
  );
}