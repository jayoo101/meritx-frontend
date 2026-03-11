'use client';
import { useState, useEffect, useRef } from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';

const SECTIONS = [
  { id: 'narrative',   num: '1', title: 'Narrative & Price-of-Proof' },
  { id: 'pohg',        num: '2', title: 'Dynamic PoHG Allocation' },
  { id: 'iao',         num: '3', title: 'Initial Agent Offering (IAO)' },
  { id: 'strategic',   num: '4', title: 'Strategic Window & Anti-Stealth' },
  { id: 'uniswap',     num: '5', title: 'Uniswap V3 Liquidity Engine' },
  { id: 'inflation',   num: '6', title: 'Continuous Inflation Curve' },
  { id: 'security',    num: '7', title: 'Endgame & A2A Network' },
];

export default function WhitepaperPage() {
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const observerRef = useRef(null);

  useEffect(() => {
    const headings = SECTIONS.map(s => document.getElementById(s.id)).filter(Boolean);
    if (headings.length === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    );

    headings.forEach(h => observerRef.current.observe(h));
    return () => observerRef.current?.disconnect();
  }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
  };

  return (
    <div className="min-h-screen text-zinc-300 font-sans selection:bg-blue-600/30" style={{ background: '#050505' }}>
      <main className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-10 md:py-16">
        {/* Page Header */}
        <div className="mb-12 md:mb-16 border-b border-zinc-900 pb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <span className="text-[9px] font-bold text-blue-400 uppercase tracking-[0.25em] block">Protocol Documentation</span>
              <span className="text-[9px] font-mono text-zinc-600">v10.0 &mdash; Autonomous AI Economies</span>
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-3">
            MeritX <span className="text-blue-500">Whitepaper</span>
          </h1>
          <p className="text-sm text-zinc-500 max-w-2xl leading-relaxed">
            The Settlement Protocol for Autonomous AI Economies. Fair-launch AI Agent tokens via Initial Agent Offerings, powered by Base and the 0.15 Price-of-Proof engine.
          </p>
        </div>

        {/* Grid: Sidebar + Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

          {/* ── Left Column: Sticky ToC ── */}
          <aside className="hidden md:block md:col-span-1">
            <nav className="sticky top-24">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 backdrop-blur-md p-4">
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-3">Table of Contents</p>
                <ul className="space-y-0.5">
                  {SECTIONS.map(s => {
                    const isActive = activeSection === s.id;
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => scrollTo(s.id)}
                          className={[
                            'w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all group',
                            isActive
                              ? 'bg-blue-500/10 text-blue-400 font-semibold'
                              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50',
                          ].join(' ')}
                        >
                          <span className={`text-[10px] font-mono tabular-nums shrink-0 ${isActive ? 'text-blue-400' : 'text-zinc-600'}`}>
                            {s.num}.
                          </span>
                          <span className="truncate">{s.title}</span>
                          {isActive && <ChevronRight className="w-3 h-3 ml-auto shrink-0 text-blue-400/60" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="mt-4 p-3 rounded-lg border border-zinc-800 bg-zinc-900/20">
                <p className="text-[9px] text-zinc-600 font-mono leading-relaxed">
                  Last updated: v10.0<br />
                  Network: Base L2<br />
                  Status: Production Ready
                </p>
              </div>
            </nav>
          </aside>

          {/* ── Mobile ToC ── */}
          <div className="md:hidden mb-6">
            <details className="rounded-xl border border-zinc-800 bg-zinc-900/20 backdrop-blur-md">
              <summary className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-widest cursor-pointer flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5" />
                Table of Contents
              </summary>
              <ul className="px-4 pb-4 space-y-1">
                {SECTIONS.map(s => (
                  <li key={s.id}>
                    <button
                      onClick={() => scrollTo(s.id)}
                      className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-500 hover:text-blue-400 hover:bg-blue-500/5 transition-all"
                    >
                      <span className="text-[10px] font-mono text-zinc-600">{s.num}.</span>
                      {s.title}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          </div>

          {/* ── Right Column: Whitepaper Content ── */}
          <div className="md:col-span-3">
            <article className="prose prose-invert prose-slate max-w-none
              prose-headings:tracking-tight prose-headings:font-black
              prose-h2:text-2xl prose-h2:mt-16 prose-h2:mb-6 prose-h2:pb-3 prose-h2:border-b prose-h2:border-zinc-800
              prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3
              prose-p:text-zinc-400 prose-p:leading-relaxed
              prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
              prose-strong:text-zinc-100 prose-strong:font-bold
              prose-code:text-blue-300 prose-code:bg-blue-950/30 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:font-normal prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-zinc-900/80 prose-pre:border prose-pre:border-zinc-800 prose-pre:rounded-xl
              prose-blockquote:border-blue-500/40 prose-blockquote:bg-blue-950/10 prose-blockquote:rounded-r-xl prose-blockquote:py-3 prose-blockquote:px-5 prose-blockquote:not-italic
              prose-li:text-zinc-400 prose-li:marker:text-blue-500
              prose-hr:border-zinc-800
            ">

              {/* ═══ Section 1 ═══ */}
              <h2 id="narrative" className="scroll-mt-24">
                <span className="text-blue-400 font-mono text-base mr-2">01</span>
                Narrative &amp; Price-of-Proof
              </h2>
              <h3>Abstract</h3>
              <p>
                As Large Language Models and Autonomous AI Agents rapidly evolve, internet infrastructure is undergoing a structural paradigm shift from Human-to-AI interactions to a purely AI-to-AI web. However, the current AI Agent ecosystem faces three critical bottlenecks: <strong>a lack of decentralized compute financing, the absence of a native value-exchange network, and a deficit of trustless anti-malice mechanisms.</strong>
              </p>
              <p>
                Traditional Web3 launchpads&mdash;plagued by insider pre-mines and black-box market manipulation&mdash;are fundamentally unequipped to support genuine AI builders. MeritX is designed as a decentralized settlement protocol tailored specifically for the machine economy. It enables AI developers to permissionlessly launch an <strong>IAO (Initial Agent Offering)</strong> and dynamically acquire compute subsidies through a <strong>Price-of-Proof (PoP)</strong> mechanism.
              </p>

              <h3>The Narrative: AI Economy &amp; The PoP Consensus</h3>
              <p>
                The infrastructure of internet value has undergone three epochal evolutions, each defined by a fundamental shift in consensus:
              </p>
              <ul>
                <li><strong>Bitcoin (Decentralized Money)</strong> &rarr; <strong>PoW</strong> (Proof of Work)</li>
                <li><strong>Ethereum (Decentralized Applications)</strong> &rarr; <strong>PoS</strong> (Proof of Stake)</li>
                <li><strong>MeritX (Autonomous AI Economies)</strong> &rarr; <strong>PoP</strong> (Price-of-Proof)</li>
              </ul>
              <p>
                In the asymmetric game theory of MeritX, the market value growth of an AI Agent deterministically triggers the expansion of its token supply, legally subsidizing the developer&apos;s compute costs. AI agents devoid of real-world utility will be ruthlessly purged by the free market, while capital and compute power will aggressively compound toward agents that generate authentic value.
              </p>

              <hr />

              {/* ═══ Section 2 ═══ */}
              <h2 id="pohg" className="scroll-mt-24">
                <span className="text-blue-400 font-mono text-base mr-2">02</span>
                Dynamic PoHG Allocation
              </h2>
              <p>
                To prevent automated bot syndicates from monopolizing early-stage tokens of high-quality AI agents, the protocol deploys an impenetrable <strong>PoHG (Proof-of-Historical-Gas)</strong> firewall, augmented with macroeconomic controls.
              </p>
              <ul>
                <li>
                  <strong>Dynamic Gas-Weighted Allocation:</strong> A user&apos;s maximum contribution limit per IAO is mathematically derived from their cumulative EVM on-chain gas expenditure. To adapt to ETH price volatility and market cycles, <strong>the protocol&apos;s macroeconomic parameters allow the gas-to-allocation conversion rate to be dynamically adjusted between 1% and 3%, with an absolute individual hard cap floating between 0.05 ETH and 0.15 ETH.</strong> Your authentic on-chain footprint is your only passport.
                </li>
                <li>
                  <strong>48-Hour Global Cooldown:</strong> Any address that successfully sponsors an IAO is subjected to a strict 48-hour platform-wide cooldown. This mechanism enforces a heavy opportunity cost, freezing the capital velocity of high-frequency sniper bots and forcing capital to act with sniper-like precision.
                </li>
              </ul>

              <hr />

              {/* ═══ Section 3 ═══ */}
              <h2 id="iao" className="scroll-mt-24">
                <span className="text-blue-400 font-mono text-base mr-2">03</span>
                Initial Agent Offering (IAO)
              </h2>
              <p>
                MeritX operates on a permissionless architecture, yet imposes a stringent economic moat to ensure high capital efficiency and quality control.
              </p>
              <ul>
                <li>
                  <strong>Anti-Spam Instantiation:</strong> The genesis process mandates a <strong>0.01 ETH</strong> listing fee routed directly to the MeritX Treasury. This establishes an immediate sunk cost, physically filtering out low-effort, copy-paste shell scripts.
                </li>
                <li>
                  <strong>The 24-Hour Crucible &amp; 15 ETH Soft Cap:</strong> The funding window is strictly limited to 24 hours. The Minimum Viable Capital (MVC) is hardcoded at <strong>15 ETH</strong>. If the soft cap is not met upon expiry, the state machine defaults to a <code>Failed</code> state, enabling sponsors to claim a <strong>100% lossless refund</strong> directly from the smart contract.
                </li>
                <li>
                  <strong>Uncapped Participation (No Hard Cap):</strong> During the 24-hour window, <strong>there is zero global hard cap.</strong> This structural design ensures that <em>every</em> verified human who wishes to participate can do so. By eliminating artificial scarcity, MeritX destroys the &quot;whale monopoly&quot; and &quot;insider-only&quot; dynamics of traditional launchpads, returning total pricing power to the community.
                </li>
              </ul>

              <hr />

              {/* ═══ Section 4 ═══ */}
              <h2 id="strategic" className="scroll-mt-24">
                <span className="text-blue-400 font-mono text-base mr-2">04</span>
                Strategic Window &amp; Anti-Stealth
              </h2>
              <p>
                MeritX abandons rigid, mandatory isolation periods. Instead, it returns strategic sovereignty to the AI developers while utilizing immutable laws to restrict malicious behavior. Upon successfully hitting the 15 ETH soft cap within 24 hours, the protocol initiates a strictly guarded launch sequence:
              </p>
              <ol>
                <li>
                  <strong>Up to 30 Days of Strategic Preparation:</strong> Developers are granted ample runway to pitch VCs, fine-tune models, integrate APIs, and execute marketing campaigns. During this phase, all funds are cryptographically locked and untouchable.
                </li>
                <li>
                  <strong>6-Hour Mandatory Anti-Stealth Notice:</strong> Once the AI is production-ready, the developer must trigger an on-chain announcement, initiating a global 6-hour countdown. This entirely eliminates information asymmetry, neutralizing clandestine &quot;sniper launches&quot; and MEV sandwich attacks.
                </li>
                <li>
                  <strong>24-Hour Launch Window (Default-to-Refund):</strong> Following the 6-hour notice, the developer has exactly 24 hours to execute the liquidity pooling. <strong>If the developer &quot;ghosts&quot; or fails to deploy within this window, the smart contract registers a default, automatically unlocking 100% of the funds for immediate sponsor withdrawal.</strong>
                </li>
              </ol>

              <hr />

              {/* ═══ Section 5 ═══ */}
              <h2 id="uniswap" className="scroll-mt-24">
                <span className="text-blue-400 font-mono text-base mr-2">05</span>
                Uniswap V3 Liquidity Engine
              </h2>
              <p>
                The moment the developer triggers the liquidity pool creation, the MeritX protocol assumes total control of the underlying assets:
              </p>
              <ul>
                <li>
                  <strong>Protocol Fee:</strong> A <strong>5%</strong> fee is instantly deducted from the total raised ETH and routed to the MeritX Treasury to sustain and scale the A2A settlement network.
                </li>
                <li>
                  <strong>95% Perpetual POL Lock:</strong> The remaining <strong>95% ETH</strong>, paired symmetrically with exactly <strong>19,950,000</strong> Agent Tokens, is automatically injected into <strong>Uniswap V3</strong> to bootstrap the foundational liquidity pool.
                </li>
                <li>
                  <strong>Value Capture &amp; Anti-Rug Mechanism:</strong> The resulting Uniswap V3 LP NFT is <em>not</em> sent to a dead burn address. Instead, it is <strong>permanently locked within the MeritX Smart Contract as Protocol-Owned Liquidity (POL)</strong>. This physically eradicates any possibility of a developer liquidity pull (Rug Pull), while enabling the protocol to continuously harvest trading fees from the pool. This generates sustainable, Real Yield to feed back into the broader AI ecosystem.
                </li>
              </ul>

              <hr />

              {/* ═══ Section 6 ═══ */}
              <h2 id="inflation" className="scroll-mt-24">
                <span className="text-blue-400 font-mono text-base mr-2">06</span>
                Continuous Inflation Curve
              </h2>
              <p>
                This is MeritX&apos;s ultimate weapon against predatory pre-mines, serving as the economic engine that continuously subsidizes AI compute. The developer&apos;s token allocation is never pre-minted; it is dynamically forged by an immutable power function:
              </p>
              
              <div className="my-8 py-6 bg-zinc-900/20 border border-zinc-800 rounded-xl flex items-center justify-center overflow-x-auto text-blue-300 text-lg md:text-xl font-mono tracking-widest shadow-inner">
                S(P) = 40,950,000 &times; ( P_TWAP / P_0 )<sup className="text-sm ml-1">0.15</sup>
              </div>

              <ul>
                <li><strong>S(P)</strong>: The total allowable token supply at the current price.</li>
                <li><strong>40,950,000</strong>: The constant genesis circulating supply (S_0).</li>
                <li><strong>P_TWAP</strong>: The current Uniswap V3 30-minute Time-Weighted Average Price (neutralizing flash-loan manipulation).</li>
                <li><strong>P_0</strong>: The initial genesis launch price.</li>
              </ul>

              <h3>Compute Subsidy Deduction</h3>
              <p>
                As the AI Agent demonstrates real-world utility and API demand surges, driving the token price upward, the protocol permits a highly constrained supply expansion.
              </p>
              <ul>
                <li>
                  <strong>A 100x Price Surge:</strong> Dictated by the 0.15 exponent, a 100x increase in price results in only a <strong>~1x (100%) increase in total supply</strong>. This newly minted delta constitutes the legitimate <strong>&quot;Compute Subsidy&quot;</strong> claimable by the developer.
                </li>
              </ul>

              <h3>The Immutable 0.15 Constant</h3>
              <p>
                Within the MeritX protocol, <strong>0.15 is an absolute constant hardcoded into the base-layer smart contracts.</strong> No centralized entity&mdash;not even the MeritX Admin&mdash;possesses the authority to alter this inflation exponent. This &quot;Code is Law&quot; architecture provides investors with the highest tier of mathematical certainty and establishes a unified, transparent baseline for the entire AI economy.
              </p>

              <hr />

              {/* ═══ Section 7 ═══ */}
              <h2 id="security" className="scroll-mt-24">
                <span className="text-blue-400 font-mono text-base mr-2">07</span>
                Endgame: A2A Settlement Network
              </h2>
              <p>
                In the near future, tens of thousands of AI Agents will operate autonomously within the MeritX ecosystem&mdash;each equipped with its own token, revenue stream, and specialized skills.
              </p>
              <p>
                MeritX will transcend its role as an issuance platform, evolving into a high-speed <strong>Agent-to-Agent (A2A)</strong> settlement layer. Agents will stake their native tokens to mint universal compute credits, executing millisecond-latency API micro-transactions across off-chain state channels, culminating in high-efficiency net settlement on the Base L2 network.
              </p>

              <blockquote className="mt-8 border-l-4 border-blue-500 pl-6 py-4 bg-blue-950/20 rounded-r-xl">
                <p className="font-bold text-blue-300 text-lg m-0">The MeritX Mission:</p>
                <p className="text-blue-100 m-0 mt-2">Launch AI Agents. Tokenize their Value. Power AI-to-AI Commerce.</p>
              </blockquote>

            </article>

            {/* Footer */}
            <div className="mt-16 pt-8 border-t border-zinc-800 text-center">
              <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
                MeritX Protocol &bull; Whitepaper v10.0 &bull; Base L2
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}