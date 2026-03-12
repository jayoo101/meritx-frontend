'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { fmtEth, truncAddr } from '@/lib/fmt';
import {
  FACTORY_ADDRESS,
  CHAIN_ID,
  CHAIN_ID_HEX,
  CHAIN_NAME,
  RPC_URL,
  EXPLORER_URL,
} from '@/lib/constants';
import { FACTORY_ABI, FUND_ABI, TOKEN_ABI } from '@/lib/abis';

// ---- Circular Progress Ring ----

function RingProgress({ pct, size = 36, stroke = 3, colorClass = 'text-blue-500' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(Math.max(pct, 0), 100) / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-zinc-800" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
        stroke="currentColor" className={colorClass}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

// ---- Tab Button ----

function TabBtn({ label, count, active, live, onClick }) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <button
      onClick={onClick}
      className={[
        'relative flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all',
        active
          ? 'bg-zinc-800 text-white shadow-sm'
          : 'text-zinc-500 hover:text-zinc-300',
      ].join(' ')}
    >
      <span className="flex items-center justify-center gap-1.5" suppressHydrationWarning>
        {(isMounted && live) && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
        {label}
        {(isMounted && count > 0) && (
          <span className={[
            'inline-flex items-center justify-center min-w-[16px] h-4 rounded-full text-[9px] font-black px-1',
            active ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-500',
          ].join(' ')}>
            {count}
          </span>
        )}
      </span>
    </button>
  );
}

// ---- Drawer Project Card ----

const ACTION_COLORS = {
  claim:  { btn: 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20', ring: 'text-blue-500' },
  refund: { btn: 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20', ring: 'text-red-500' },
  amber:  { btn: 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20', ring: 'text-amber-500' },
  live:   { btn: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30', ring: 'text-cyan-500' },
  none:   { btn: 'bg-zinc-800/50 text-zinc-500 border-zinc-700/40', ring: 'text-zinc-600' },
};

function DrawerCard({ p, actionAddr, onClaim, onRefund }) {
  const busy = actionAddr === p.address;
  const action = getCardAction(p);

  const handleClick = () => {
    if (action.type === 'claim') onClaim(p.address);
    else if (action.type === 'refund') onRefund(p.address);
  };

  const colors = ACTION_COLORS[action.type] || ACTION_COLORS.none;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-center gap-3 py-3 group"
    >
      {/* Icon + Progress Ring */}
      <div className="relative shrink-0">
        <RingProgress pct={p.progress} colorClass={colors.ring} />
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-white">
          {p.name.charAt(0)}
        </span>
      </div>

      {/* Info */}
      <Link href={`/invest/${p.address}`} className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-zinc-200 truncate group-hover:text-blue-400 transition-colors">
            {p.name}
          </span>
          <span className="text-[9px] font-mono text-zinc-600">${p.symbol}</span>
          {p.isOwner && (
            <span className="px-1 py-px rounded bg-purple-500/10 border border-purple-500/30 text-[7px] font-bold text-purple-400 uppercase">
              AI Dev
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-zinc-500">
          <span>{fmtEth(p.contribution)} ETH</span>
          {p.isNoticeLive && (
            <span className="flex items-center gap-1 text-cyan-400">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              T-Minus
            </span>
          )}
        </div>
      </Link>

      {/* Action */}
      {action.type !== 'none' ? (
        <button
          onClick={handleClick}
          disabled={busy}
          className={[
            'shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-all',
            busy ? 'opacity-50 animate-pulse' : '',
            colors.btn,
          ].join(' ')}
        >
          {busy ? '...' : action.label}
        </button>
      ) : (
        <span className={[
          'shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border',
          colors.btn,
        ].join(' ')}>
          {action.label}
        </span>
      )}
    </motion.div>
  );
}

function getCardAction(p) {
  if (p.state === 1 && p.contribution > 0) return { type: 'refund', label: 'Reclaim ETH' };
  if (p.state === 2 && (p.isLaunchExpired || p.isExpired) && p.contribution > 0) return { type: 'refund', label: 'Reclaim ETH' };
  if (p.state >= 3 && p.isFinalized && p.contribution > 0) return { type: 'claim', label: 'Claim' };
  if (p.state === 0) return { type: 'none', label: 'Funding' };
  if (p.state === 2 && p.isNoticeLive) return { type: 'live', label: 'Notice' };
  if (p.state === 2) return { type: 'none', label: 'Preparing' };
  return { type: 'none', label: 'View' };
}

// ---- Main Navbar ----

export default function Navbar() {
  const pathname = usePathname();
  const [account, setAccount] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerProjects, setDrawerProjects] = useState([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [actionAddr, setActionAddr] = useState(null);
  const [activeTab, setActiveTab] = useState('active');

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) return toast.error('Please install MetaMask');
    try {
      await window.ethereum.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts[0]) {
        setAccount(accounts[0]);
        localStorage.setItem('isWalletConnected', 'true');
      }
    } catch { toast.error('Wallet connection failed'); }
  };

  const disconnectWallet = () => {
    setAccount('');
    localStorage.removeItem('isWalletConnected');
    setDrawerOpen(false);
  };

  const switchWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) return toast.error('MetaMask not detected');
    try {
      await window.ethereum.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts[0]) {
        setAccount(accounts[0]);
        toast.success('Wallet switched');
      }
    } catch { toast.error('Wallet switch failed'); }
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;
    const eth = window.ethereum;

    if (localStorage.getItem('isWalletConnected') === 'true') {
      eth.request({ method: 'eth_accounts' })
        .then((accs) => { if (accs[0]) setAccount(accs[0]); })
        .catch(() => {});
    }

    const onAccountsChanged = (accs) => {
      if (accs.length > 0) { setAccount(accs[0]); localStorage.setItem('isWalletConnected', 'true'); }
      else { setAccount(''); localStorage.removeItem('isWalletConnected'); }
    };

    const onChainChanged = (chainId) => {
      if (Number(chainId) !== Number(CHAIN_ID)) {
        toast('Switching to ' + CHAIN_NAME + '...', { icon: '\uD83D\uDD35' });
        eth.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: CHAIN_ID_HEX }],
        }).catch(() => {
          eth.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: CHAIN_ID_HEX,
              chainName: CHAIN_NAME,
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: [RPC_URL],
              blockExplorerUrls: [EXPLORER_URL],
            }],
          }).catch(() => {});
        });
      }
    };

    eth.on('accountsChanged', onAccountsChanged);
    eth.on('chainChanged', onChainChanged);
    return () => {
      eth.removeListener('accountsChanged', onAccountsChanged);
      eth.removeListener('chainChanged', onChainChanged);
    };
  }, []);

  const fetchDrawerData = useCallback(async () => {
    if (!account || typeof window === 'undefined' || !window.ethereum) return;
    setDrawerLoading(true);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
      const addresses = await factory.getAllProjects();

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
            const [tokenAddr, owner, raised, softCap, endTime, state, contrib, finalized, announceTime] = await Promise.all([
              fund.projectToken(),
              fund.projectOwner(),
              fund.totalRaised(),
              fund.SOFT_CAP(),
              fund.raiseEndTime(),
              fund.currentState(),
              fund.contributions(account),
              fund.isFinalized().catch(() => false),
              fund.launchAnnouncementTime().catch(() => ethers.BigNumber.from(0)),
            ]);

            const contribEth = Number(ethers.utils.formatEther(contrib));
            const isOwner = owner.toLowerCase() === account.toLowerCase();
            if (contribEth <= 0 && !isOwner) return null;

            const token = new ethers.Contract(tokenAddr, TOKEN_ABI, provider);
            const [name, symbol] = await Promise.all([token.name(), token.symbol()]);

            const endSec = Number(endTime);
            const stateNum = Number(state);
            const raisedEth = Number(ethers.utils.formatEther(raised));
            const capEth = Number(ethers.utils.formatEther(softCap));
            const launchDeadlineMs = (endSec + launchWindowSec) * 1000;
            const announceSec = Number(announceTime);
            const noticeEndMs = announceSec > 0 ? (announceSec + preLaunchNoticeSec) * 1000 : 0;
            const launchExpirationMs = announceSec > 0 ? (announceSec + preLaunchNoticeSec + launchExpirationSec) * 1000 : 0;
            const noticeHasElapsed = announceSec > 0 && Date.now() >= noticeEndMs;
            const isNoticeLive = announceSec > 0 && !noticeHasElapsed;

            return {
              address: addr,
              name, symbol,
              state: stateNum,
              contribution: contribEth,
              raised: raisedEth,
              softCap: capEth,
              progress: capEth > 0 ? Math.min((raisedEth / capEth) * 100, 100) : 0,
              isOwner,
              isFinalized: finalized,
              isExpired: stateNum === 2 && Date.now() > launchDeadlineMs,
              isLaunchExpired: announceSec > 0 && noticeHasElapsed && launchExpirationMs > 0 && Date.now() > launchExpirationMs,
              isNoticeLive,
              isAnnounced: announceSec > 0,
              noticeElapsed: noticeHasElapsed,
            };
          } catch { return null; }
        })
      );
      setDrawerProjects(results.filter(Boolean));
    } catch {
      toast.error('Failed to load backed agents');
    } finally {
      setDrawerLoading(false);
    }
  }, [account]);

  const openDrawer = () => {
    setDrawerOpen(true);
    fetchDrawerData();
  };

  const handleClaim = async (addr) => {
    if (typeof window === 'undefined' || !window.ethereum) return toast.error('Wallet not connected.');
    setActionAddr(addr);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const fund = new ethers.Contract(addr, FUND_ABI, signer);
      const tx = await fund.claimTokens({ gasLimit: 300000 });
      toast('Claiming tokens...', { icon: '\u23F3' });
      await tx.wait();
      toast.success('Agent tokens claimed!');
      fetchDrawerData();
    } catch (err) {
      if (err?.code === 'ACTION_REJECTED' || err?.code === 4001) toast.error('Transaction rejected');
      else toast.error('Claim failed: ' + (err?.reason || err?.message || 'Unknown'));
    } finally { setActionAddr(null); }
  };

  const handleRefund = async (addr) => {
    if (typeof window === 'undefined' || !window.ethereum) return toast.error('Wallet not connected.');
    setActionAddr(addr);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const fund = new ethers.Contract(addr, FUND_ABI, signer);
      const tx = await fund.claimRefund({ gasLimit: 300000 });
      toast('Processing refund...', { icon: '\u23F3' });
      await tx.wait();
      toast.success('Refund claimed!');
      fetchDrawerData();
    } catch (err) {
      if (err?.code === 'ACTION_REJECTED' || err?.code === 4001) toast.error('Transaction rejected');
      else toast.error('Refund failed: ' + (err?.reason || err?.message || 'Unknown'));
    } finally { setActionAddr(null); }
  };

  // ---- Categorize projects into tabs 1----
  const { active, claimable, refunds, hasLiveNotice } = useMemo(() => {
    const active = [];
    const claimable = [];
    const refunds = [];
    let hasLiveNotice = false;

    for (const p of drawerProjects) {
      if (p.isNoticeLive) hasLiveNotice = true;

      // Claimable: DEX live, tokens to claim
      if (p.state >= 3 && p.isFinalized && p.contribution > 0) {
        claimable.push(p);
        continue;
      }

      // Refunds: failed, expired, or launch expired
      if (
        (p.state === 1 && p.contribution > 0) ||
        (p.state === 2 && p.isExpired && p.contribution > 0) ||
        (p.state === 2 && p.isLaunchExpired && p.contribution > 0)
      ) {
        refunds.push(p);
        continue;
      }

      // Active: funding or notice period
      if (p.state === 0 || (p.state === 2 && p.isNoticeLive)) {
        active.push(p);
        continue;
      }

      // Isolated / other — show in active for visibility
      active.push(p);
    }

    return { active, claimable, refunds, hasLiveNotice };
  }, [drawerProjects]);

  const tabProjects = activeTab === 'active' ? active : activeTab === 'claimable' ? claimable : refunds;

  if (pathname === '/admin') return null;

  return (
    <>
      <nav className="sticky top-0 z-50 w-full border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg font-black text-white tracking-tighter">
              Merit<span className="text-blue-500">X</span>
            </Link>
            <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono">
              <Link href="/" className={`px-3 py-1.5 rounded-md transition-colors ${pathname === '/' ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-500 hover:text-zinc-300'}`}>
                Agent Directory
              </Link>
              <Link href="/launch" className={`px-3 py-1.5 rounded-md transition-colors ${pathname === '/launch' ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-500 hover:text-zinc-300'}`}>
                Agent Tokenization
              </Link>
              {/* Whitepaper link — hidden for stealth mode, restore for Mainnet
              <Link href="/whitepaper" className={`px-3 py-1.5 rounded-md transition-colors ${pathname === '/whitepaper' ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-500 hover:text-zinc-300'}`}>
                Whitepaper
              </Link>
              */}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-[9px] text-zinc-600 font-mono tracking-wider">{CHAIN_NAME}</span>
            {account ? (
              <button onClick={openDrawer} className="group flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:border-blue-500/40 transition-all text-xs font-mono">
                {hasLiveNotice && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />}
                {!hasLiveNotice && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                <span className="text-zinc-400 group-hover:text-white transition-colors">{account.slice(0, 6)}...{account.slice(-4)}</span>
              </button>
            ) : (
              <button onClick={connectWallet} className="px-4 py-1.5 rounded-lg border border-blue-500/40 text-blue-400 text-xs font-bold hover:bg-blue-600 hover:text-white transition-all animate-[pulseGlow_2s_ease-in-out_infinite] shadow-[0_0_8px_rgba(59,130,246,0.3)]">
                Connect &amp; Verify PoHG
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ---- Smart Wallet Drawer ---- */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            key="drawer-root"
            className="fixed inset-0 z-[100]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
            />

            {/* Drawer panel */}
            <motion.div
              className="absolute right-0 top-0 h-full w-full max-w-[420px] z-[1] bg-zinc-950 border-l border-zinc-800/80 shadow-[0_0_80px_rgba(0,0,0,0.6)] flex flex-col"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-5 pb-4 border-b border-zinc-800/60 shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-black text-white tracking-tight">My Backed Agents</h2>
                    <p className="text-[10px] text-zinc-600 font-mono mt-0.5">{CHAIN_NAME}</p>
                  </div>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white hover:border-zinc-600 transition-all"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>

                {/* Operator Identity */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/20 flex items-center justify-center">
                    <span className="text-blue-400 font-black text-sm">{account ? account.slice(2, 4).toUpperCase() : '--'}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-mono text-zinc-300 truncate">{truncAddr(account, 10, 6)}</p>
                    {hasLiveNotice && (
                      <p className="flex items-center gap-1 text-[9px] font-bold text-cyan-400 uppercase tracking-widest mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        Live T-Minus Active
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={switchWallet}
                      className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-blue-400 hover:border-blue-500/30 transition-all"
                      title="Switch Wallet"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M4 4l17 17"/></svg>
                    </button>
                    <button
                      onClick={disconnectWallet}
                      className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-red-400 hover:border-red-500/30 transition-all"
                      title="Disconnect"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="px-5 pt-4 pb-2 shrink-0">
                <div className="flex gap-1 p-1 bg-zinc-900/60 border border-zinc-800/60 rounded-xl">
                  <TabBtn label="Active" count={active.length} active={activeTab === 'active'} live={hasLiveNotice} onClick={() => setActiveTab('active')} />
                  <TabBtn label="Claimable" count={claimable.length} active={activeTab === 'claimable'} onClick={() => setActiveTab('claimable')} />
                  <TabBtn label="Refunds" count={refunds.length} active={activeTab === 'refunds'} onClick={() => setActiveTab('refunds')} />
                </div>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto px-5 min-h-0">
                {drawerLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <span className="w-5 h-5 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
                    <span className="text-zinc-600 text-[10px] font-mono tracking-wider">Scanning on-chain state...</span>
                  </div>
                ) : tabProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                      <span className="text-zinc-700 text-xl">
                        {activeTab === 'claimable' ? '\u2728' : activeTab === 'refunds' ? '\u21A9' : '\u2014'}
                      </span>
                    </div>
                    <p className="text-zinc-600 text-xs font-mono text-center">
                      {activeTab === 'active' && 'No backed agents found'}
                      {activeTab === 'claimable' && 'No agent tokens to claim yet'}
                      {activeTab === 'refunds' && 'No refunds available'}
                    </p>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    <div className="divide-y divide-zinc-800/40">
                      {tabProjects.map((p) => (
                        <DrawerCard
                          key={p.address}
                          p={p}
                          actionAddr={actionAddr}
                          onClaim={handleClaim}
                          onRefund={handleRefund}
                        />
                      ))}
                    </div>
                  </AnimatePresence>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-zinc-800/60 shrink-0">
                <Link
                  href="/portfolio"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:border-zinc-600 transition-all"
                >
                  Open Full Agent Portfolio
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
