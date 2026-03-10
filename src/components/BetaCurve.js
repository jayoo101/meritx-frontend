'use client';
import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';

const BETA = 0.15;

function generateCurveData() {
  const points = [];
  for (let x = 1; x <= 100; x++) {
    points.push({ price: x, supply: Math.pow(x, BETA) });
  }
  return points;
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null;
  const { price, supply } = payload[0].payload;
  return (
    <div className="rounded-lg bg-black/95 border border-white/10 backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.7)] px-4 py-3 min-w-[170px]">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
        <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">PoP Engine</span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between items-baseline gap-6">
          <span className="text-[10px] text-zinc-500 font-mono">Price</span>
          <span className="text-sm font-black text-white font-mono tabular-nums">{price}x</span>
        </div>
        <div className="flex justify-between items-baseline gap-6">
          <span className="text-[10px] text-zinc-500 font-mono">Supply</span>
          <span className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 font-mono tabular-nums">
            {supply.toFixed(2)}x
          </span>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-white/[0.06]">
        <p className="text-[9px] text-zinc-600 font-mono">
          {price}x price &rarr; only {supply.toFixed(2)}x dilution
        </p>
      </div>
    </div>
  );
}

export default function BetaCurve() {
  const data = useMemo(generateCurveData, []);
  const point10x = data.find(d => d.price === 10);
  const point50x = data.find(d => d.price === 50);

  return (
    <div className="relative w-full max-w-6xl mx-auto rounded-2xl border border-white/[0.06] bg-black/40 backdrop-blur-xl overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/4 w-72 h-40 bg-cyan-500/[0.04] rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-60 h-36 bg-purple-500/[0.05] rounded-full blur-[100px] pointer-events-none" />

      <div className="relative px-6 pt-6 pb-2 md:px-8 md:pt-8">
        {/* Header row: title left, callouts right */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
          <div>
            <p className="font-mono text-[10px] text-zinc-600 tracking-[0.25em] uppercase mb-1">
              &gt; POP_INFLATION_ENGINE
            </p>
            <h2 className="text-lg md:text-xl font-black text-white tracking-tight">
              The <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">&beta; = 0.15</span> Curve
            </h2>
            <p className="text-[11px] text-zinc-600 font-mono mt-1 max-w-md">
              S(P) = S&#8320; &times; (P/P&#8320;)<sup>0.15</sup> &mdash; supply grows sub-linearly.
              100x price &rarr; only 2x dilution.
            </p>
          </div>

          {/* Inline stat pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatPill label="10x" value="1.41x" color="text-cyan-400" border="border-cyan-500/15" />
            <StatPill label="50x" value="1.86x" color="text-purple-400" border="border-purple-500/15" />
            <StatPill label="100x" value="2.00x" color="text-purple-400" border="border-purple-500/15" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/[0.04]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.6)]" />
              <span className="text-[9px] text-emerald-400 font-bold">DEFLATIONARY</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart — panoramic */}
      <div className="w-full h-[260px] md:h-[360px] px-2 md:px-4 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="curveStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="55%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#c084fc" />
              </linearGradient>
              <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.10} />
                <stop offset="40%" stopColor="#8b5cf6" stopOpacity={0.05} />
                <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <CartesianGrid
              strokeDasharray="4 8"
              stroke="rgba(255,255,255,0.025)"
              vertical={false}
            />

            <XAxis
              dataKey="price"
              tick={{ fill: '#3f3f46', fontSize: 10, fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.04)' }}
              tickFormatter={(v) => `${v}x`}
              ticks={[1, 10, 25, 50, 75, 100]}
            />

            <YAxis
              tick={{ fill: '#3f3f46', fontSize: 10, fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.04)' }}
              tickFormatter={(v) => `${v.toFixed(1)}x`}
              domain={[1, 'auto']}
              width={45}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: 'rgba(6,182,212,0.15)', strokeWidth: 1, strokeDasharray: '4 4' }}
            />

            {point10x && (
              <>
                <ReferenceLine x={10} stroke="rgba(6,182,212,0.08)" strokeDasharray="3 6" />
                <ReferenceDot x={10} y={point10x.supply} r={4} fill="#06b6d4" stroke="#083344" strokeWidth={2} />
              </>
            )}
            {point50x && (
              <>
                <ReferenceLine x={50} stroke="rgba(139,92,246,0.08)" strokeDasharray="3 6" />
                <ReferenceDot x={50} y={point50x.supply} r={4} fill="#8b5cf6" stroke="#2e1065" strokeWidth={2} />
              </>
            )}

            <Area
              type="monotone"
              dataKey="supply"
              stroke="url(#curveStroke)"
              strokeWidth={3}
              fill="url(#curveFill)"
              filter="url(#glow)"
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StatPill({ label, value, color, border }) {
  return (
    <div className={`flex items-baseline gap-1.5 px-3 py-1.5 rounded-full border bg-white/[0.02] ${border}`}>
      <span className="text-[9px] text-zinc-600 font-mono">{label}</span>
      <span className={`text-xs font-black font-mono tabular-nums ${color}`}>{value}</span>
    </div>
  );
}
