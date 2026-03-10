const { ethers } = require("ethers");

// ==========================================
// MeritX PoHG 终极签名机 (后端 API 核心)
// ==========================================

async function generateMeritXSignature() {
    // 1. 配置你的“上帝私钥” (注意：绝不能泄露给任何人！)
    // 这个私钥对应的钱包地址，必须是你部署 Factory 时填入的 signerWallet！
    const privateKey = "095d4044820d3ab2d9f4c6220f8b1852f96edfe5b700bf6e2b7fc2ca839fe31b"; 
    const wallet = new ethers.Wallet(privateKey);
    console.log("🔐 签名机已启动，发证官地址:", wallet.address);

    // 2. 模拟前端传来的散户打款请求数据
    const userAddress = "0x676981f9e4422e3016b6f0e7128daD2E396d2336"; // 比如你自己测试用的钱包地址
    const maxAllocationWei = ethers.parseUnits("50000", 18); // 散户的 PoHG 额度，比如 50000 U
    const fundAddress = "0x76faAE11646a02fF51ebf848e6F1344E0dc1880C";
    const chainId = 97; // BSC 测试网的 Chain ID 是 97

    // 3. 核心密码学：完美复刻智能合约的 abi.encodePacked
    // 对应合约里的：keccak256(abi.encodePacked(msg.sender, maxAllocation, address(this), block.chainid))
    const messageHash = ethers.solidityPackedKeccak256(
        ["address", "uint256", "address", "uint256"],
        [userAddress, maxAllocationWei, fundAddress, chainId]
    );

    // 4. Ethers.js 的 signMessage 会自动在底层加上 "\x19Ethereum Signed Message:\n32" 的前缀
    const messageBytes = ethers.getBytes(messageHash);
    const signature = await wallet.signMessage(messageBytes);

    console.log("\n✅ 签名生成成功！散户专属通行证：");
    console.log("--------------------------------------------------");
    console.log("Signature:", signature);
    console.log("--------------------------------------------------");
    console.log("散户现在可以拿着这串代码，去调用合约的 contribute 函数了！");
}

generateMeritXSignature().catch(console.error);