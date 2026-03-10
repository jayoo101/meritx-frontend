const hre = require("hardhat");

async function main() {
  const backendSigner    = process.env.BACKEND_SIGNER_ADDRESS;
  const positionManager  = process.env.UNISWAP_POSITION_MANAGER;
  const wethAddress      = process.env.WETH_ADDRESS;
  
  // Protocol Treasury wallet address
  const treasuryAddress  = "0x30ad89e5530467d076C7057ca8c92f077769e9e3";

  if (!backendSigner)   throw new Error("Set BACKEND_SIGNER_ADDRESS in .env");
  if (!positionManager) throw new Error("Set UNISWAP_POSITION_MANAGER in .env");
  if (!wethAddress)     throw new Error("Set WETH_ADDRESS in .env");

  console.log("Deploying MeritX v6.0 (Gap 3 — Protocol Owned Liquidity)...");
  console.log("  Backend signer   :", backendSigner);
  console.log("  Position Manager :", positionManager);
  console.log("  WETH             :", wethAddress);
  console.log("  Treasury Wallet  :", treasuryAddress);

  const MeritXFactory = await hre.ethers.getContractFactory("MeritXFactory");
  
  // Pass Protocol Treasury as the 4th constructor argument
  const factory = await MeritXFactory.deploy(backendSigner, positionManager, wethAddress, treasuryAddress);
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();

  console.log("\n✅ MeritXFactory deployed to:", factoryAddress);
  console.log("\n--- 🛡️ Post-deploy checklist ---");
  console.log("1. Set NEXT_PUBLIC_FACTORY_ADDRESS=" + factoryAddress + " in frontend .env.local");
  console.log("2. Set NEXT_PUBLIC_SIGNER_ADDRESS=" + backendSigner + " in frontend .env.local");
  console.log("3. Set NEXT_PUBLIC_TREASURY_WALLET=" + treasuryAddress + " in frontend .env.local");
  console.log("4. Restart the Next.js dev server to pick up new env vars");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});