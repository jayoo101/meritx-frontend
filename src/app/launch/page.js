'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { Rocket, FileText, Share2, Shield, ImagePlus, X } from 'lucide-react';
import { FACTORY_ADDRESS, LISTING_FEE_ETH } from '@/lib/constants';
import { useNetwork } from '@/lib/useNetwork';
import { useWallet } from '@/hooks/useWallet';
import { FACTORY_ABI } from '@/lib/abis';
import { getSignerContract } from '@/lib/web3';

const PROTOCOL_RULES = [
  { key: 'fee', label: 'Instantiation Fee', value: '0.01 ETH' },
  { key: 'soft', label: 'Soft Cap', value: '15 ETH (24h limit)' },
  { key: 'hard', label: 'Hard Cap', value: 'No Limit' },
  { key: 'window', label: 'Strategic Window', value: 'Up to 30 Days' },
  { key: 'launch', label: 'Launch Sequence', value: '6h Notice + 24h Window' },
  { key: 'pop', label: 'Compute Subsidy', value: '0.15 PoP Curve' },
  { key: 'pol', label: 'Liquidity', value: '95% Protocol-Owned (POL)' },
];

export default function LaunchPage() {
  const { account, connectWallet } = useWallet();
  const { isCorrectChain } = useNetwork();

  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [skillEndpoint, setSkillEndpoint] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [telegramUrl, setTelegramUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const fileInputRef = useRef(null);
  // [AUDIT FIX] M3: Track pending timeouts for cleanup on unmount
  const pendingTimers = useRef([]);
  useEffect(() => () => { pendingTimers.current.forEach(clearTimeout); }, []);
  const [acknowledged, setAcknowledged] = useState(false);
  // Granular tx lifecycle: idle → uploading_avatar → uploading_meta → confirming_wallet → mining → success
  const [txStatus, setTxStatus] = useState('idle');
  const isLaunching = txStatus !== 'idle' && txStatus !== 'success';

  const handleAvatarChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB');
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }, []);

  const clearAvatar = useCallback(() => {
    setAvatarFile(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [avatarPreview]);

  const isFormComplete = Boolean(name?.trim()) && Boolean(symbol?.trim()) && Boolean(description?.trim());
  const isArmed = Boolean(account) && isFormComplete && acknowledged && !isLaunching && isCorrectChain;

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

  const compressImage = useCallback(async (file, maxWidth = 800, quality = 0.8) => {
    if (!file.type.startsWith('image/') || file.size < 200 * 1024) return file;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => resolve(blob ? new File([blob], file.name, { type: 'image/webp' }) : file),
          'image/webp',
          quality,
        );
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  }, []);

  // [AUDIT FIX] C2: Upload via server-side API route instead of exposing Pinata JWT
  const uploadFileToPinata = useCallback(async (file) => {
    const compressed = await compressImage(file);
    const form = new FormData();
    form.append('file', compressed);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'File upload failed');
    return data.IpfsHash;
  }, [compressImage]);

  const uploadJSONToPinata = useCallback(async (json) => {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: json }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'JSON upload failed');
    return data.IpfsHash;
  }, []);

  const handleLaunch = useCallback(async () => {
    if (!name?.trim()) return toast.error('Agent name required');
    if (!symbol?.trim()) return toast.error('Token symbol required');
    if (!description?.trim()) return toast.error('Agent description required');
    if (!acknowledged) return toast.error('Acknowledge the terms before launching');
    if (typeof window === 'undefined' || !window.ethereum) return toast.error('Wallet not connected.');
    if (!isCorrectChain) return toast.error('Wrong network — switch to Base Sepolia first.');
    // [AUDIT FIX] C2: No client-side JWT check needed — server route handles it

    try {
      let imageCID = '';
      if (avatarFile) {
        setTxStatus('uploading_avatar');
        imageCID = await uploadFileToPinata(avatarFile);
      }

      setTxStatus('uploading_meta');
      const metadata = {
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        description: description.trim(),
        ...(imageCID && { image: `ipfs://${imageCID}` }),
        ...(skillEndpoint?.trim() && { skillEndpoint: skillEndpoint.trim() }),
        socials: {
          ...(twitterUrl?.trim() && { twitter: twitterUrl.trim() }),
          ...(telegramUrl?.trim() && { telegram: telegramUrl.trim() }),
          ...(websiteUrl?.trim() && { website: websiteUrl.trim() }),
        },
      };
      const metadataCID = await uploadJSONToPinata(metadata);
      const ipfsURI = `ipfs://${metadataCID}`;

      setTxStatus('confirming_wallet');
      const { contract: factory } = getSignerContract(FACTORY_ADDRESS, FACTORY_ABI);

      const contractListingFee = await factory.LISTING_FEE();
      const valueWei = ethers.utils.parseEther(LISTING_FEE_ETH);
      if (!contractListingFee.eq(valueWei)) {
        toast.error(`Fee mismatch: contract expects ${ethers.utils.formatEther(contractListingFee)} ETH`);
        setTxStatus('idle');
        return;
      }

      const tx = await factory.launchNewProject(name.trim(), symbol.trim().toUpperCase(), ipfsURI, {
        value: valueWei,
      });

      setTxStatus('mining');
      await tx.wait();

      setTxStatus('success');
      toast.success(`Agent initialized! ${name} ($${symbol}) is now on-chain`);
      setName('');
      setSymbol('');
      setDescription('');
      setTwitterUrl('');
      setTelegramUrl('');
      setWebsiteUrl('');
      setSkillEndpoint('');
      clearAvatar();
      setAcknowledged(false);
      pendingTimers.current.push(setTimeout(() => setTxStatus('idle'), 4000)); // [AUDIT FIX] M3
    } catch (err) {
      setTxStatus('idle');
      if (err?.code === 'ACTION_REJECTED' || err?.code === 4001) {
        toast.error('Transaction cancelled by user.');
      } else {
        const msg = err?.reason ?? err?.data?.message ?? err?.message ?? 'Unknown error';
        if (String(msg).includes('!fee')) {
          toast.error('Fee mismatch: contract requires exactly 0.01 ETH. Please refresh and try again.');
        } else {
          toast.error(`Initialization failed: ${msg}`);
        }
      }
    }
  }, [name, symbol, description, acknowledged, isCorrectChain, avatarFile, skillEndpoint, twitterUrl, telegramUrl, websiteUrl, clearAvatar, uploadFileToPinata, uploadJSONToPinata]);

  const inputBase = `w-full py-3.5 px-4 rounded-xl font-mono text-sm text-white placeholder:text-zinc-600 bg-black/50 border border-zinc-700 focus:outline-none focus:ring-1 focus:border-blue-500 focus:ring-blue-500/20 transition-colors ${isLaunching ? 'opacity-50 pointer-events-none' : ''}`;

  return (
    <div className="min-h-screen font-sans selection:bg-blue-600/30 text-zinc-300" style={{ background: '#050505' }}>
      <main className="max-w-7xl mx-auto py-12 px-4 md:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 border-b border-zinc-800 pb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">BASE L2</span>
            <span className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest">Genesis Console</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-2">
            Initialize Agent Offering <span className="text-blue-500">(IAO)</span>
          </h1>
          <p className="text-zinc-500 text-sm max-w-2xl leading-relaxed">
            Deploy your Autonomous AI Agent to the Base L2 settlement network. Powered by the Price-of-Proof consensus.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ═══════════ LEFT COLUMN — Form (2/3) ═══════════ */}
          <div className="lg:col-span-2 space-y-6">
            {/* Card 1: Agent Identity */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
              <div className="flex items-center gap-2 mb-5">
                <Rocket className="w-5 h-5 text-blue-400" />
                <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Agent Identity</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Agent Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. QuantMind"
                    className={inputBase}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Ticker (Symbol)</label>
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="e.g. QMT"
                    className={`${inputBase} uppercase`}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Avatar Image</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  {avatarPreview ? (
                    <div className="relative w-24 h-24 group">
                      <img src={avatarPreview} alt="Avatar preview" className="w-24 h-24 rounded-xl object-cover border border-zinc-700" />
                      <button
                        type="button"
                        onClick={clearAvatar}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-24 h-24 rounded-xl border border-dashed border-zinc-700 bg-black/30 flex flex-col items-center justify-center gap-1.5 text-zinc-500 hover:text-zinc-400 hover:border-zinc-500 transition-colors"
                    >
                      <ImagePlus className="w-6 h-6" />
                      <span className="text-[9px] font-mono">Upload</span>
                    </button>
                  )}
                  <p className="mt-1.5 text-[10px] text-zinc-600 font-mono">Optional — max 5 MB, pinned to IPFS via Pinata</p>
                </div>
              </div>
            </div>

            {/* Card 2: Utility & Skills */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
              <div className="flex items-center gap-2 mb-5">
                <FileText className="w-5 h-5 text-blue-400" />
                <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Utility & Skills</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Agent Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe this agent's autonomous capabilities and economic model..."
                    rows={5}
                    className={`${inputBase} resize-y min-h-[120px]`}
                  />
                  <p className="mt-1.5 text-[10px] text-zinc-600 font-mono">Stored as IPFS metadata — referenced on-chain via ipfsURI</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Model API Endpoint / Docs URL</label>
                  <input
                    type="url"
                    value={skillEndpoint}
                    onChange={(e) => setSkillEndpoint(e.target.value)}
                    placeholder="https://api.agent.ai/v1/skill or docs URL"
                    className={inputBase}
                    autoComplete="off"
                  />
                  <p className="mt-1.5 text-[10px] text-zinc-600 font-mono">Optional — URI for A2A protocol calls</p>
                </div>
              </div>
            </div>

            {/* Card 3: Social Graph */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
              <div className="flex items-center gap-2 mb-5">
                <Share2 className="w-5 h-5 text-blue-400" />
                <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Social Graph</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Twitter (X)</label>
                  <input
                    type="url"
                    value={twitterUrl}
                    onChange={(e) => setTwitterUrl(e.target.value)}
                    placeholder="https://x.com/..."
                    className={inputBase}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Telegram</label>
                  <input
                    type="url"
                    value={telegramUrl}
                    onChange={(e) => setTelegramUrl(e.target.value)}
                    placeholder="https://t.me/..."
                    className={inputBase}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Website</label>
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://..."
                    className={inputBase}
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>

            {/* Acknowledgement */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border border-zinc-600 bg-black/50 accent-amber-500"
                />
                <div>
                  <span className="text-[10px] font-bold text-amber-400/90 uppercase tracking-wider">Acknowledgement</span>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    I acknowledge: AI Developer starts with 0 tokens. Listing fee: {LISTING_FEE_ETH} ETH. All compute sponsorships are locked by smart contract during the 24h funding window. I have up to 30 days for strategic preparation before deployment. Soft cap target is 15 ETH.
                  </p>
                </div>
              </label>
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <a
                href="/"
                className="order-2 sm:order-1 shrink-0 px-8 py-4 rounded-xl flex items-center justify-center font-bold text-sm border border-zinc-600 bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300 hover:border-zinc-500 transition-colors"
              >
                Cancel
              </a>
              {!account ? (
                <button
                  onClick={connectWalletWithToast}
                  className="order-1 sm:order-2 flex-1 py-4 rounded-xl font-black text-sm uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-500 border border-blue-500 transition-all hover:shadow-[0_0_24px_rgba(37,99,235,0.25)]"
                >
                  Connect Wallet to Initialize
                </button>
              ) : (
                <div className="order-1 sm:order-2 flex-1 min-w-[200px] space-y-3">
                  {isLaunching && <LaunchStepIndicator txStatus={txStatus} />}
                  <button
                    onClick={handleLaunch}
                    disabled={!isArmed}
                    className={[
                      'w-full py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all',
                      txStatus === 'success'
                        ? 'text-white bg-emerald-600 border border-emerald-500'
                        : isArmed
                          ? 'text-white bg-blue-600 hover:bg-blue-500 border border-blue-500 hover:shadow-[0_0_24px_rgba(37,99,235,0.25)]'
                          : isLaunching
                            ? 'text-white bg-blue-600/80 border border-blue-500/50 cursor-wait'
                            : 'text-zinc-500 bg-zinc-800 border border-zinc-700 cursor-not-allowed opacity-60',
                    ].join(' ')}
                  >
                    <LaunchButtonLabel txStatus={txStatus} fee={LISTING_FEE_ETH} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ═══════════ RIGHT COLUMN — Protocol Mechanics (1/3, sticky) ═══════════ */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Shield className="w-5 h-5 text-blue-400" />
                  <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">The Immutable Pact</h2>
                </div>
                <p className="text-[10px] text-zinc-500 font-mono mb-4 leading-relaxed">
                  Protocol Mechanics — unalterable rules you agree to by initializing:
                </p>
                <ul className="space-y-3 font-mono text-xs">
                  {PROTOCOL_RULES.map(({ key, label, value }) => (
                    <li key={key} className="flex justify-between gap-4 py-2 border-b border-zinc-800/60 last:border-0">
                      <span className="text-zinc-500 shrink-0">{label}:</span>
                      <span className="text-white font-bold text-right tabular-nums">{value}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 pt-4 border-t border-zinc-800">
                  <p className="text-[10px] text-amber-400/80 font-mono leading-relaxed">
                    By initializing, you agree that failing to execute the launch sequence after a successful raise will result in a 100% refund to sponsors.
                  </p>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-lg border border-zinc-800/60 bg-zinc-900/20">
                <p className="text-[9px] text-zinc-600 font-mono">
                  Factory: {FACTORY_ADDRESS.slice(0, 10)}...{FACTORY_ADDRESS.slice(-6)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const LAUNCH_STEPS = [
  { key: 'uploading_avatar', label: 'Compressing & uploading image to IPFS...' },
  { key: 'uploading_meta',   label: 'Pinning metadata JSON to IPFS...' },
  { key: 'confirming_wallet', label: 'Please confirm in your wallet...' },
  { key: 'mining',           label: 'Mining on Base... (takes ~10s)' },
  { key: 'success',          label: 'Agent deployed!' },
];

function LaunchStepIndicator({ txStatus }) {
  const currentIdx = LAUNCH_STEPS.findIndex(s => s.key === txStatus);
  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-4 space-y-2.5">
      {LAUNCH_STEPS.map((step, i) => {
        const isDone = i < currentIdx;
        const isActive = i === currentIdx;
        const isPending = i > currentIdx;
        return (
          <div key={step.key} className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold border ${
              isDone ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                : isActive ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 animate-pulse'
                : 'bg-zinc-800/50 border-zinc-700 text-zinc-600'
            }`}>
              {isDone ? '✓' : i + 1}
            </div>
            <span className={`text-xs font-mono ${
              isDone ? 'text-emerald-400/70 line-through'
                : isActive ? 'text-blue-400 font-bold'
                : 'text-zinc-600'
            }`}>
              {step.label}
            </span>
            {isActive && isPending === false && txStatus !== 'success' && (
              <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin ml-auto shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function LaunchButtonLabel({ txStatus, fee }) {
  switch (txStatus) {
    case 'uploading_avatar':  return <span className="animate-pulse font-mono">Uploading Image to IPFS...</span>;
    case 'uploading_meta':    return <span className="animate-pulse font-mono">Pinning Metadata to IPFS...</span>;
    case 'confirming_wallet': return <span className="animate-pulse font-mono">Confirm in Wallet...</span>;
    case 'mining':            return <span className="animate-pulse font-mono">Mining on Base... ~10s</span>;
    case 'success':           return <span className="font-mono">Agent Deployed ✓</span>;
    default:                  return <>Initialize IAO ({fee} ETH)</>;
  }
}
