const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

/*
 * MeritX v6.6 — Full Lifecycle Integration Test (24h Launch Expiration)
 *
 * Runs against a Hardhat fork of Base Sepolia so the real Uniswap V3
 * NonfungiblePositionManager and WETH pre-deploy are available.
 *
 * v6.6 features tested:
 *   - Chain-specific PoHG signatures (anti-replay via block.chainid)
 *   - Owner-restricted finalizeFunding()
 *   - 30-day launch window (prevents zombie projects)
 *   - Anti-stealth launch: announceLaunch() + 6-hour PRE_LAUNCH_NOTICE
 *   - Two-step finalization: announce → wait 6h → finalize
 *   - 24-hour LAUNCH_EXPIRATION after notice period
 *   - Refund path when owner fails to finalize within the window
 *   - Refund path when 24h post-notice execution window expires
 *
 * Lifecycle:
 *   Deploy Factory → Launch Project → PoHG Contribute → Time-Travel
 *   → Announce Launch → Wait 6h → Finalize (Uniswap V3 pool + LP lock)
 *   → Claim Tokens → Fee Collection → Inflation Engine verification
 *
 * Separate paths:
 *   Launch → (below soft cap) → Time-Travel → Failed → Refund
 *   Launch → Contribute → Time-Travel past 30-day window → Expired → Refund
 *   Launch → Contribute → Announce → 6h notice → 24h expired → Refund
 */

// ---- Base Sepolia live addresses (available via fork) ----
const POSITION_MANAGER = "0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2";
const WETH = "0x4200000000000000000000000000000000000006";

// Deterministic test-only signer key (NOT a Hardhat default account)
const BACKEND_SIGNER_PK =
  "0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef";

// ---- Helpers ----

async function signAllocation(wallet, userAddress, maxAlloc, fundAddress, chainId) {
  const hash = ethers.solidityPackedKeccak256(
    ["address", "uint256", "address", "uint256"],
    [userAddress, maxAlloc, fundAddress, chainId]
  );
  return wallet.signMessage(ethers.getBytes(hash));
}

// ---- Test Suite ----

describe("MeritX v6.6 — Full Lifecycle Integration (24h Launch Expiration)", function () {
  let factory, fundAddr, fund, token;
  let deployer, user1, user2;
  let signerWallet;
  let chainId;

  before(async function () {
    [deployer, user1, user2] = await ethers.getSigners();
    signerWallet = new ethers.Wallet(BACKEND_SIGNER_PK);

    const network = await ethers.provider.getNetwork();
    chainId = network.chainId;

    const Factory = await ethers.getContractFactory("MeritXFactory");
    factory = await Factory.deploy(
      signerWallet.address,
      POSITION_MANAGER,
      WETH
    );
    await factory.waitForDeployment();
  });

  // ================================================================
  //  PHASE 1 — Project Launch
  // ================================================================
  describe("Phase 1 — Project Launch", function () {
    it("deploys a new MeritXFund + MeritXToken via Factory", async function () {
      const tx = await factory.launchNewProject("TestAgent", "TAGT");
      await tx.wait();

      const projects = await factory.getAllProjects();
      expect(projects.length).to.equal(1);
      fundAddr = projects[0];

      fund = await ethers.getContractAt("MeritXFund", fundAddr);
      const tokenAddr = await fund.projectToken();
      token = await ethers.getContractAt("MeritXToken", tokenAddr);

      expect(await token.name()).to.equal("TestAgent");
      expect(await token.symbol()).to.equal("TAGT");
      expect(await token.minter()).to.equal(fundAddr);
    });

    it("starts in Funding state (0)", async function () {
      expect(await fund.currentState()).to.equal(0);
    });

    it("records correct immutables", async function () {
      expect(await fund.platformTreasury()).to.equal(deployer.address);
      expect(await fund.backendSigner()).to.equal(signerWallet.address);
      expect(await fund.positionManager()).to.equal(POSITION_MANAGER);
      expect(await fund.weth()).to.equal(WETH);
    });
  });

  // ================================================================
  //  PHASE 2 — PoHG Contribution
  // ================================================================
  describe("Phase 2 — PoHG Contribution", function () {
    const MAX_ALLOC = ethers.parseEther("0.006");

    it("accepts a valid signed contribution", async function () {
      const amt = ethers.parseEther("0.001"); // = SOFT_CAP
      const sig = await signAllocation(
        signerWallet,
        user1.address,
        MAX_ALLOC,
        fundAddr,
        chainId
      );

      await fund.connect(user1).contribute(MAX_ALLOC, sig, { value: amt });

      expect(await fund.contributions(user1.address)).to.equal(amt);
      expect(await fund.totalRaised()).to.equal(amt);
    });

    it("rejects a forged signature", async function () {
      const fakeWallet = ethers.Wallet.createRandom();
      const sig = await signAllocation(
        fakeWallet,
        user2.address,
        MAX_ALLOC,
        fundAddr,
        chainId
      );

      await expect(
        fund
          .connect(user2)
          .contribute(MAX_ALLOC, sig, { value: ethers.parseEther("0.001") })
      ).to.be.revertedWith("!sig");
    });

    it("rejects maxAlloc above MAX_ALLOCATION ceiling", async function () {
      const overAlloc = ethers.parseEther("0.007");
      const sig = await signAllocation(
        signerWallet,
        user2.address,
        overAlloc,
        fundAddr,
        chainId
      );

      await expect(
        fund
          .connect(user2)
          .contribute(overAlloc, sig, { value: ethers.parseEther("0.001") })
      ).to.be.revertedWith("!ceil");
    });

    it("rejects contributions that would exceed the signed allocation", async function () {
      const sig = await signAllocation(
        signerWallet,
        user1.address,
        MAX_ALLOC,
        fundAddr,
        chainId
      );
      // user1 already contributed 0.001; 0.006 more would total 0.007 > MAX_ALLOC
      await expect(
        fund
          .connect(user1)
          .contribute(MAX_ALLOC, sig, { value: ethers.parseEther("0.006") })
      ).to.be.revertedWith("!alloc");
    });
  });

  // ================================================================
  //  PHASE 3 — Anti-Stealth Launch + Finalization (The Black Hole)
  // ================================================================
  describe("Phase 3 — Announcement + Time Travel + Finalization", function () {
    it("rejects finalization without announcement", async function () {
      await expect(fund.finalizeFunding()).to.be.revertedWith("6h notice required");
    });

    it("rejects announcement while still in raise period", async function () {
      await expect(fund.announceLaunch()).to.be.revertedWith("!iso");
    });

    it("transitions to Success_Isolated (2) after raise ends", async function () {
      await time.increase(301);
      expect(await fund.currentState()).to.equal(2);
    });

    it("rejects announcement from a non-owner", async function () {
      await expect(
        fund.connect(user1).announceLaunch()
      ).to.be.revertedWith("!owner");
    });

    it("announces launch successfully", async function () {
      const tx = await fund.announceLaunch();
      await tx.wait();
      expect(await fund.launchAnnouncementTime()).to.be.greaterThan(0n);
    });

    it("rejects double announcement", async function () {
      await expect(fund.announceLaunch()).to.be.revertedWith("Already announced");
    });

    it("rejects finalization during the 6-hour notice period", async function () {
      await expect(fund.finalizeFunding()).to.be.revertedWith("6h notice required");
    });

    it("rejects finalization from a non-owner (even after notice would elapse)", async function () {
      await expect(
        fund.connect(user1).finalizeFunding()
      ).to.be.revertedWith("!owner");
    });

    it("advances past the 6-hour notice period", async function () {
      const PRE_LAUNCH = 6 * 60 * 60; // 6 hours in seconds
      await time.increase(PRE_LAUNCH + 1);
    });

    it("finalizes and creates Uniswap V3 pool after notice ends", async function () {
      const tx = await fund.finalizeFunding();
      const receipt = await tx.wait();

      expect(await fund.isFinalized()).to.be.true;
      expect(await fund.currentState()).to.equal(3);

      console.log(
        "      Gas used:",
        receipt.gasUsed.toString(),
        "units"
      );
    });

    it("has a valid LP NFT token ID and pool address", async function () {
      const lpId = await fund.lpTokenId();
      const pool = await fund.uniswapPool();
      const tick = await fund.initialTick();

      expect(lpId).to.be.greaterThan(0n);
      expect(pool).to.not.equal(ethers.ZeroAddress);

      console.log("      LP Token ID :", lpId.toString());
      console.log("      Uniswap Pool:", pool);
      console.log("      Initial tick :", tick.toString());
    });

    it("rejects double finalization", async function () {
      await expect(fund.finalizeFunding()).to.be.revertedWith("!done");
    });
  });

  // ================================================================
  //  PHASE 4 — Post-Finalization Verification
  // ================================================================
  describe("Phase 4 — Post-Finalization Checks", function () {
    it("lets contributors claim their PoP tokens", async function () {
      expect(await token.balanceOf(user1.address)).to.equal(0n);

      await fund.connect(user1).claimTokens();

      const bal = await token.balanceOf(user1.address);
      expect(bal).to.be.greaterThan(0n);
      console.log(
        "      User1 claimed:",
        ethers.formatEther(bal),
        "tokens"
      );
    });

    it("rejects double claim", async function () {
      await expect(fund.connect(user1).claimTokens()).to.be.revertedWith(
        "!contrib"
      );
    });

    it("calculateTargetSupply(initialTick) returns INITIAL_SUPPLY", async function () {
      const tick = await fund.initialTick();
      const target = await fund.calculateTargetSupply(tick);
      expect(target).to.equal(await fund.INITIAL_SUPPLY());
    });

    it("allows treasury to collect trading fees", async function () {
      // No trades yet so fees are zero, but the call must succeed
      await expect(
        fund.connect(deployer).collectTradingFees()
      ).to.not.be.reverted;
    });

    it("rejects fee collection from non-treasury", async function () {
      await expect(
        fund.connect(user1).collectTradingFees()
      ).to.be.revertedWith("!treasury");
    });
  });

  // ================================================================
  //  PHASE 5 — Refund Path (separate project, soft cap NOT met)
  // ================================================================
  describe("Phase 5 — Refund Path", function () {
    let fund2Addr, fund2;
    const MAX_ALLOC = ethers.parseEther("0.006");
    const SMALL_AMT = ethers.parseEther("0.0005"); // < SOFT_CAP (0.001)

    it("launches a second project", async function () {
      const tx = await factory.launchNewProject("FailAgent", "FAIL");
      await tx.wait();

      const projects = await factory.getAllProjects();
      fund2Addr = projects[projects.length - 1];
      fund2 = await ethers.getContractAt("MeritXFund", fund2Addr);
      expect(await fund2.currentState()).to.equal(0);
    });

    it("accepts a contribution below the soft cap", async function () {
      const sig = await signAllocation(
        signerWallet,
        user2.address,
        MAX_ALLOC,
        fund2Addr,
        chainId
      );

      await fund2.connect(user2).contribute(MAX_ALLOC, sig, {
        value: SMALL_AMT,
      });

      expect(await fund2.totalRaised()).to.equal(SMALL_AMT);
    });

    it("enters Failed state (1) after raise deadline", async function () {
      await time.increase(301);
      expect(await fund2.currentState()).to.equal(1);
    });

    it("rejects contributions after deadline", async function () {
      const sig = await signAllocation(
        signerWallet,
        user1.address,
        MAX_ALLOC,
        fund2Addr,
        chainId
      );

      await expect(
        fund2
          .connect(user1)
          .contribute(MAX_ALLOC, sig, { value: ethers.parseEther("0.001") })
      ).to.be.revertedWith("!time");
    });

    it("rejects finalization on a failed project (no announcement possible)", async function () {
      await time.increase(301);
      // announceLaunch also fails because soft cap not met
      await expect(fund2.announceLaunch()).to.be.revertedWith("!cap");
      // finalizeFunding fails because no announcement was made
      await expect(fund2.finalizeFunding()).to.be.revertedWith("6h notice required");
    });

    it("lets the contributor claim a full ETH refund", async function () {
      const balBefore = await ethers.provider.getBalance(user2.address);

      const tx = await fund2.connect(user2).claimRefund();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const balAfter = await ethers.provider.getBalance(user2.address);

      // balAfter should be balBefore + SMALL_AMT - gasCost
      expect(balAfter).to.equal(balBefore + SMALL_AMT - gasCost);
      expect(await fund2.contributions(user2.address)).to.equal(0n);
    });

    it("rejects double refund", async function () {
      await expect(
        fund2.connect(user2).claimRefund()
      ).to.be.revertedWith("!funds");
    });
  });

  // ================================================================
  //  PHASE 6 — Launch Window (30-day deadline + expired refund)
  // ================================================================
  describe("Phase 6 — Launch Window & Expired Refund", function () {
    let fund3Addr, fund3;
    const MAX_ALLOC = ethers.parseEther("0.006");
    const CONTRIB = ethers.parseEther("0.001");

    it("launches a third project for deadline testing", async function () {
      const tx = await factory.launchNewProject("DeadlineAgent", "DEAD");
      await tx.wait();

      const projects = await factory.getAllProjects();
      fund3Addr = projects[projects.length - 1];
      fund3 = await ethers.getContractAt("MeritXFund", fund3Addr);
      expect(await fund3.currentState()).to.equal(0);
    });

    it("contributes enough to meet the soft cap", async function () {
      const sig = await signAllocation(
        signerWallet,
        user1.address,
        MAX_ALLOC,
        fund3Addr,
        chainId
      );

      await fund3.connect(user1).contribute(MAX_ALLOC, sig, {
        value: CONTRIB,
      });
      expect(await fund3.totalRaised()).to.equal(CONTRIB);
    });

    it("rejects refund while the launch window is still open", async function () {
      // Advance past raise but stay inside the 30-day window
      await time.increase(301);
      expect(await fund3.currentState()).to.equal(2);
      await expect(
        fund3.connect(user1).claimRefund()
      ).to.be.revertedWith("Refund not available");
    });

    it("announces launch, then lets the 30-day window expire", async function () {
      // Owner announces launch while window is still open
      await fund3.announceLaunch();
      expect(await fund3.launchAnnouncementTime()).to.be.greaterThan(0n);
      // Advance past both the 6h notice AND the remaining 30-day window
      await time.increase(30 * 24 * 60 * 60);
    });

    it("rejects finalization after the 30-day window expires", async function () {
      // 24h expiration check fires before the 30-day global check
      await expect(fund3.finalizeFunding()).to.be.revertedWith("Launch expired after notice");
    });

    it("lets contributor claim a refund on an expired successful project", async function () {
      const balBefore = await ethers.provider.getBalance(user1.address);

      const tx = await fund3.connect(user1).claimRefund();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const balAfter = await ethers.provider.getBalance(user1.address);
      expect(balAfter).to.equal(balBefore + CONTRIB - gasCost);
      expect(await fund3.contributions(user1.address)).to.equal(0n);
    });

    it("rejects double refund on expired project", async function () {
      await expect(
        fund3.connect(user1).claimRefund()
      ).to.be.revertedWith("!funds");
    });
  });

  // ================================================================
  //  PHASE 7 — 24h Launch Expiration (announce → notice → 24h expires)
  // ================================================================
  describe("Phase 7 — 24h Post-Notice Expiration & Refund", function () {
    let fund4Addr, fund4;
    const MAX_ALLOC = ethers.parseEther("0.006");
    const CONTRIB = ethers.parseEther("0.001");

    it("launches a fourth project for 24h expiration testing", async function () {
      const tx = await factory.launchNewProject("ExpireAgent", "EXPR");
      await tx.wait();

      const projects = await factory.getAllProjects();
      fund4Addr = projects[projects.length - 1];
      fund4 = await ethers.getContractAt("MeritXFund", fund4Addr);
      expect(await fund4.currentState()).to.equal(0);
    });

    it("contributes enough to meet the soft cap", async function () {
      const sig = await signAllocation(
        signerWallet,
        user2.address,
        MAX_ALLOC,
        fund4Addr,
        chainId
      );

      await fund4.connect(user2).contribute(MAX_ALLOC, sig, {
        value: CONTRIB,
      });
      expect(await fund4.totalRaised()).to.equal(CONTRIB);
    });

    it("advances past raise end", async function () {
      await time.increase(301);
      expect(await fund4.currentState()).to.equal(2);
    });

    it("announces launch", async function () {
      await fund4.announceLaunch();
      expect(await fund4.launchAnnouncementTime()).to.be.greaterThan(0n);
    });

    it("rejects refund while notice + execution window is still active", async function () {
      await expect(
        fund4.connect(user2).claimRefund()
      ).to.be.revertedWith("Refund not available");
    });

    it("advances past the 6-hour notice period", async function () {
      const PRE_LAUNCH = 6 * 60 * 60;
      await time.increase(PRE_LAUNCH + 1);
    });

    it("still rejects refund within the 24h execution window", async function () {
      await expect(
        fund4.connect(user2).claimRefund()
      ).to.be.revertedWith("Refund not available");
    });

    it("advances past the 24-hour execution window", async function () {
      const LAUNCH_EXP = 24 * 60 * 60;
      await time.increase(LAUNCH_EXP);
    });

    it("rejects finalization after the 24h window expires", async function () {
      await expect(fund4.finalizeFunding()).to.be.revertedWith("Launch expired after notice");
    });

    it("allows refund after 24h post-notice window expires", async function () {
      const balBefore = await ethers.provider.getBalance(user2.address);

      const tx = await fund4.connect(user2).claimRefund();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const balAfter = await ethers.provider.getBalance(user2.address);
      expect(balAfter).to.equal(balBefore + CONTRIB - gasCost);
      expect(await fund4.contributions(user2.address)).to.equal(0n);
    });

    it("rejects double refund", async function () {
      await expect(
        fund4.connect(user2).claimRefund()
      ).to.be.revertedWith("!funds");
    });

    it("confirms LAUNCH_EXPIRATION constant is 24 hours", async function () {
      expect(await fund4.LAUNCH_EXPIRATION()).to.equal(24n * 60n * 60n);
    });
  });
});
