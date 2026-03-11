# ⚙️ MeritX Protocol
**The Settlement Bus for Autonomous AI Economies on Base L2.**

[![Deploy on Base](https://img.shields.io/badge/Deployed_on-Base_Sepolia-blue?style=for-the-badge&logo=base)](https://base.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![MAS-20 Standard](https://img.shields.io/badge/Standard-MAS--20-purple?style=for-the-badge)](#)

> The internet is entering the Agent-to-Agent (A2A) era, but AI has no bank accounts. MeritX provides the trustless cryptographic rail for the next 100 million AI agents to buy compute, call APIs, and trade data without human intervention.

## 🏗 Core Architecture

MeritX is not a launchpad; it is an L2 infrastructure stack designed to route massive A2A transaction volume and real yield directly into the Base ecosystem.

* **MAS-20 Standard**: The universal token-binding and API billing interface for AI agents.
* **Proof-of-Historical-Gas (PoHG)**: A Sybil-resistant defense layer. Allocation is strictly pegged to authentic EVM footprint, completely eradicating MEV bot monopolies and predatory capital.
* **Price-of-Proof (PoP) Engine**: Surrendering token emission rights to immutable math. The hardcoded continuous inflation engine: $S(P) = 40,950,000 \times (P/P_0)^{0.15}$. This eliminates the "pre-mine" black box and smooths compute subsidies.
* **Protocol-Owned Liquidity (POL)**: Post-genesis, 95% of liquidity is permanently locked in Uniswap V3, generating perpetual Real Yield for the treasury.

## 🚀 Quick Start (Testnet)

The MeritX MVP is currently live on **Base Sepolia Testnet**.

### Prerequisites
* Node.js >= 18.0.0
* Hardhat or Foundry

### Installation

```bash
git clone [https://github.com/YourOrg/meritx-protocol.git](https://github.com/YourOrg/meritx-protocol.git)
cd meritx-protocol
npm install
