'use client';
import { useEffect } from 'react';

export default function AirdropPage() {
  useEffect(() => {
    if (typeof window.__meritxOpenAirdrop === 'function') {
      window.__meritxOpenAirdrop();
    }
  }, []);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-black text-white tracking-tight">
          The Merit<span className="text-cyan-400"> Drop</span>
        </h1>
        <p className="text-zinc-500 text-sm font-mono">
          Loading Proof of Gas scanner...
        </p>
        <button
          onClick={() => window.__meritxOpenAirdrop?.()}
          className="mt-4 px-6 py-3 rounded-xl bg-cyan-600/10 border border-cyan-500/20 text-cyan-400 font-bold text-sm hover:bg-cyan-600/20 transition-all"
        >
          Open Scanner
        </button>
      </div>
    </div>
  );
}
