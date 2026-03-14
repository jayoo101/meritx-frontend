/**
 * MeritX Protocol — Centralized ABI Definitions
 * Single source of truth for all contract interfaces.
 */

// MeritXFactory — read + write operations
export const FACTORY_ABI = [
  'function getAllProjects() view returns (address[])',
  'function platformTreasury() view returns (address)',
  'function backendSigner() view returns (address)',
  'function LISTING_FEE() view returns (uint256)',
  'function positionManager() view returns (address)',
  'function weth() view returns (address)',
  'function launchNewProject(string _name, string _symbol, string _ipfsURI) external payable returns (address)',
];

// MeritXFund — all read + write operations across the protocol
export const FUND_ABI = [
  // Identity & ownership
  'function projectToken() view returns (address)',
  'function projectOwner() view returns (address)',
  'function backendSigner() view returns (address)',
  // IPFS metadata
  'function ipfsURI() view returns (string)',
  // Funding state
  'function totalRaised() view returns (uint256)',
  'function SOFT_CAP() view returns (uint256)',
  'function MAX_ALLOCATION() view returns (uint256)',
  'function PLATFORM_FEE_PCT() view returns (uint256)',
  'function raiseEndTime() view returns (uint256)',
  'function currentState() view returns (uint8)',
  'function contributions(address) view returns (uint256)',
  'function isFinalized() view returns (bool)',
  // Launch timing
  'function LAUNCH_WINDOW() view returns (uint256)',
  'function LAUNCH_EXPIRATION() view returns (uint256)',
  'function PRE_LAUNCH_NOTICE() view returns (uint256)',
  'function launchAnnouncementTime() view returns (uint256)',
  // DEX / liquidity
  'function lpTokenId() view returns (uint256)',
  'function uniswapPool() view returns (address)',
  // Inflation engine
  'function initialTick() view returns (int24)',
  'function lastMintTime() view returns (uint256)',
  'function poolCreationTime() view returns (uint256)',
  'function MINT_COOLDOWN() view returns (uint256)',
  'function INITIAL_SUPPLY() view returns (uint256)',
  'function calculateTargetSupply(int24 tick) view returns (uint256)',
  'function getTWAP() view returns (int24)',
  // Write operations
  'function contribute(uint256 _maxAlloc, bytes _sig) external payable',
  'function claimTokens() external',
  'function claimRefund() external',
  'function announceLaunch() external',
  'function finalizeFunding() external',
  'function collectTradingFees() external',
  'function mintInflation() external',
  'function expandPoolObservation(uint16 nextCardinality) external',
];

// ERC-20 token reads
export const TOKEN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
];
