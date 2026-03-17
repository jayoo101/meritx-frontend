const hre = require("hardhat");

async function main() {
  const pogAddress = process.env.NEXT_PUBLIC_POG_NFT_ADDRESS;
  if (!pogAddress) throw new Error("Missing NEXT_PUBLIC_POG_NFT_ADDRESS");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) throw new Error("Missing NEXT_PUBLIC_SITE_URL — set it to your Vercel deployment URL");

  const newBaseURI = `${siteUrl}/api/pog/meta/`;

  const [deployer] = await hre.ethers.getSigners();
  console.log(`Caller: ${deployer.address}`);

  const abi = [
    "function baseMetadataURI() view returns (string)",
    "function setBaseMetadataURI(string memory _uri) external",
  ];
  const contract = new hre.ethers.Contract(pogAddress, abi, deployer);

  const currentURI = await contract.baseMetadataURI();
  console.log(`Current baseMetadataURI: ${currentURI}`);
  console.log(`New baseMetadataURI:     ${newBaseURI}`);

  if (currentURI === newBaseURI) {
    console.log("URI already matches — no update needed.");
    return;
  }

  const tx = await contract.setBaseMetadataURI(newBaseURI);
  await tx.wait();
  console.log(`Updated baseMetadataURI to: ${newBaseURI}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
