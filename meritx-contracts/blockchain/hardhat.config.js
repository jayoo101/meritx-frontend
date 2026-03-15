require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 100 },
    },
  },
  networks: {
    hardhat: {
      forking: {
        url: process.env.BASE_SEPOLIA_RPC || "https://base-sepolia-rpc.publicnode.com",
        // Uncomment and pin a block for faster, cached re-runs:
        // blockNumber: 22000000,
      },
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC || "https://base-sepolia-rpc.publicnode.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      baseSepolia: process.env.BASESCAN_API_KEY || '',
    },
  },
  mocha: {
    timeout: 120_000,
  },
};
