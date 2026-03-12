# MeritX: The Settlement Protocol for Autonomous AI Economies (v10.0)

## Abstract
As Autonomous AI Agents evolve, internet infrastructure is shifting from Human-to-AI to **AI-to-AI (A2A)** commerce. MeritX is a decentralized settlement protocol designed specifically for the Agentic Economy. It enables AI developers to launch agents via **Initial Agent Offerings (IAO)**, utilizes the **Price-of-Proof (PoP)** mechanism for compute subsidies, and ensures absolute security through cryptographic time-locks and "Black Hole" liquidity.

## 1. The Narrative: The Third Consensus
- **Bitcoin:** Decentralized Currency via PoW.
- **Ethereum:** Decentralized Applications via PoS.
- **MeritX:** Autonomous AI Economies via **Price-of-Proof (PoP)**.
In MeritX, market value growth triggers token supply expansion, providing legitimate "Compute Subsidies" for AI builders.

## 2. Carbon Defense: Proof-of-Historical-Gas (PoHG)
To prevent bot manipulation during the genesis phase:
- **Gas-based Allocation:** A user's maximum IAO investment is capped at 1% of their total historical EVM Gas spent (~0.06 ETH cap). Your on-chain footprint is your passport.
- **48h Global Cooldown:** Addresses participating in an IAO are silenced for 48 hours to prevent high-frequency "sniping."

## 3. Agent Genesis & IAO Mechanics
- **Anti-Spam:** 0.015 ETH listing fee to filter low-quality scripts.
- **24h Lifeline:** Minimum Viable Capital (MVC) is hardcoded at **15 ETH**. 
- **Refund Policy:** If the 15 ETH soft-cap is not met within 24 hours, investors receive a 100% lossless refund.

## 4. Strategic Window & Anti-Stealth Launch
- **30-day Strategic Prep:** After a successful IAO, developers have up to 30 days for marketing and API integration while funds remain locked.
- **6h Anti-Stealth Notice:** Developers must trigger an on-chain countdown 6 hours before adding liquidity to eliminate information asymmetry.

## 5. Black Hole Liquidity
- **95% Permanent Liquidity:** 95% of raised ETH and 19,950,000 tokens are injected into Uniswap V3.
- **Burned LP:** LP NFTs are sent to `0x000...dEaD`, ensuring irrevocable market depth.
- **Zero Pre-mine:** Developers start with 0 tokens, matching the retail entry price ($P_0$).

## 6. Price-of-Proof (PoP) Inflation Engine
The supply expands based on a strict power function: 
**S(P) = 40,950,000 * (P_TWAP / P_0)^0.15**
This converts market demand into developer compute subsidies while protecting early investor equity from hyper-inflation.

## 7. Endgame: A2A Settlement Network
MeritX will evolve into a high-speed settlement layer for A2A commerce. Agents will settle API micro-transactions via off-chain state channels with finality secured on Base L2.

**Launch AI Agents. Tokenize their Value. Power AI-to-AI Commerce. 🔵**
