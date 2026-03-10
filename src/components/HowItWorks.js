'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, CheckCircle, Compass, TrendingUp } from 'lucide-react';

const STEPS = [
  {
    icon: Fingerprint,
    label: 'Proof of On-Chain History',
    color: '#06b6d4',
    tw: 'text-cyan-400',
    bg: 'bg-cyan-900/30',
    ring: 'ring-cyan-500/50',
    glow: 'shadow-[0_0_20px_rgba(6,182,212,0.3)]',
    desc: 'EVM gas spent determines your compute sponsorship allocation. Zero Sybils, ensuring tokens go to real human backers.',
  },
  {
    icon: CheckCircle,
    label: 'Initial Agent Offering (IAO)',
    color: '#a855f7',
    tw: 'text-purple-400',
    bg: 'bg-purple-900/30',
    ring: 'ring-purple-500/50',
    glow: 'shadow-[0_0_20px_rgba(168,85,247,0.3)]',
    desc: '15 ETH soft cap to bootstrap the Agent\u2019s economy. Zero pre-mine. Funds are cryptographically secured to back the AI\u2019s native value.',
  },
  {
    icon: Compass,
    label: 'Strategic Window & 6h Notice',
    color: '#f59e0b',
    tw: 'text-amber-400',
    bg: 'bg-amber-900/30',
    ring: 'ring-amber-500/50',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]',
    desc: 'AI Developers get up to 30 days to fine-tune models and APIs. When ready, a mandatory 6h public notice ensures a transparent, anti-stealth deployment.',
  },
  {
    icon: TrendingUp,
    label: 'Price-of-Proof (PoP) Engine',
    color: '#10b981',
    tw: 'text-emerald-400',
    bg: 'bg-emerald-900/30',
    ring: 'ring-emerald-500/50',
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.3)]',
    desc: 'Agent utility drives market value. The 0.15 continuous inflation curve dynamically rewards developers with compute subsidies as their AI grows.',
  },
];

export default function HowItWorks() {
  const [active, setActive] = useState(null);

  return (
    <div className="relative max-w-5xl mx-auto">
      <div className="text-center mb-12 md:mb-16">
        <p className="font-mono text-[10px] text-zinc-600 tracking-[0.25em] uppercase mb-1">
          &gt; IAO_PROTOCOL_MECHANICS
        </p>
        <h2 className="text-lg md:text-xl font-black text-white tracking-tight">
          How It Works
        </h2>
      </div>

      {/* Desktop: 4-column horizontal grid */}
      <div className="hidden md:block">
        <div className="relative">
          <div className="absolute top-[23px] left-[12.5%] right-[12.5%] h-px z-0">
            <div className="h-full bg-zinc-800" />
            <div className="absolute inset-0 h-full bg-gradient-to-r from-cyan-500/20 via-purple-500/15 to-emerald-500/20" />
          </div>

          <div className="grid grid-cols-4 gap-6">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const isActive = active === i;
              return (
                <div
                  key={step.label}
                  className="relative flex flex-col items-center text-center cursor-pointer"
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                >
                  <motion.div
                    animate={isActive ? { scale: 1.12, y: -2 } : { scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    className={[
                      'relative z-10 w-[46px] h-[46px] rounded-full flex items-center justify-center transition-all duration-300',
                      step.bg,
                      isActive ? `ring-1 ${step.ring} ${step.glow}` : 'ring-1 ring-white/[0.06]',
                    ].join(' ')}
                  >
                    <Icon
                      className={`w-5 h-5 transition-colors duration-200 ${isActive ? step.tw : 'text-zinc-500'}`}
                      strokeWidth={1.8}
                    />
                  </motion.div>

                  <h3 className={`mt-5 text-sm font-bold transition-colors duration-200 ${isActive ? 'text-white' : 'text-zinc-300'}`}>
                    {step.label}
                  </h3>

                  <p className={`mt-2 text-sm leading-relaxed max-w-[220px] transition-colors duration-200 ${isActive ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile: vertical timeline */}
      <div className="md:hidden relative pl-14">
        <div className="absolute left-[22px] top-0 bottom-0 w-px">
          <div className="h-full bg-zinc-800" />
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/20 via-purple-500/15 to-emerald-500/20" />
        </div>

        <div className="space-y-10">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = active === i;
            return (
              <div
                key={step.label}
                className="relative"
                onTouchStart={() => setActive(active === i ? null : i)}
              >
                <div
                  className={[
                    'absolute -left-14 top-0 w-[46px] h-[46px] rounded-full flex items-center justify-center z-10 transition-all duration-300',
                    step.bg,
                    isActive ? `ring-1 ${step.ring} ${step.glow}` : 'ring-1 ring-white/[0.06]',
                  ].join(' ')}
                >
                  <Icon
                    className={`w-5 h-5 ${isActive ? step.tw : 'text-zinc-500'}`}
                    strokeWidth={1.8}
                  />
                </div>

                <div>
                  <h3 className={`text-sm font-bold ${isActive ? 'text-white' : 'text-zinc-300'}`}>
                    {step.label}
                  </h3>
                  <p className="mt-1.5 text-sm text-zinc-500 leading-relaxed pr-2">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
