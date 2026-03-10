const hre = require("hardhat");

async function main() {
  console.log("\n> [INIT] Bootstrapping MeritX Protocol on Base L2...");
  
  // 获取部署者账户
  const [deployer] = await hre.ethers.getSigners();
  console.log(`> [AUTH] Commander Address: ${deployer.address}`);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`> [GAS] Current Balance: ${hre.ethers.formatEther(balance)} ETH\n`);

  // 🚀 获取工厂合约
  // 注意：如果你的合约名不是 Factory，请把下面引号里的内容改掉
  const Factory = await hre.ethers.getContractFactory("Factory"); 
  
  console.log("> [EXEC] Deploying Agent Factory State Machine...");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  
  console.log(`\n======================================================`);
  console.log(`✅ [SUCCESS] MERITX FACTORY DEPLOYED TO BASE SEPOLIA`);
  console.log(`======================================================`);
  console.log(`📍 Contract Address: ${factoryAddress}`);
  console.log(`🔍 View on BaseScan: https://sepolia.basescan.org/address/${factoryAddress}\n`);

  // 等待 5 个区块确认，确保 BaseScan 索引完成
  console.log("> [WAIT] Waiting for 5 block confirmations before verification...");
  const deploymentTransaction = factory.deploymentTransaction();
  await deploymentTransaction.wait(5);

  console.log("> [EXEC] Verifying Source Code on BaseScan...");
  try {
    await hre.run("verify:verify", {
      address: factoryAddress,
      constructorArguments: [],
    });
    console.log("> [SUCCESS] Code fully verified and open-sourced! 🟢");
  } catch (error) {
    console.log("> [WARN] Verification failed or already verified:", error.message);
  }
}

main().catch((error) => {
  console.error("> [FATAL] Deployment Sequence Aborted:", error);
  process.exitCode = 1;
});