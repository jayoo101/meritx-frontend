'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import {
  ExternalLink, Clock, Shield, Rocket, Megaphone,
  Wallet, Timer, AlertTriangle, CheckCircle2,
  Globe, Twitter, Send,
} from 'lucide-react';
import { CHAIN_ID, MAX_INVEST_ETH, EXPLORER_URL } from '@/lib/constants';
import { useNetwork } from '@/lib/useNetwork';
import { useWallet } from '@/hooks/useWallet';
import { useFundData } from '@/hooks/useFundData';
import { useUserContribution } from '@/hooks/useUserContribution';
import { useCountdown } from '@/hooks/useCountdown';
import { fmtEth, truncAddr } from '@/lib/fmt';
import { FUND_ABI } from '@/lib/abis';
import { requireWallet, getSignerContract, handleTxError } from '@/lib/web3';
import InflationStats from '@/components/InflationStats';
import IpfsImage from '@/components/IpfsImage';

export default function InvestPage() {
  const params = useParams();
  const address = params?.address;

  const { account, connectWallet } = useWallet();
  const { project, loadError, isLoading, refresh: refreshFund } = useFundData(address);
  const { contribution: myContribution, refresh: refreshContribution } = useUserContribution(address, account);

  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState('');
  const [investSuccess, setInvestSuccess] = useState(false);
  const [investError, setInvestError] = useState('');
  const [isRefunding, setIsRefunding] = useState(false);
  const [isClaimingTokens, setIsClaimingTokens] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  // [AUDIT FIX] M3: Track pending timeouts for cleanup on unmount
  const pendingTimers = useRef([]);

  useEffect(() => {
    setIsMounted(true);
    return () => { pendingTimers.current.forEach(clearTimeout); };
  }, []);

  const { isCorrectChain } = useNetwork();
  const maxInvest = Number(MAX_INVEST_ETH);
  const amountNum = Number(amount) || 0;
  const remaining = Math.max(maxInvest - myContribution, 0);
  const maxReached = myContribution >= maxInvest;
  const isOverMax = maxReached || (amountNum + myContribution) > maxInvest;

  // 24h Crucible countdown (raise end time)
  const { countdown, isEnded, isCritical } = useCountdown(
    project?.endTime,
    !!project && project.state === 0
  );

  // 6h deployment notice countdown
  const { countdown: launchCountdown } = useCountdown(
    project?.noticeEndMs,
    !!(project?.noticeEndMs && project.noticeEndMs > 0)
  );

  const refreshAll = useCallback(() => {
    refreshFund();
    refreshContribution();
  }, [refreshFund, refreshContribution]);

  const connectWalletWithToast = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      toast.error('Please install MetaMask');
      return;
    }
    try {
      await connectWallet();
    } catch (err) {
      // [AUDIT FIX] M1: Suppress toast on user rejection
      if (err?.code !== 4001 && err?.code !== 'ACTION_REJECTED') toast.error('Wallet connection failed');
    }
  }, [connectWallet]);

  const handleInvest = useCallback(async () => {
    const inputAmt = Number(amount) || 0;
    const currentTotal = Number(myContribution) || 0;
    const limit = Number(MAX_INVEST_ETH);

    if (inputAmt <= 0 || (inputAmt + currentTotal) > limit) {
      setInvestError(inputAmt <= 0 ? 'Enter a valid ETH amount' : `Blocked: ${inputAmt} + ${currentTotal} = ${(inputAmt + currentTotal).toFixed(4)} ETH exceeds ${limit} ETH limit`);
      return;
    }
    if (!requireWallet() || !account) { setInvestError('Wallet not connected.'); return; }
    if (!isCorrectChain) {
      toast.error('Wrong network — switch to Base Sepolia first.');
      return;
    }

    setIsProcessing(true);
    setInvestSuccess(false);
    setInvestError('');

    try {
      const { signer, contract: fundContract } = getSignerContract(address, FUND_ABI);
      const userAddress = await signer.getAddress();

      const currentContribution = await fundContract.contributions(userAddress);
      const investWei = ethers.utils.parseEther(amount);
      const newTotal = ethers.BigNumber.from(currentContribution).add(investWei);
      const onChainLimit = ethers.utils.parseEther(MAX_INVEST_ETH);

      if (newTotal.gt(onChainLimit)) {
        const alreadyEth = ethers.utils.formatEther(currentContribution);
        setInvestError(`On-chain limit enforced: you have already contributed ${alreadyEth} ETH. This would exceed ${MAX_INVEST_ETH} ETH.`);
        setIsProcessing(false);
        refreshContribution();
        return;
      }

      setProcessStatus('Verifying Human Identity via PoHG...');
      const sigRes = await fetch('/api/sign-allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress, fundAddress: address }),
      });
      const sigData = await sigRes.json();
      if (!sigData.success) {
        const msg = sigRes.status === 429 ? `PoHG cooldown active: ${sigData.error || 'Try again later.'}` : (sigData.error || 'Signature request failed');
        setInvestError(msg);
        toast.error(msg);
        setIsProcessing(false);
        setProcessStatus('');
        return;
      }

      const { signature, maxAllocation } = sigData.data;
      setProcessStatus('Confirm in wallet...');
      const tx = await fundContract.contribute(maxAllocation, signature, { value: investWei, gasLimit: 350000 });
      setProcessStatus('Waiting for block confirmation...');
      toast('Transaction pending...', { icon: '\u23F3' });
      await tx.wait();

      setProcessStatus('Sponsorship confirmed!');
      toast.success('Compute sponsorship confirmed on-chain!');
      setInvestSuccess(true);
      setAmount('');
      refreshAll();
      // [AUDIT FIX] M3: Track timer for cleanup
      pendingTimers.current.push(setTimeout(() => {
        setInvestSuccess(false);
        setProcessStatus('');
      }, 3000));
    } catch (err) {
      setProcessStatus('');
      setInvestError(handleTxError(err, { showToast: false }));
      pendingTimers.current.push(setTimeout(() => setInvestError(''), 5000));
    } finally {
      setIsProcessing(false);
    }
  }, [address, account, amount, myContribution, isCorrectChain, refreshAll, refreshContribution]);

  const handleRefund = useCallback(async () => {
    if (!requireWallet() || !account) return;
    if (!isCorrectChain) { toast.error('Wrong network — switch to Base Sepolia first.'); return; }
    setIsRefunding(true);
    try {
      const { contract } = getSignerContract(address, FUND_ABI);
      const tx = await contract.claimRefund();
      toast('Processing refund...', { icon: '\u23F3' });
      await tx.wait();
      toast.success('Refund claimed successfully!');
      refreshAll();
    } catch (err) {
      handleTxError(err);
    } finally {
      setIsRefunding(false);
    }
  }, [address, account, isCorrectChain, refreshAll]);

  const handleClaimTokens = useCallback(async () => {
    if (!requireWallet() || !account) return;
    if (!isCorrectChain) { toast.error('Wrong network — switch to Base Sepolia first.'); return; }
    setIsClaimingTokens(true);
    try {
      const { contract } = getSignerContract(address, FUND_ABI);
      const tx = await contract.claimTokens();
      toast('Claiming agent tokens...', { icon: '\u23F3' });
      await tx.wait();
      toast.success('Agent tokens claimed successfully!');
      refreshAll();
    } catch (err) {
      handleTxError(err);
    } finally {
      setIsClaimingTokens(false);
    }
  }, [address, account, isCorrectChain, refreshAll]);

  const handleAnnounce = useCallback(async () => {
    if (!requireWallet() || !account) return;
    if (!isCorrectChain) { toast.error('Wrong network — switch to Base Sepolia first.'); return; }
    setIsAnnouncing(true);
    try {
      const { contract } = getSignerContract(address, FUND_ABI);
      const tx = await contract.announceLaunch();
      toast('Announcing launch...', { icon: '\u23F3' });
      await tx.wait();
      toast.success('Deployment notice initiated! 6-hour countdown has begun.');
      refreshAll();
    } catch (err) {
      handleTxError(err);
    } finally {
      setIsAnnouncing(false);
    }
  }, [address, account, isCorrectChain, refreshAll]);

  const handleLaunch = useCallback(async () => {
    if (!requireWallet() || !account) return;
    if (!isCorrectChain) { toast.error('Wrong network — switch to Base Sepolia first.'); return; }
    setIsLaunching(true);
    try {
      const { contract } = getSignerContract(address, FUND_ABI);
      let gasLimit = 3_500_000;
      try {
        const estimated = await contract.estimateGas.finalizeFunding();
        gasLimit = estimated.mul(130).div(100).toNumber();
        if (gasLimit < 3_500_000) gasLimit = 3_500_000;
      } catch { /* estimation failed — use safe default */ }
      const tx = await contract.finalizeFunding({ gasLimit });
      toast('Deploying agent: creating Uniswap V3 pool + locking LP...', { icon: '\u23F3' });
      await tx.wait();
      toast.success('Agent deployed! Pool created, LP locked permanently.');
      refreshAll();
    } catch (err) {
      const reason = err?.reason || err?.error?.reason || err?.data?.message || err?.message || '';
      const isGas = /gas|out of gas|intrinsic|UNPREDICTABLE_GAS_LIMIT/i.test(reason) || err?.code === 'UNPREDICTABLE_GAS_LIMIT';
      if (err?.code === 'ACTION_REJECTED' || err?.code === 4001) {
        toast.error('Transaction cancelled by user.');
      } else if (isGas) {
        toast.error('Transaction failed — gas limit too low. Try again.');
      } else {
        handleTxError(err);
      }
    } finally {
      setIsLaunching(false);
    }
  }, [address, account, isCorrectChain, refreshAll]);

  // ─── Validation: invalid address ───
  if (address && !ethers.utils.isAddress(address)) {
    return (
      <div className="min-h-screen text-white font-sans" style={{ background: '#050505' }}>
        <main className="max-w-2xl mx-auto py-20 px-4">
          <div className="rounded-2xl border border-red-500/30 bg-red-950/30 backdrop-blur-sm p-8 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-4" />
            <p className="text-sm font-mono font-bold text-red-400 uppercase tracking-wider mb-2">Invalid Project Address</p>
            <a href="/" className="inline-block text-xs font-semibold text-blue-400 border border-blue-400/30 rounded-full px-5 py-2 hover:bg-blue-400/10 transition-colors mt-4">
              Return to Agent Directory
            </a>
          </div>
        </main>
      </div>
    );
  }

  // ─── Error state ───
  if (loadError) {
    const errMsg = loadError?.message?.includes('rate') || loadError?.message?.includes('429')
      ? 'RPC rate limit reached — please wait and refresh.'
      : loadError?.message || 'Failed to fetch on-chain project data';
    return (
      <div className="min-h-screen text-white font-sans" style={{ background: '#050505' }}>
        <main className="max-w-2xl mx-auto py-20 px-4">
          <div className="rounded-2xl border border-red-500/30 bg-red-950/30 backdrop-blur-sm p-8 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-4" />
            <p className="text-sm font-mono font-bold text-red-400 uppercase tracking-wider mb-2">{errMsg}</p>
            <p className="text-xs text-zinc-500 font-mono mb-6">{address ? `Address: ${truncAddr(address)}` : 'No address provided'}</p>
            <a href="/" className="inline-block text-xs font-semibold text-blue-400 border border-blue-400/30 rounded-full px-5 py-2 hover:bg-blue-400/10 transition-colors">
              Return to Agent Directory
            </a>
          </div>
        </main>
      </div>
    );
  }

  // ─── Loading skeleton ───
  if (isLoading || !project) {
    return (
      <div className="min-h-screen text-zinc-300 font-sans" style={{ background: '#050505' }}>
        <main className="max-w-7xl mx-auto py-12 px-4 md:px-6 lg:px-8">
          <InvestPageSkeleton address={address} />
        </main>
      </div>
    );
  }

  const projectInitial = (project.name || project.symbol || '?').charAt(0).toUpperCase();
  const raisedNum = Number(project.raised);
  const capNum = Number(project.softCap);
  const progressPct = capNum > 0 ? Math.min((raisedNum / capNum) * 100, 100) : 0;
  const canInvest = project.state === 0;
  const now = isMounted ? Date.now() : 0;
  const isExpiredIsolated = project.state === 2 && now > (project.launchDeadline || Infinity);
  const isOwner = account && project.projectOwner && account.toLowerCase() === project.projectOwner.toLowerCase();
  const isAnnounced = project.announcementTime > 0;
  const noticeElapsed = isAnnounced && now >= (project.noticeEndMs || 0);
  const isLaunchExpired = isAnnounced && noticeElapsed && project.launchExpirationMs > 0 && now > project.launchExpirationMs;
  const ownerCanLaunch = isOwner && project.state === 2 && !isExpiredIsolated && !isLaunchExpired;
  const investDisabled = !canInvest || isProcessing || !account || isOverMax || maxReached || !isCorrectChain;

  const stateBanner = getStateBanner(project.state, isAnnounced, noticeElapsed, isLaunchExpired, isExpiredIsolated);

  return (
    <div className="min-h-screen text-zinc-300 font-sans selection:bg-blue-600/30" style={{ background: '#050505' }}>
      <main className="max-w-7xl mx-auto py-12 px-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ═══════════ LEFT COLUMN — Agent Info & Metrics (2/3) ═══════════ */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 backdrop-blur-md p-6">
              <div className="flex items-start gap-5">
                <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-xl bg-black border border-zinc-800 flex items-center justify-center shrink-0 shadow-inner overflow-hidden">
                  <InvestAvatar src={project.avatarUrl} fallback={projectInitial} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-[11px] font-mono font-bold text-blue-400">
                      ${project.symbol}
                    </span>
                    <h1 className="text-2xl md:text-3xl font-black text-white truncate">{project.name}</h1>
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {project.socials?.twitter && (
                      <a href={project.socials.twitter} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-zinc-900/80 border border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-blue-400 hover:border-blue-500/50 transition-colors" title="Twitter / X">
                        <Twitter className="w-4 h-4" />
                      </a>
                    )}
                    {project.socials?.telegram && (
                      <a href={project.socials.telegram} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-zinc-900/80 border border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-blue-400 hover:border-blue-500/50 transition-colors" title="Telegram">
                        <Send className="w-4 h-4" />
                      </a>
                    )}
                    {project.socials?.website && (
                      <a href={project.socials.website} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-zinc-900/80 border border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-blue-400 hover:border-blue-500/50 transition-colors" title="Website">
                        <Globe className="w-4 h-4" />
                      </a>
                    )}
                    <a href={`${EXPLORER_URL}/address/${address}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-700 text-[10px] font-mono text-zinc-500 hover:text-blue-400 hover:border-blue-500/50 transition-colors group">
                      <span>Contract</span>
                      <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                    </a>
                  </div>
                </div>
              </div>
              {project.description && (
                <p className="mt-4 text-sm text-zinc-400 leading-relaxed">{project.description}</p>
              )}
            </div>

            <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${stateBanner.classes} ${stateBanner.glow}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${stateBanner.dot}`} />
              <span className="text-[11px] font-mono font-bold uppercase tracking-widest">Status: <span>{stateBanner.label}</span></span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <MetricCard label="Total Sponsored" value={`${fmtEth(raisedNum)} ETH`} accent="text-blue-400" />
              <MetricCard label="Soft Cap" value={`${fmtEth(capNum, 0)} ETH`} sub={<span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-[9px] font-bold text-purple-400">No Hard Cap</span>} accent="text-purple-400" />
              <MetricCard label="Compute Backers" value="—" accent="text-zinc-400" sub="Participant count" />
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-4">
              <div className="flex justify-between items-baseline text-sm mb-2.5">
                <span className="text-zinc-400 text-[10px] font-mono uppercase tracking-widest">IAO Progress</span>
                <span className="font-mono tabular-nums text-white font-bold">{progressPct.toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${project.state === 1 ? 'bg-red-500/80' : 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.8)]'}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-[10px] font-mono text-zinc-600">
                <span><span>{fmtEth(raisedNum)}</span> / <span>{fmtEth(capNum, 0)}</span> ETH</span>
                <span>Max per wallet: <span>{MAX_INVEST_ETH}</span> ETH</span>
              </div>
            </div>

            <div className={`rounded-xl border p-4 flex items-center gap-4 ${isEnded || isCritical ? 'border-red-500/30 bg-red-500/[0.04]' : 'border-zinc-800 bg-zinc-900/20'}`}>
              <Timer className={`w-5 h-5 shrink-0 ${isEnded || isCritical ? 'text-red-400' : 'text-zinc-500'}`} />
              <div className="flex-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-0.5 font-mono">
                  {isEnded ? 'Crucible Ended' : '24h Crucible — Closes In'}
                </div>
                <div className={`font-mono tabular-nums font-black text-xl tracking-wider ${isEnded || isCritical ? 'text-red-500' : 'text-white'}`}>
                  <span>{countdown}</span>
                </div>
              </div>
              {!isEnded && (
                <span className="flex items-center gap-1.5 text-[9px] text-blue-500/70 font-mono shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> LIVE
                </span>
              )}
            </div>

            {isAnnounced && project.state === 2 && !isExpiredIsolated && (
              <div key="tminus-banner">
                <TMinusBanner
                isLaunchExpired={isLaunchExpired}
                noticeElapsed={noticeElapsed}
                launchCountdown={launchCountdown}
              />
              </div>
            )}

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 backdrop-blur-md p-6">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400 mb-4 font-mono">
                &gt; Agent Skillset &amp; A2A Integration
              </h2>
              <div className="text-zinc-400 text-sm leading-relaxed space-y-3 font-mono">
                {project.description ? (
                  <p>{project.description}</p>
                ) : (
                  <p>This AI Agent is deployed via the MeritX IAO Protocol. All compute sponsorship is cryptographically isolated by smart contract. The AI Developer starts with zero tokens.</p>
                )}
                <p>After the IAO target is met, agent token distribution begins proportional to each sponsor&apos;s contribution. Agent skillset &amp; A2A (Agent-to-Agent) integration endpoints are defined in the agent&apos;s genesis manifesto.</p>
                {project.skillEndpoint && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-500/[0.06] border border-blue-500/20">
                    <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <a href={project.skillEndpoint} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs font-mono truncate hover:underline">{project.skillEndpoint}</a>
                  </div>
                )}
              </div>
            </div>

            {project.state >= 2 && (
              <div key="inflation-stats">
                <InflationStats fundAddress={address} />
              </div>
            )}
          </div>

          {/* ═══════════ RIGHT COLUMN — Action Terminal (1/3, sticky) ═══════════ */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-6 shadow-2xl shadow-blue-900/10 backdrop-blur-md">
                <ActionTerminal
                  project={project}
                  account={account}
                  myContribution={myContribution}
                  amount={amount}
                  setAmount={setAmount}
                  remaining={remaining}
                  maxReached={maxReached}
                  isOverMax={isOverMax}
                  maxInvest={maxInvest}
                  investDisabled={investDisabled}
                  isProcessing={isProcessing}
                  processStatus={processStatus}
                  investSuccess={investSuccess}
                  investError={investError}
                  canInvest={canInvest}
                  isRefunding={isRefunding}
                  isClaimingTokens={isClaimingTokens}
                  isAnnouncing={isAnnouncing}
                  isLaunching={isLaunching}
                  isCorrectChain={isCorrectChain}
                  isExpiredIsolated={isExpiredIsolated}
                  isLaunchExpired={isLaunchExpired}
                  ownerCanLaunch={ownerCanLaunch}
                  isAnnounced={isAnnounced}
                  noticeElapsed={noticeElapsed}
                  launchCountdown={launchCountdown}
                  raisedNum={raisedNum}
                  connectWallet={connectWalletWithToast}
                  handleInvest={handleInvest}
                  handleRefund={handleRefund}
                  handleClaimTokens={handleClaimTokens}
                  handleAnnounce={handleAnnounce}
                  handleLaunch={handleLaunch}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function InvestAvatar({ src, fallback }) {
  return (
    <IpfsImage
      src={src}
      alt={`${fallback} avatar`}
      fallback={<span className="text-4xl md:text-5xl font-black text-blue-500">{fallback}</span>}
    />
  );
}

function InvestPageSkeleton({ address }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-6 animate-pulse">
          <div className="flex items-start gap-5">
            <div className="w-20 h-20 rounded-xl bg-zinc-800" />
            <div className="flex-1 space-y-3">
              <div className="h-6 w-24 bg-zinc-800 rounded" />
              <div className="h-8 w-48 bg-zinc-800 rounded" />
              <div className="flex gap-2 mt-2">
                <div className="w-9 h-9 bg-zinc-800 rounded-lg" />
                <div className="w-9 h-9 bg-zinc-800 rounded-lg" />
                <div className="h-9 w-20 bg-zinc-800 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
        <div className="h-14 rounded-xl bg-zinc-900/40 border border-zinc-800 animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-4 animate-pulse">
              <div className="h-3 w-20 bg-zinc-800 rounded mb-2" />
              <div className="h-6 w-16 bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-4 animate-pulse">
          <div className="flex justify-between mb-2">
            <div className="h-3 w-24 bg-zinc-800 rounded" />
            <div className="h-4 w-12 bg-zinc-800 rounded" />
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded-full" />
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-4 flex items-center gap-4">
          <div className="w-5 h-5 bg-zinc-800 rounded" />
          <div className="flex-1">
            <div className="h-3 w-32 bg-zinc-800 rounded mb-2" />
            <div className="h-6 w-24 bg-zinc-800 rounded" />
          </div>
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
        </div>
      </div>
      <div className="lg:col-span-1">
        <div className="sticky top-24 rounded-2xl border border-zinc-800 bg-zinc-900/20 p-6 animate-pulse">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-5 h-5 bg-zinc-800 rounded" />
            <div>
              <div className="h-4 w-28 bg-zinc-800 rounded mb-1" />
              <div className="h-3 w-36 bg-zinc-800 rounded" />
            </div>
          </div>
          <div className="h-12 w-full bg-zinc-800 rounded-xl mb-4" />
          <div className="h-12 w-full bg-zinc-800 rounded-xl" />
          <p className="text-center text-zinc-600 text-xs font-mono mt-4">Loading IAO data for <span>{truncAddr(address) || '—'}</span>...</p>
        </div>
      </div>
    </div>
  );
}

function getStateBanner(state, isAnnounced, noticeElapsed, isLaunchExpired, isExpiredIsolated) {
  if (state === 0) return { label: 'IAO Funding Active', classes: 'bg-blue-500/10 border-blue-500/30 text-blue-400', dot: 'bg-blue-500 animate-pulse', glow: 'shadow-[0_0_20px_rgba(37,99,235,0.15)]' };
  if (state === 1) return { label: 'IAO Failed — Refunding', classes: 'bg-red-500/10 border-red-500/30 text-red-400', dot: 'bg-red-500', glow: '' };
  if (state >= 3) return { label: 'Agent Active — DEX Live', classes: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', dot: 'bg-emerald-500', glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]' };
  if (isLaunchExpired) return { label: 'Deployment Expired', classes: 'bg-red-500/10 border-red-500/30 text-red-400', dot: 'bg-red-500', glow: '' };
  if (isExpiredIsolated) return { label: 'Window Expired', classes: 'bg-amber-500/10 border-amber-500/30 text-amber-400', dot: 'bg-amber-500', glow: '' };
  if (isAnnounced && noticeElapsed) return { label: 'Ready to Deploy', classes: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', dot: 'bg-emerald-500 animate-pulse', glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]' };
  if (isAnnounced) return { label: '6h Deployment Notice Active', classes: 'bg-blue-500/10 border-blue-500/30 text-blue-400', dot: 'bg-blue-500 animate-pulse', glow: 'shadow-[0_0_20px_rgba(37,99,235,0.15)]' };
  return { label: 'Strategic Preparation', classes: 'bg-purple-500/10 border-purple-500/30 text-purple-400', dot: 'bg-purple-500', glow: 'shadow-[0_0_20px_rgba(168,85,247,0.15)]' };
}

function MetricCard({ label, value, accent, sub }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-4 space-y-1">
      <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold font-mono">{label}</p>
      <p className={`text-xl font-black font-mono tabular-nums ${accent}`}>{value}</p>
      {sub}
    </div>
  );
}

function TMinusBanner({ isLaunchExpired, noticeElapsed, launchCountdown }) {
  const isRed = isLaunchExpired;
  const isGreen = noticeElapsed && !isLaunchExpired;
  return (
    <div className={`rounded-xl border p-4 ${isRed ? 'bg-red-500/[0.04] border-red-500/20' : isGreen ? 'bg-emerald-500/[0.04] border-emerald-500/20' : 'bg-blue-500/[0.04] border-blue-500/20'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[10px] font-bold uppercase tracking-widest font-mono ${isRed ? 'text-red-400' : isGreen ? 'text-emerald-400' : 'text-blue-400'}`}>
          {isLaunchExpired ? 'Deployment Expired — 24h Window Closed' : noticeElapsed ? 'Notice Complete — Deployment Ready' : 'T-Minus — Agent Deployment In'}
        </span>
        <Megaphone className={`w-4 h-4 ${isRed ? 'text-red-400/50' : isGreen ? 'text-emerald-400/50' : 'text-blue-400/50'}`} />
      </div>
      <div className={`font-mono tabular-nums font-black text-2xl tracking-wider ${isRed ? 'text-red-400' : isGreen ? 'text-emerald-400' : 'text-blue-400'}`}>
        {isLaunchExpired ? '00:00:00' : launchCountdown || '--:--:--'}
      </div>
      <div className="text-[10px] text-zinc-500 font-mono mt-1.5">
        {isLaunchExpired
          ? 'AI Developer failed to deploy within 24h. Sponsors may claim full refunds.'
          : noticeElapsed
            ? 'The 6-hour notice period has passed. Agent liquidity can now be deployed.'
            : 'AI Developer initiated deployment notice. All sponsors have advance notice.'}
      </div>
    </div>
  );
}

function ActionTerminal({
  project, account, myContribution, amount, setAmount,
  remaining, maxReached, isOverMax, maxInvest,
  investDisabled, isProcessing, processStatus, investSuccess, investError, canInvest,
  isRefunding, isClaimingTokens, isAnnouncing, isLaunching, isCorrectChain,
  isExpiredIsolated, isLaunchExpired, ownerCanLaunch, isAnnounced, noticeElapsed,
  launchCountdown, raisedNum,
  connectWallet, handleInvest, handleRefund, handleClaimTokens, handleAnnounce, handleLaunch,
}) {
  if (project.state === 1) {
    return (
      <div key="action-state-failed">
        <RefundPanel
        title="IAO FAILED"
        subtitle="SOFT CAP NOT REACHED"
        description="The IAO soft cap was not reached within the funding window."
        variant="red"
        account={account}
        myContribution={myContribution}
        isRefunding={isRefunding}
        handleRefund={handleRefund}
        connectWallet={connectWallet}
      />
      </div>
    );
  }

  if (isExpiredIsolated) {
    return (
      <div key="action-state-expired-isolated">
        <RefundPanel
        title="WINDOW EXPIRED"
        subtitle="30-DAY DEADLINE PASSED"
        description="AI Developer failed to deploy within 30 days. Your funds are eligible for a 100% refund."
        variant="amber"
        account={account}
        myContribution={myContribution}
        isRefunding={isRefunding}
        handleRefund={handleRefund}
        connectWallet={connectWallet}
      />
      </div>
    );
  }

  if (isLaunchExpired && project.state === 2) {
    return (
      <div key="action-state-deployment-expired">
        <RefundPanel
        title="DEPLOYMENT EXPIRED"
        subtitle="24H EXECUTION WINDOW CLOSED"
        description="The AI Developer announced but failed to deploy liquidity within the 24-hour execution window."
        variant="red"
        account={account}
        myContribution={myContribution}
        isRefunding={isRefunding}
        handleRefund={handleRefund}
        connectWallet={connectWallet}
      />
      </div>
    );
  }

  if (ownerCanLaunch) {
    return (
      <div key="action-state-owner-launch" className="space-y-5">
        <div className="flex items-center gap-3">
          <Rocket className={`w-5 h-5 ${!isAnnounced ? 'text-blue-400' : noticeElapsed ? 'text-emerald-400' : 'text-blue-400'}`} />
          <div>
            <h3 className="text-base font-black text-white font-mono">
              {!isAnnounced ? 'Ready to Announce' : noticeElapsed ? 'Ready to Deploy' : 'Deployment Notice Active'}
            </h3>
            <p className="text-[10px] text-zinc-500 font-mono uppercase">
              {!isAnnounced ? 'Strategic Preparation Phase' : noticeElapsed ? 'Deploy Agent to Uniswap V3' : 'Waiting for 6h notice period'}
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-500/[0.06] border border-amber-500/20">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-300 text-[10px] font-bold uppercase tracking-wider font-mono">
              {!isAnnounced ? 'Anti-Stealth Protocol' : 'Permanent Action'}
            </span>
          </div>
          <p className="text-amber-300/60 text-[11px] font-mono leading-relaxed">
            {!isAnnounced
              ? 'Initiating starts a 6h public deployment notice. All sponsors see a countdown before agent liquidity deploys.'
              : 'This will lock liquidity forever and enable agent token claims. The LP NFT stays inside the contract permanently.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <MiniStat label="Total Raised" value={`${fmtEth(raisedNum)} ETH`} />
          <MiniStat label="Platform Fee" value={`${fmtEth(raisedNum * 0.05)} ETH`} />
        </div>

        {!isAnnounced ? (
          <>
            <ActionBtn onClick={handleAnnounce} disabled={isAnnouncing || !isCorrectChain} loading={isAnnouncing} variant="blue" label="Initiate 6h Deployment Notice" loadingLabel="Broadcasting..." />
            <p className="text-[10px] text-zinc-500 font-mono text-center leading-relaxed">You have up to 30 days to fine-tune models and APIs before initiating the 6-hour deployment notice.</p>
          </>
        ) : noticeElapsed ? (
          <ActionBtn onClick={handleLaunch} disabled={isLaunching || !isCorrectChain} loading={isLaunching} variant="emerald" label="Deploy Agent to Uniswap V3" loadingLabel="Deploying agent..." />
        ) : (
          <div className="w-full py-4 rounded-xl bg-zinc-800/50 text-center">
            <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider font-mono">Waiting for notice</div>
            <div className="text-blue-400 font-mono text-sm mt-1">{launchCountdown || '--:--:--'}</div>
          </div>
        )}
      </div>
    );
  }

  if (project.state === 2) {
    return (
      <div key="action-state-prep" className="space-y-5 text-center">
        <Shield className="w-10 h-10 text-purple-400 mx-auto" />
        <h3 className="text-lg font-black text-white font-mono">Strategic Preparation Phase</h3>
        <p className="text-sm text-zinc-500 font-mono">Funds are cryptographically secured. AI Developer has up to 30 days to fine-tune models and APIs before initiating the 6-hour deployment notice.</p>
        {account && myContribution > 0 && (
          <div className="p-3 rounded-xl bg-blue-500/[0.06] border border-blue-500/20 text-left">
            <div className="text-[10px] text-zinc-500 font-mono uppercase">Your Sponsorship</div>
            <div className="text-blue-400 font-mono font-bold">{fmtEth(myContribution)} ETH</div>
          </div>
        )}
      </div>
    );
  }

  if (project.state >= 3) {
    return (
      <div key="action-state-completed" className="space-y-5 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
        <h3 className="text-lg font-black text-white font-mono">Agent is Live</h3>
        <p className="text-sm text-zinc-500 font-mono">Liquidity deployed. Agent tokens claimable.</p>
        {account && myContribution > 0 && (
          <>
            <div className="p-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 text-left">
              <div className="text-[10px] text-zinc-500 font-mono uppercase">Your Sponsorship</div>
              <div className="text-emerald-400 font-mono font-bold">{fmtEth(myContribution)} ETH</div>
            </div>
            <ActionBtn onClick={handleClaimTokens} disabled={isClaimingTokens} loading={isClaimingTokens} variant="emerald" label="Claim Agent Tokens" loadingLabel="Claiming..." glow />
          </>
        )}
      </div>
    );
  }

  return (
    <div key="action-state-funding" className="space-y-5">
      <div className="flex items-center gap-3">
        <Wallet className="w-5 h-5 text-blue-400" />
        <div>
          <h3 className="text-base font-black text-white font-mono">Sponsor Compute</h3>
          <p className="text-[10px] text-zinc-500 font-mono">Your PoHG Allocation: ~ {MAX_INVEST_ETH} ETH</p>
        </div>
      </div>

      {account && (
        <div className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/40 space-y-1 text-xs font-mono">
          <div className="flex justify-between text-zinc-500">
            <span>Your sponsorship</span>
            <span className={myContribution > 0 ? 'text-blue-400' : 'text-zinc-400'}>{fmtEth(myContribution)} ETH</span>
          </div>
          {myContribution > 0 && !maxReached && (
            <div className="flex justify-between text-zinc-600">
              <span>Remaining</span>
              <span>{fmtEth(remaining)} ETH</span>
            </div>
          )}
          {maxReached && (
            <div className="flex items-center gap-1.5 text-amber-400 pt-1">
              <AlertTriangle className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase">Max allocation reached</span>
            </div>
          )}
        </div>
      )}

      {maxReached ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/20">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-amber-300/80 text-xs font-mono">MAX REACHED — <span>{fmtEth(myContribution)}</span> ETH contributed</span>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider block font-mono">Amount (ETH)</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.001"
              max={remaining}
              disabled={isProcessing || maxReached}
              className={`w-full rounded-xl py-4 pl-4 pr-16 text-2xl font-mono font-bold text-white placeholder:text-zinc-700 bg-black/60 border focus:outline-none focus:ring-1 transition-all disabled:opacity-40 ${
                isOverMax ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20' : 'border-zinc-700 focus:border-blue-500/50 focus:ring-blue-500/20'
              }`}
            />
            <button
              type="button"
              onClick={() => setAmount(String(remaining))}
              disabled={isProcessing}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg border border-zinc-600 bg-zinc-800 text-blue-500 text-[10px] font-bold font-mono uppercase hover:bg-zinc-700 hover:text-blue-400 disabled:opacity-40 transition-colors"
            >
              MAX
            </button>
          </div>
          {isOverMax && (
            <div className="text-red-400 text-[11px] font-mono flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-red-500 shrink-0" />
              Exceeds limit of <span>{MAX_INVEST_ETH}</span> ETH (already contributed <span>{fmtEth(myContribution)}</span> ETH)
            </div>
          )}
        </div>
      )}

      <button
        onClick={investDisabled ? undefined : handleInvest}
        disabled={investDisabled}
        className={[
          'w-full py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all relative overflow-hidden select-none font-mono',
          investDisabled && 'pointer-events-none opacity-60 cursor-not-allowed',
          maxReached || isOverMax ? 'bg-red-500/10 text-red-400 border border-red-500/30'
            : !canInvest ? 'bg-zinc-700 text-zinc-500'
            : isProcessing ? 'bg-blue-600/90 text-white'
            : !account ? 'bg-zinc-700 text-zinc-500'
            : 'text-white bg-blue-600 hover:bg-blue-500 shadow-blue-600/20',
        ].filter(Boolean).join(' ')}
      >
        {isProcessing && <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />}
        <span className="relative z-10">
          {maxReached ? 'MAX ALLOCATION REACHED'
            : isOverMax ? `EXCEEDS ${MAX_INVEST_ETH} ETH LIMIT`
            : isProcessing ? (processStatus || 'Processing...')
            : !canInvest ? 'IAO Closed'
            : !account ? 'Connect wallet'
            : 'Sponsor Compute (ETH)'}
        </span>
      </button>

      {!account && !investError && (
        <button onClick={connectWallet} className="w-full py-3 rounded-xl border border-blue-500/30 text-blue-400 text-xs font-bold font-mono hover:bg-blue-500/10 transition-colors">
          Connect Wallet to Sponsor
        </button>
      )}

      {investSuccess && (
        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-bold text-blue-400 font-mono">Sponsorship confirmed!</span>
          </div>
          <p className="text-xs text-blue-300/60 font-mono">Progress will auto-refresh.</p>
        </div>
      )}

      {investError && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-0.5 font-mono">Transaction Failed</div>
              <div className="text-xs text-red-300/70 font-mono break-all leading-relaxed">{investError}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RefundPanel({ title, subtitle, description, variant, account, myContribution, isRefunding, handleRefund, connectWallet }) {
  const isAmber = variant === 'amber';
  const Icon = isAmber ? Clock : AlertTriangle;
  return (
    <div className="space-y-5 text-center">
      <Icon className={`w-10 h-10 mx-auto ${isAmber ? 'text-amber-400' : 'text-red-400'}`} />
      <h3 className="text-lg font-black text-white font-mono">{title}</h3>
      <p className={`text-[10px] font-mono uppercase tracking-wider ${isAmber ? 'text-amber-400/60' : 'text-red-400/60'}`}>{subtitle}</p>
      <p className="text-sm text-zinc-500 font-mono leading-relaxed">{description}</p>

      {account && myContribution > 0 && (
        <>
          <div className={`p-3 rounded-xl text-left ${isAmber ? 'bg-amber-500/[0.06] border-amber-500/20' : 'bg-red-500/[0.06] border-red-500/20'} border`}>
            <div className="text-[10px] text-zinc-500 font-mono uppercase">Your Sponsorship</div>
            <div className={`font-mono font-bold ${isAmber ? 'text-amber-400' : 'text-red-400'}`}>{fmtEth(myContribution)} ETH — eligible for full refund</div>
          </div>
          <ActionBtn onClick={handleRefund} disabled={isRefunding} loading={isRefunding} variant={isAmber ? 'amber' : 'red'} label="Refund ETH" loadingLabel="Processing..." />
        </>
      )}
      {account && myContribution === 0 && (
        <p className="text-zinc-600 text-xs font-mono">No sponsorship found for this wallet.</p>
      )}
      {!account && (
        <button onClick={connectWallet} className="w-full py-3 rounded-xl border border-blue-500/30 text-blue-400 text-xs font-bold font-mono hover:bg-blue-500/10 transition-colors">
          Connect Wallet
        </button>
      )}
    </div>
  );
}

function ActionBtn({ onClick, disabled, loading, variant, label, loadingLabel, glow }) {
  const variants = {
    blue: 'text-white bg-blue-600 hover:bg-blue-500 shadow-blue-600/20',
    emerald: 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600/30' + (glow ? ' hover:shadow-[0_0_24px_rgba(16,185,129,0.3)]' : ''),
    amber: 'bg-amber-600/20 text-amber-400 border border-amber-500/40 hover:bg-amber-600/30',
    red: 'bg-red-600/20 text-red-400 border border-red-500/40 hover:bg-red-600/30',
  };
  const loadingClasses = {
    blue: 'bg-blue-600/90 text-white',
    emerald: 'bg-emerald-600/90 text-black',
    amber: 'bg-amber-600/90 text-black',
    red: 'bg-red-600/90 text-black',
  };
  const v = variants[variant] || variants.blue;
  const l = loadingClasses[variant] || loadingClasses.blue;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all font-mono ${loading ? `${l} animate-pulse` : v}`}
    >
      {loading ? loadingLabel : label}
    </button>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="p-2.5 rounded-lg bg-black/30 border border-zinc-800/60 text-center">
      <div className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold font-mono">{label}</div>
      <div className="text-sm font-black font-mono text-white mt-0.5">{value}</div>
    </div>
  );
}
