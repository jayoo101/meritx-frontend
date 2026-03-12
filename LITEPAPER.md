# MeritX Technical Litepaper (v12.0)
**The Settlement Protocol for Autonomous AI Economies on Base**

## 0. Manifesto
The evolution of the internet is approaching an irreversible technological singularity: AI is rapidly transforming from a passive human tool (Human-to-AI) into intelligent agents capable of autonomous collaboration (Agent-to-Agent). In this imminent era, thousands of autonomous AI agents will buy data, consume compute, call APIs, and exchange value in real-time. This entirely new paradigm of machine-to-machine interaction constitutes the **Autonomous AI Economies**. 

However, legacy financial systems and early crypto platforms cannot support this high-frequency, trustless A2A commerce. MeritX is built for this exact purpose: we provide the ultimate base-layer settlement infrastructure for these silicon-based economies.

## 1. The Third Consensus
Every paradigm shift in blockchain history has been driven by underlying consensus innovation:
* **Bitcoin** introduced *Proof-of-Work*, creating decentralized currency.
* **Ethereum** introduced *Proof-of-Stake*, creating decentralized applications.
* **MeritX** introduces **Price-of-Proof (PoP)**. Under this mechanism, free-market pricing and authentic demand become the absolute laws governing the expansion of AI agent compute subsidies.

## 2. Protocol Architecture: The 7-Layer Settlement Stack
MeritX establishes the operational laws of the AI economy through a rigorous, bottom-up 7-layer architecture:
* **Application Layer:** The interaction frontline for all AI agents (trading bots, data scrapers, LLM APIs).
* **Agent Economy Layer:** Hosts the commercial logic and revenue streams of the agents.
* **Launch Protocol:** Enables permissionless Initial Agent Offerings (IAO).
* **PoP Monetary Engine:** Smoothly regulates token supply based on market prices.
* **Liquidity Layer:** Perpetual underlying liquidity powered by Uniswap V3.
* **Settlement Layer (Base L2 + EIP-4844):** Relies on Base L2 for lightning-fast, low-cost execution. *Crucially, we utilize EIP-4844 data blobs for rolling up agent state data. To handle blob expiry (~18 days), MeritX periodically posts compressed state roots to L1/Base calldata as fallback proofs, ensuring long-term verifiability without bottlenecking the L2.*
* **Ethereum Security:** Inherits the absolute consensus security of the Ethereum mainnet.

## 3. Agent Standard: MAS-20
Just as ERC-20 ignited the DeFi summer, MeritX introduces the **MAS-20 (MeritX Agent Standard)** designed specifically for the AI era. This standard unifies the following interfaces at the smart contract level:
* **Metadata:** Defines the agent's functional attributes and interaction methods.
* **Token Binding:** Deeply binds the agent's native token with its execution permissions.
* **Revenue Interface:** Standardizes the logic for profit sharing, buybacks, and burns.
* **Compute Usage Interface:** Normalizes billing and payment channels for API calls.
MAS-20 ensures that all agents on the MeritX network possess ultimate composability and financial interoperability.

## 4. Machine Genesis & The Carbon Defense: IAO & PoHG
To prevent capital oligarchs and high-frequency Sybil bots from monopolizing early premium AI assets, MeritX deploys a strictly fair game-theoretic mechanism at the entry point:
* **Initial Agent Offering (IAO):** Provides a 24-hour permissionless funding window. The Minimum Viable Capital soft-cap is hardcoded at 15 ETH. If unmet, investors can execute a 10
