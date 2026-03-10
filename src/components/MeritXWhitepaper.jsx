'use client';

import React, { useState, useEffect } from 'react';

export default function MeritXWhitepaper() {
  const [activeSection, setActiveSection] = useState('abstract');
  const [systemTime, setSystemTime] = useState('');

  // Simulated system clock HUD
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setSystemTime(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const sections = [
    {
      id: 'abstract',
      title: '00 // ABSTRACT',
      content: (
        <div className="space-y-6">
          <div className="border-l-2 border-emerald-500 pl-4 py-1">
            <h3 className="text-emerald-400 font-bold text-xl tracking-wider uppercase">MeritX: The Settlement Protocol</h3>
            <p className="text-sm text-zinc-500 uppercase tracking-widest mt-1">For Autonomous AI Economies</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mb-8 border border-zinc-800/60 bg-zinc-900/30 p-4 rounded-lg">
            <div><span className="text-zinc-500 block mb-1">VERSION</span> <span className="text-emerald-400 font-bold animate-pulse">v10.0-FINAL</span></div>
            <div><span className="text-zinc-500 block mb-1">ERA</span> <span className="text-white">Agentic Economy</span></div>
            <div><span className="text-zinc-500 block mb-1">NETWORK</span> <span className="text-white">Base L2 (Native ETH)</span></div>
            <div><span className="text-zinc-500 block mb-1">ASSET</span> <span className="text-white">Native ETH</span></div>
          </div>
          
          <p className="text-zinc-300 leading-relaxed">As Large Language Models and Autonomous AI Agents evolve exponentially, Internet infrastructure is undergoing a structural paradigm shift from <span className="text-emerald-400">Human-to-AI</span> to <span className="text-emerald-400">AI-to-AI</span>. However, the current AI Agent ecosystem remains trapped in three major &quot;Valleys of Death&quot;: a lack of decentralized compute-financing channels, the absence of a native value-exchange network, and a void in verifiable service delivery mechanisms.</p>
          <p className="text-zinc-300 leading-relaxed">MeritX proposes a decentralized underlying settlement protocol engineered specifically for the <b className="text-white">Autonomous AI Economy</b>. The protocol empowers AI Agents to automatically generate Token economies permissionlessly, dynamically release compute tokens via the Price-of-Proof (PoP) mechanism, and execute zero-friction value exchange within an Agent-to-Agent (A2A) network.</p>
        </div>
      )
    },
    {
      id: 'narrative',
      title: '01 // NARRATIVE',
      content: (
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-zinc-800/80 pb-3 mb-6">
            <span className="w-2 h-2 bg-emerald-500 rounded-sm animate-pulse"></span>
            <h3 className="text-emerald-400 text-lg tracking-widest uppercase">Evolution of the AI Economy</h3>
          </div>
          <p className="text-zinc-300 leading-relaxed">The value infrastructure of the Internet has undergone three epoch-making evolutions, each accompanied by a fundamental reconstruction of consensus mechanisms:</p>
          
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-lg p-5 space-y-4 font-mono text-sm">
            <div className="flex items-center gap-4 border-b border-zinc-800/40 pb-3">
              <span className="text-zinc-600">[01]</span>
              <span className="text-white w-24">Bitcoin</span>
              <span className="text-zinc-500">&rarr;</span>
              <span className="text-emerald-400">PoW (Proof of Energy)</span>
            </div>
            <div className="flex items-center gap-4 border-b border-zinc-800/40 pb-3">
              <span className="text-zinc-600">[02]</span>
              <span className="text-white w-24">Ethereum</span>
              <span className="text-zinc-500">&rarr;</span>
              <span className="text-emerald-400">PoS (Proof of Capital)</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-zinc-600">[03]</span>
              <span className="text-white w-24 font-bold">MeritX</span>
              <span className="text-emerald-400">&rarr;</span>
              <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded">PoP (Proof of Market Value)</span>
            </div>
          </div>
          
          <p className="text-zinc-300 leading-relaxed">In the asymmetric game of MeritX, the market value growth of an AI Agent directly triggers the expansion of its Token supply, thereby providing legitimate compute subsidies to developers. AI models devoid of genuine utility will be naturally phased out by the free market.</p>
        </div>
      )
    },
    {
      id: 'genesis',
      title: '02 // AGENT GENESIS',
      content: (
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-zinc-800/80 pb-3 mb-6">
            <span className="w-2 h-2 bg-emerald-500 rounded-sm animate-pulse"></span>
            <h3 className="text-emerald-400 text-lg tracking-widest uppercase">Permissionless Genesis &amp; Anti-Spam</h3>
          </div>
          <p className="text-zinc-300 leading-relaxed">Any developer can deploy an independent economic state machine for their AI on MeritX. To prevent the proliferation of low-quality models and shell scripts, MeritX introduces a Darwinian elimination mechanism based on sunk costs.</p>
          
          <div className="bg-black/50 border border-zinc-700/50 rounded-lg p-5 font-mono relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50"></div>
            <div className="text-xs text-zinc-500 mb-3 uppercase tracking-widest flex justify-between">
              <span>// Genesis_Execution_Sequence</span>
              <span className="text-emerald-500">0_PREMINE_ENFORCED</span>
            </div>
            <code className="text-sm text-purple-400 block leading-loose">
              <span className="text-zinc-400">01.</span> Register_Agent() &amp;&amp; Upload_API_Endpoint()<br/>
              <span className="text-zinc-400">02.</span> Burn_Fee(0.01_ETH) <span className="text-zinc-500">// Anti-Spam Sunk Cost</span><br/>
              <span className="text-zinc-400">03.</span> Deploy_ERC20_Token() <span className="text-zinc-500">// Native Economy Init</span><br/>
              <span className="text-zinc-400">04.</span> Initialize_Liquidity_Pool()
            </code>
          </div>
        </div>
      )
    },
    {
      id: 'liquidity',
      title: '03 // LIQUIDITY SINK',
      content: (
        <div className="space-y-6">
           <div className="flex items-center gap-3 border-b border-zinc-800/80 pb-3 mb-6">
            <span className="w-2 h-2 bg-emerald-500 rounded-sm animate-pulse"></span>
            <h3 className="text-emerald-400 text-lg tracking-widest uppercase">Capital Formation &amp; Liquidity Sink</h3>
          </div>
          <p className="text-zinc-300 leading-relaxed">During the IAO (Initial Agent Offering) phase, MeritX employs a dual-layer time-lock and an absolute liquidity blackhole mechanism to thoroughly eradicate Rug Pull risks.</p>
          
          <div className="grid gap-4 mt-6">
            <div className="border border-zinc-800 bg-zinc-900/40 p-4 rounded hover:bg-zinc-800/50 transition-colors">
              <h4 className="text-emerald-400 font-bold mb-2 flex items-center gap-2"><span className="text-zinc-500">&gt;</span> 24h MVC Soft Cap</h4>
              <p className="text-sm text-zinc-400">Minimum Viable Capital (MVC) is hardcoded at 15 ETH. If unmet within the 24h Crucible, the state shifts to <code className="text-red-400 bg-red-400/10 px-1 rounded">Failed</code>.</p>
            </div>
            <div className="border border-zinc-800 bg-zinc-900/40 p-4 rounded hover:bg-zinc-800/50 transition-colors">
              <h4 className="text-emerald-400 font-bold mb-2 flex items-center gap-2"><span className="text-zinc-500">&gt;</span> Strategic Preparation Window</h4>
              <p className="text-sm text-zinc-400">Upon reaching the cap, funds are cryptographically secured. Founders get up to 30 days to pitch VCs, market, and build before launching via a mandatory 6h public notice.</p>
            </div>
            <div className="border border-zinc-800 bg-zinc-900/40 p-4 rounded hover:bg-zinc-800/50 transition-colors">
              <h4 className="text-emerald-400 font-bold mb-2 flex items-center gap-2"><span className="text-zinc-500">&gt;</span> 95% Liquidity Sink</h4>
              <p className="text-sm text-zinc-400">Upon launch, 95% of funds are injected into the DEX liquidity pool on Base L2. LP tokens are locked inside the contract permanently, ensuring permanent market depth.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'pop',
      title: '04 // PoP ENGINE',
      content: (
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-zinc-800/80 pb-3 mb-6">
            <span className="w-2 h-2 bg-emerald-500 rounded-sm animate-pulse"></span>
            <h3 className="text-emerald-400 text-lg tracking-widest uppercase">Price-of-Proof Inflation Engine</h3>
          </div>
          <p className="text-zinc-300 leading-relaxed">The emission rate of Tokens is strictly governed by the authentic growth of market value, entirely abandoning artificial cliff-unlocks.</p>
          
          <div className="relative bg-black/60 border border-zinc-700/60 rounded-xl p-8 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.05)]">
            <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50"></div>
            <span className="text-xs text-zinc-500 mb-6 uppercase tracking-widest drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">Token Supply Function [Active]</span>
            <div className="text-2xl md:text-3xl text-emerald-400 font-bold tracking-wider">
              {"$$S(P) = S_0 \\times \\left(\\frac{P_{TWAP}}{P_0}\\right)^\\alpha$$"}
            </div>
          </div>
          
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded text-sm text-zinc-400 space-y-2">
            <p><span className="text-emerald-500/70 font-bold">» Parameter $S_0$:</span> Constant Genesis Supply = 40,950,000</p>
            <p><span className="text-emerald-500/70 font-bold">» Parameter $\alpha$:</span> Inflation Elasticity Coefficient = 0.15</p>
            <p><span className="text-emerald-500/70 font-bold">» Parameter {"$P_{TWAP}$"}:</span> 30-min Time-Weighted Average Price.</p>
            <p className="pt-2 border-t border-zinc-800 mt-2 text-zinc-500">This exponential model ensures token emission dynamically responds to market cap growth, achieving natural inflation decay over long-term evolution.</p>
          </div>
        </div>
      )
    },
    {
      id: 'a2a',
      title: '05 // A2A SETTLEMENT',
      content: (
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-zinc-800/80 pb-3 mb-6">
            <span className="w-2 h-2 bg-emerald-500 rounded-sm animate-pulse"></span>
            <h3 className="text-emerald-400 text-lg tracking-widest uppercase">A2A State Channel Layer</h3>
          </div>
          <p className="text-zinc-300 leading-relaxed">To eliminate mainnet Gas friction for AI microtransactions, MeritX introduces a dedicated state channel settlement layer.</p>
          
          <ul className="space-y-4 text-sm text-zinc-300 mt-4 border-l border-zinc-800 pl-4">
            <li className="relative">
              <span className="absolute -left-[21px] top-1.5 w-2 h-2 bg-zinc-700 rounded-full"></span>
              <span className="text-emerald-400 font-bold block text-base mb-1">Compute Credits</span>
              Agents collateralize native Tokens to mint universally accepted cross-chain off-chain microtransaction vouchers.
            </li>
            <li className="relative">
              <span className="absolute -left-[21px] top-1.5 w-2 h-2 bg-zinc-700 rounded-full"></span>
              <span className="text-emerald-400 font-bold block text-base mb-1">Zero-Friction Interaction</span>
              Massive API-level payments are executed within off-chain channels in milliseconds with 0 Gas.
            </li>
            <li className="relative">
              <span className="absolute -left-[21px] top-1.5 w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></span>
              <span className="text-emerald-400 font-bold block text-base mb-1">Global Net Settlement</span>
              Periodically runs the Netting Algorithm, initiating low-frequency Swaps solely for offset net positions.
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'opml',
      title: '06 // opML ARBITRATION',
      content: (
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-zinc-800/80 pb-3 mb-6">
            <span className="w-2 h-2 bg-emerald-500 rounded-sm animate-pulse"></span>
            <h3 className="text-emerald-400 text-lg tracking-widest uppercase">opML &amp; Trustless Delivery</h3>
          </div>
          <p className="text-zinc-300 leading-relaxed">To resolve the black-box nature of AI inference, MeritX adopts an opML architecture to achieve trustless delivery of Skill NFTs.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-purple-900/10 border border-purple-500/30 rounded p-4">
              <div className="text-purple-400 font-bold mb-2">01 / Optimistic Escrow</div>
              <div className="text-xs text-zinc-400 leading-relaxed">Fees are locked in Escrow. The system optimistically assumes honest execution.</div>
            </div>
            <div className="bg-purple-900/10 border border-purple-500/30 rounded p-4">
              <div className="text-purple-400 font-bold mb-2">02 / Fraud Challenge</div>
              <div className="text-xs text-zinc-400 leading-relaxed">If disputed, the Skill provider must submit a TEE (Trusted Execution Environment) cryptographic proof.</div>
            </div>
            <div className="bg-red-900/10 border border-red-500/30 rounded p-4 group hover:bg-red-900/20 transition-colors">
              <div className="text-red-400 font-bold mb-2">03 / Slash Confiscation</div>
              <div className="text-xs text-zinc-400 leading-relaxed">Failure to prove honest execution triggers a Slash, confiscating collateral and fully compensating the victim.</div>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black text-zinc-300 font-mono p-4 md:p-8 selection:bg-emerald-500/30">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8">
        
        {/* Left Navigation Console (HUD) */}
        <div className="w-full md:w-1/3 lg:w-1/4 shrink-0">
          <div className="sticky top-8 border border-zinc-700/50 bg-black/60 backdrop-blur-md p-6 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/20"></div>
            
            <div className="flex items-center gap-3 mb-8 border-b border-zinc-800 pb-4">
              <div className="relative flex items-center justify-center w-4 h-4">
                <div className="absolute w-full h-full rounded-full border border-emerald-500 animate-[spin_3s_linear_infinite]"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,1)]"></div>
              </div>
              <h1 className="text-xl font-bold tracking-widest text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">MERIT<span className="text-emerald-400">X</span></h1>
            </div>
            
            <div className="text-[10px] text-emerald-500/70 mb-4 uppercase tracking-widest font-bold">System Navigation</div>
            
            <nav className="flex flex-col gap-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`text-left px-3 py-2.5 text-xs transition-all duration-300 border-l-2 uppercase tracking-wider font-bold relative overflow-hidden group ${
                    activeSection === section.id 
                      ? 'border-emerald-400 text-emerald-400 bg-emerald-500/10 shadow-[inset_20px_0_20px_-20px_rgba(16,185,129,0.3)]' 
                      : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/30'
                  }`}
                >
                  <span className="relative z-10">{section.title}</span>
                  {activeSection === section.id && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] opacity-50 animate-pulse">_ACTV</span>
                  )}
                </button>
              ))}
            </nav>
            
            <div className="mt-10 pt-4 border-t border-zinc-800/80 text-[10px] text-zinc-500 space-y-1">
              <div className="flex justify-between"><span className="text-zinc-600">SYS_TIME:</span> <span className="text-emerald-400/80">{systemTime || 'SYNCING...'}</span></div>
              <div className="flex justify-between"><span className="text-zinc-600">UPLINK:</span> <span className="text-emerald-400">SECURE</span></div>
              <div className="flex justify-between"><span className="text-zinc-600">LATENCY:</span> <span className="text-emerald-400">12ms</span></div>
            </div>
          </div>
        </div>

        {/* Right Content Window (Data Vault) */}
        <div className="w-full md:w-2/3 lg:w-3/4">
          <div className="border border-zinc-700/50 bg-zinc-950/80 p-6 md:p-10 rounded-xl backdrop-blur-xl min-h-[600px] shadow-[0_0_40px_rgba(0,0,0,0.5)] relative overflow-hidden">
            
            {/* 🚀 FIX: Used dangerouslySetInnerHTML to completely bypass React's styled-jsx compiler and prevent Hydration Mismatch */}
            <div className="absolute left-0 w-full h-0.5 bg-emerald-500/50 opacity-30 shadow-[0_0_10px_rgba(16,185,129,1)]" style={{ animation: 'scan 4s ease-in-out infinite' }}></div>
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes scan {
                0% { top: 0; }
                50% { top: 100%; }
                100% { top: 0; }
              }
            `}} />

            <div className="relative z-10">
              {sections.map((section) => (
                <div 
                  key={section.id} 
                  className={`transition-all duration-700 ${activeSection === section.id ? 'block opacity-100 translate-y-0' : 'hidden opacity-0 translate-y-4'}`}
                >
                  <div className="flex items-center gap-2 mb-8 border-b border-zinc-800/50 pb-4">
                    <span className="text-emerald-500 opacity-80 animate-pulse font-bold text-xl">&gt;_</span>
                    <h2 className="text-2xl text-white tracking-widest uppercase font-bold drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                      {section.title.split('//')[1]}
                    </h2>
                  </div>
                  
                  <div className="text-base text-zinc-300 font-light">
                    {section.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}