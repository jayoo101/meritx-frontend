const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');

const app = express();
app.use(cors());
app.use(express.json());

// ================= 核心配置区 =================
const PRIVATE_KEY = "095d4044820d3ab2d9f4c6220f8b1852f96edfe5b700bf6e2b7fc2ca839fe31b";
const CHAIN_ID = 97;

// 预言机全局状态
let GLOBAL_MULTIPLIER = 1.0; 
let HIDDEN_PROJECTS = [];
const ADMIN_SECRET = "meritx-commander-2026"; 

// 🎯 新增：狙击手冷却数据库 (内存版)
const COOLDOWN_DB = {}; 
// ⚠️ 战术加速：白皮书是 48 小时，为了我们本地演习方便，先改成 3 分钟 (180000 毫秒)
const COOLDOWN_PERIOD = 3 * 60 * 1000; 
// ==============================================

// 1. 散户发证接口：/api/get-signature
app.get('/api/get-signature', async (req, res) => {
    try {
        const userAddress = req.query.address.toLowerCase();
        const targetFund = req.query.fund;
        
        if (!userAddress || !targetFund) {
            return res.status(400).json({ error: "参数缺失！" });
        }

        // 🚨 冷却拦截防线 (The 48h Conviction Cooldown)
        if (COOLDOWN_DB[userAddress]) {
            const timePassed = Date.now() - COOLDOWN_DB[userAddress];
            if (timePassed < COOLDOWN_PERIOD) {
                const remainingMins = Math.ceil((COOLDOWN_PERIOD - timePassed) / 1000 / 60);
                console.log(`🛡️ 拦截：狙击手 [${userAddress.slice(0,6)}] 处于冷却期，剩余 ${remainingMins} 分钟。`);
                return res.status(403).json({ 
                    success: false, 
                    error: "COOLDOWN_ACTIVE", 
                    message: `您的武器正在冷却中！还需等待 ${remainingMins} 分钟。` 
                });
            }
        }

        // ⛽ 新增：模拟 PoHG EVM 历史 Gas 计算 (根据地址生成 10 ~ 200 之间的固定值)
        const hash = ethers.id(userAddress);
        const simulatedGasPoHG = (parseInt(hash.slice(-4), 16) % 191) + 10; 
        
        // 计算最终额度 = PoHG基础值 * 指挥官预言机系数
        const finalAllocation = Math.floor(simulatedGasPoHG * GLOBAL_MULTIPLIER);
        
        const maxAllocationWei = ethers.parseUnits(finalAllocation.toString(), 18);
        const maxAllocationStr = maxAllocationWei.toString();

        const wallet = new ethers.Wallet(PRIVATE_KEY);
        const messageHash = ethers.solidityPackedKeccak256(
            ["address", "uint256", "address", "uint256"],
            [userAddress, maxAllocationWei, targetFund, CHAIN_ID]
        );
        const messageBytes = ethers.getBytes(messageHash);
        const signature = await wallet.signMessage(messageBytes);

        console.log(`🎯 签发 | 狙击手: [${userAddress.slice(0,6)}...] | PoHG计算: ${simulatedGasPoHG} | 系数: ${GLOBAL_MULTIPLIER}x | 最终额度: ${finalAllocation} USDT`);

        res.json({
            success: true,
            data: { userAddress, maxAllocation: maxAllocationStr, signature, finalAllocation }
        });

    } catch (error) {
        console.error("❌ 签名生成失败:", error);
        res.status(500).json({ success: false, error: "服务器内部错误" });
    }
});

// 2. 🎯 新增：登记开火记录 (打款成功后由前端调用)
app.post('/api/record-sniping', (req, res) => {
    const { address } = req.body;
    if (address) {
        COOLDOWN_DB[address.toLowerCase()] = Date.now();
        console.log(`🔥 记录：狙击手 [${address.slice(0,6)}...] 投资成功，已进入全局冷却舱！`);
        res.json({ success: true });
    } else {
        res.status(400).json({ success: false });
    }
});

// --- 后台管理接口保留 ---
app.post('/api/admin/set-multiplier', (req, res) => { /* 略去内部逻辑，与之前一致 */
    const { multiplier, secret } = req.body;
    if (secret !== ADMIN_SECRET) return res.status(403).json({ success: false });
    GLOBAL_MULTIPLIER = parseFloat(multiplier);
    res.json({ success: true, newMultiplier: GLOBAL_MULTIPLIER });
});
app.get('/api/admin/get-multiplier', (req, res) => { res.json({ success: true, multiplier: GLOBAL_MULTIPLIER }); });
app.get('/api/projects/hidden', (req, res) => { res.json({ success: true, hiddenProjects: HIDDEN_PROJECTS }); });
app.post('/api/admin/toggle-hide', (req, res) => {
    const { address, secret } = req.body;
    if (secret !== ADMIN_SECRET) return res.status(403).json({ success: false });
    const idx = HIDDEN_PROJECTS.indexOf(address);
    if (idx > -1) HIDDEN_PROJECTS.splice(idx, 1);
    else HIDDEN_PROJECTS.push(address);
    res.json({ success: true, hiddenProjects: HIDDEN_PROJECTS });
});

const PORT = 4000;
app.listen(PORT, () => {
    console.log(`\n🚀 ==========================================`);
    console.log(`🔥 MeritX PoHG & Cooldown 引擎已挂载！`);
    console.log(`📡 发证局监听端口: http://localhost:${PORT}`);
    console.log(`========================================== 🚀`);
});