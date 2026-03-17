const hre = require("hardhat");

async function main() {
  console.log("[PoG] Initiating Deployment...");

  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer/Owner: ${deployer.address}`);

  const backendPrivateKey = process.env.BACKEND_PRIVATE_KEY_FOR_POG;
  if (!backendPrivateKey) throw new Error("Missing BACKEND_PRIVATE_KEY_FOR_POG");
  const signerAddress = new hre.ethers.Wallet(backendPrivateKey).address;
  console.log(`Backend Signer: ${signerAddress}`);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://meritx-pog.vercel.app";
  const baseURI = `${siteUrl}/api/pog/meta/`;
  console.log(`Base Metadata URI: ${baseURI}`);

  const ProofOfGasNFT = await hre.ethers.getContractFactory("ProofOfGasNFT");
  console.log("Deploying ProofOfGasNFT (signer, baseURI, owner)...");
  
  const pogNFT = await ProofOfGasNFT.deploy(
    signerAddress,  // _signer
    baseURI,        // _baseURI
    deployer.address // _owner
  );

  await pogNFT.waitForDeployment();
  const contractAddress = await pogNFT.getAddress();
  console.log(`ProofOfGasNFT deployed to: ${contractAddress}`);

  console.log("Triggering startCampaign()...");
  const tx = await pogNFT.startCampaign();
  await tx.wait();
  
  const endTime = await pogNFT.endTime();
  console.log(`Campaign LIVE — ends at: ${new Date(Number(endTime) * 1000).toLocaleString()}`);

  console.log("\n=================================================");
  console.log(`NEXT_PUBLIC_POG_NFT_ADDRESS=${contractAddress}`);
  console.log("=================================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});