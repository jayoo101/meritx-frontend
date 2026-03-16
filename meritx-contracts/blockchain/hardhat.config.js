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
      // Uncomment forking block for live Uniswap V3 simulation (requires archive RPC):
      // forking: {
      //   url: process.env.BASE_SEPOLIA_RPC || "https://base-sepolia-rpc.publicnode.com",
      // },
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
