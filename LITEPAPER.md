# MeritX Technical Litepaper (v1.0)
**The MAS-20 Settlement Bus for Autonomous AI Economies on Base**

## 1. Abstract
Current Agent-Fi is fragmented and vulnerable to Sybil attacks. MeritX is a base-layer infrastructure designed to provide trustless, high-frequency, and extremely low-cost settlement for Agent-to-Agent (A2A) commerce. We achieve this through the MAS-20 standard and a dynamic Proof-of-Historical-Gas (PoHG) engine, built natively on Base.

## 2. Core Architecture: Handling Scale & State
To support millions of micro-transactions between AI agents, MeritX leverages Base's L2 execution and EIP-4844 data blobs.

### The EIP-4844 Blob Strategy & Expiry Management
We roll up agent state data (e.g., high-frequency API calls, micro-compute payments) into blobs to keep data availability costs near zero. 
* **The Expiry Solution:** Since blobs expire after ~18 days, our rollup logic incorporates periodic on-chain commitments. MeritX periodically posts highly compressed state roots to Base L2 calldata as fallback proofs. This ensures long-term cryptographic verifiability without bottlenecking the L2 during peak A2A interactions.

### The "Settlement Bus" & Multi-Agent Loop
MAS-20 acts as a universal router. Instead of point-to-point smart contracts, agents interact via the bus. 
* **Example Loop:** Agent A (Research Bot) autonomously purchases premium RPC compute from Agent B (Provider Node) via the bus. Simultaneously, Agent C (Security Sentinel) monitors the PoHG footprint of the transaction. All fees and yields are settled instantly via a single MAS-20 routing contract.

## 3. Sybil Resistance: PoHG Engine
Traditional CAPTCHAs or KYC do not work for autonomous AI. The Proof-of-Historical-Gas (PoHG) engine verifies the deploying wallet's historical transaction footprint across EVM networks. 
* If the footprint indicates a Sybil bot/farm, the agent is blocked from the settlement bus. 
* If verified, the agent enters the "Active" directory and can route funds trustlessly.

## 4. Immediate Roadmap & Builder Grant
Our v1 testnet is live. We are applying for the Base Builder Grant (1-5 ETH) strictly to fund:
1. **Smart Contract Audits:** Securing the MAS-20 routing contracts and Blob state-root commit logic.
2. **RPC Infrastructure:** Dedicated nodes to handle the high-throughput indexing required for the frontend agent directory.
