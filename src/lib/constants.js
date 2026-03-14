// MeritX Protocol — Base L2 Configuration (Single Source of Truth)
// All values support env-var override via NEXT_PUBLIC_* for deploy-time config.

// Base Sepolia Testnet
export const CHAIN_ID     = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 84532;
export const CHAIN_ID_HEX = '0x' + CHAIN_ID.toString(16);
export const CHAIN_NAME   = process.env.NEXT_PUBLIC_CHAIN_NAME   || 'Base Sepolia';
export const RPC_URL      = process.env.NEXT_PUBLIC_RPC_URL      || 'https://sepolia.base.org';
export const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://sepolia.basescan.org';

// Contract addresses — env override supported with hardcoded testnet fallbacks
export const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS || '0x1745a2af322884FfDc6c9E98964A2A7d7D3CdF61';

// Protocol treasury & well-known addresses
export const TREASURY_WALLET = process.env.NEXT_PUBLIC_TREASURY_WALLET || '0x13f2c8c780E17db74F6Ae86Bc680D1e9B594202f';
export const WETH_ADDRESS    = process.env.NEXT_PUBLIC_WETH_ADDRESS    || '0x4200000000000000000000000000000000000006';

// Economic parameters (Whitepaper v6.0 — Native ETH model)
export const SOFT_CAP_ETH    = process.env.NEXT_PUBLIC_SOFT_CAP_ETH    || '15';
export const MAX_INVEST_ETH  = process.env.NEXT_PUBLIC_MAX_INVEST_ETH  || '0.15';
export const LISTING_FEE_ETH = process.env.NEXT_PUBLIC_LISTING_FEE_ETH || '0.01';
