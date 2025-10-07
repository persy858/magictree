import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("MagicTreeMock (Local Testing)", function () {
  let magicTree;
  let magicToken;
  let owner;
  let addr1;
  let addr2;
  let addr3;

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    
    // 1. 部署 MagicToken
    const MagicToken = await ethers.getContractFactory("MagicToken");
    magicToken = await MagicToken.deploy();
    
    // 2. 部署 MagicTreeMock（用于本地测试）
    // 注意：真实部署时使用 MagicTreeFHE
    const MagicTreeMock = await ethers.getContractFactory("MagicTreeMock");
    magicTree = await MagicTreeMock.deploy(await magicToken.getAddress());
    
    // 3. 设置 minter
    await magicToken.setMinter(await magicTree.getAddress());
  });

  describe("部署", function () {
    it("应该正确设置合约所有者", async function () {
      expect(await magicTree.owner()).to.equal(owner.address);
    });

    it("应该设置正确的 mint 价格", async function () {
      expect(await magicTree.MINT_PRICE()).to.equal(ethers.parseEther("0.01"));
    });

    it("应该正确设置代币合约地址", async function () {
      expect(await magicTree.magicToken()).to.equal(await magicToken.getAddress());
    });

    it("应该正确设置代币总供应量", async function () {
      expect(await magicTree.TOTAL_TOKEN_SUPPLY()).to.equal(ethers.parseEther("100000000"));
    });
  });

  describe("MagicToken - Minter 设置", function () {
    it("应该正确设置 minter", async function () {
      expect(await magicToken.minter()).to.equal(await magicTree.getAddress());
    });

    it("应该标记 minter 已设置", async function () {
      expect(await magicToken.minterSet()).to.equal(true);
    });

    it("应该拒绝重复设置 minter", async function () {
      await expect(
        magicToken.setMinter(addr1.address)
      ).to.be.reverted;
    });
  });

  describe("Mint 神树", function () {
    it("应该能够 mint 神树", async function () {
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      const treeInfo = await magicTree.getTreeInfo(addr1.address);
      expect(treeInfo.exists).to.equal(true);
      expect(treeInfo.fertilizeCount).to.equal(0);
      expect(treeInfo.fruits).to.equal(0);
      // 🔥 FHE版本：points 是加密handle，不再检查为0
    });

    it("应该拒绝错误的 ETH 金额", async function () {
      await expect(
        magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.005") })
      ).to.be.revertedWith("Incorrect ETH amount");
    });

    it("应该拒绝重复 mint", async function () {
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      await expect(
        magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") })
      ).to.be.revertedWith("Tree already exists");
    });

    it("应该触发 TreeMinted 事件", async function () {
      await expect(
        magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") })
      ).to.emit(magicTree, "TreeMinted");
    });

    it("应该增加玩家总数", async function () {
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      expect(await magicTree.getTotalPlayers()).to.equal(1);
      
      await magicTree.connect(addr2).mintTree({ value: ethers.parseEther("0.01") });
      expect(await magicTree.getTotalPlayers()).to.equal(2);
    });
  });

  describe("施肥", function () {
    beforeEach(async function () {
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
    });

    it("应该能够施肥", async function () {
      await magicTree.connect(addr1).fertilize();
      const treeInfo = await magicTree.getTreeInfo(addr1.address);
      expect(treeInfo.fertilizeCount).to.equal(1);
    });

    it("应该在冷却时间内拒绝施肥", async function () {
      await magicTree.connect(addr1).fertilize();
      await expect(
        magicTree.connect(addr1).fertilize()
      ).to.be.revertedWith("Cooldown not finished");
    });

    it("应该在冷却后允许施肥", async function () {
      await magicTree.connect(addr1).fertilize();
      await time.increase(31);
      await magicTree.connect(addr1).fertilize();
      const treeInfo = await magicTree.getTreeInfo(addr1.address);
      expect(treeInfo.fertilizeCount).to.equal(2);
    });

    it("施肥 5 次后应该产生果实", async function () {
      await magicTree.connect(addr1).fertilize();
      for (let i = 1; i < 5; i++) {
        await time.increase(31);
        await magicTree.connect(addr1).fertilize();
      }
      const treeInfo = await magicTree.getTreeInfo(addr1.address);
      expect(treeInfo.fertilizeCount).to.equal(5);
      expect(treeInfo.fruits).to.equal(1);
    });
  });

  describe("采摘果实（Mock版本）", function () {
    beforeEach(async function () {
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      await magicTree.connect(addr1).fertilize();
      for (let i = 1; i < 5; i++) {
        await time.increase(31);
        await magicTree.connect(addr1).fertilize();
      }
    });

    it("应该能够采摘果实", async function () {
      await magicTree.connect(addr1).harvestFruit();
      const treeInfo = await magicTree.getTreeInfo(addr1.address);
      expect(treeInfo.fruits).to.equal(0);
    });

    it("应该增加积分（Mock版本使用明文）", async function () {
      const treeBefore = await magicTree.getTreeInfo(addr1.address);
      expect(treeBefore.encryptedPoints).to.equal(0);
      
      await magicTree.connect(addr1).harvestFruit();
      
      const treeAfter = await magicTree.getTreeInfo(addr1.address);
      // Mock版本：积分应该在100-500之间
      expect(treeAfter.encryptedPoints).to.be.gte(100);
      expect(treeAfter.encryptedPoints).to.be.lte(500);
      
      console.log("      Points gained:", treeAfter.encryptedPoints.toString());
    });

    it("应该拒绝无果实时采摘", async function () {
      await magicTree.connect(addr1).harvestFruit();
      await expect(
        magicTree.connect(addr1).harvestFruit()
      ).to.be.revertedWith("No fruits to harvest");
    });

    it("FruitDecomposed事件不应包含积分", async function () {
      await expect(
        magicTree.connect(addr1).harvestFruit()
      ).to.emit(magicTree, "FruitDecomposed")
        .withArgs(addr1.address, await time.latest() + 1);
    });
  });

  describe("代币兑换 - 动态比例", function () {
    it("0-499 玩家时比例应该是 1:1", async function () {
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      expect(await magicTree.getCurrentExchangeRate()).to.equal(1);
    });

    it("比例应该随玩家数量增加", async function () {
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      const rate1 = await magicTree.getCurrentExchangeRate();
      
      await magicTree.connect(addr2).mintTree({ value: ethers.parseEther("0.01") });
      await magicTree.connect(addr3).mintTree({ value: ethers.parseEther("0.01") });
      
      const rate2 = await magicTree.getCurrentExchangeRate();
      
      // 在少量玩家情况下，比例应该相同（都是 tier 0）
      expect(rate1).to.equal(rate2);
    });
  });

  describe("代币兑换 - Mock版本", function () {
    beforeEach(async function () {
      // addr1 mint 神树并获得积分
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      
      // 施肥 5 次获得 1 个果实
      await magicTree.connect(addr1).fertilize();
      for (let i = 1; i < 5; i++) {
        await time.increase(31);
        await magicTree.connect(addr1).fertilize();
      }
      
      // 采摘果实获得积分
      await time.increase(31);
      await magicTree.connect(addr1).harvestFruit();
    });

    it("应该能够成功兑换代币", async function () {
      const treeInfo = await magicTree.getTreeInfo(addr1.address);
      const points = treeInfo.encryptedPoints;
      const pointsToSpend = points / 2n; // 花费一半积分
      
      const rate = await magicTree.getCurrentExchangeRate();
      const expectedTokens = (pointsToSpend * ethers.parseEther("1")) / rate;
      
      await magicTree.connect(addr1).redeemTokens(pointsToSpend);
      
      // 验证积分减少
      const treeAfter = await magicTree.getTreeInfo(addr1.address);
      expect(treeAfter.encryptedPoints).to.equal(points - pointsToSpend);
      
      // 验证代币增加
      const tokenBalance = await magicToken.balanceOf(addr1.address);
      expect(tokenBalance).to.equal(expectedTokens);
      
      console.log("      Points spent:", pointsToSpend.toString());
      console.log("      Tokens received:", ethers.formatEther(tokenBalance));
    });

    it("应该拒绝积分不足的兑换", async function () {
      const treeInfo = await magicTree.getTreeInfo(addr1.address);
      const points = treeInfo.encryptedPoints;
      
      await expect(
        magicTree.connect(addr1).redeemTokens(points + 100n)
      ).to.be.revertedWith("Insufficient points");
    });

    it("应该触发TokensRedeemed事件", async function () {
      const treeInfo = await magicTree.getTreeInfo(addr1.address);
      const pointsToSpend = 100n;
      
      await expect(
        magicTree.connect(addr1).redeemTokens(pointsToSpend)
      ).to.emit(magicTree, "TokensRedeemed");
    });

    it("应该拒绝0积分的兑换", async function () {
      await expect(
        magicTree.connect(addr1).redeemTokens(0)
      ).to.be.revertedWith("Points must be greater than 0");
    });
  });

  describe("排行榜（Mock版本可用）", function () {
    it("初始状态应该没有玩家", async function () {
      const totalPlayers = await magicTree.getTotalPlayers();
      expect(totalPlayers).to.equal(0);
    });

    it("应该返回排序后的排行榜", async function () {
      // 创建多个玩家
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      await magicTree.connect(addr2).mintTree({ value: ethers.parseEther("0.01") });
      await magicTree.connect(addr3).mintTree({ value: ethers.parseEther("0.01") });
      
      // addr1 获得1个果实
      await magicTree.connect(addr1).fertilize();
      for (let i = 1; i < 5; i++) {
        await time.increase(31);
        await magicTree.connect(addr1).fertilize();
      }
      await time.increase(31);
      await magicTree.connect(addr1).harvestFruit();
      
      // addr2 获得2个果实（更多积分）
      await magicTree.connect(addr2).fertilize();
      for (let i = 1; i < 5; i++) {
        await time.increase(31);
        await magicTree.connect(addr2).fertilize();
      }
      await time.increase(31);
      await magicTree.connect(addr2).harvestFruit();
      
      // 再获得第二个果实
      for (let i = 0; i < 5; i++) {
        await time.increase(31);
        await magicTree.connect(addr2).fertilize();
      }
      await time.increase(31);
      await magicTree.connect(addr2).harvestFruit();
      
      const leaderboard = await magicTree.getLeaderboard(10);
      
      // 验证排序（addr2应该在前面因为积分更多）
      expect(leaderboard.addresses[0]).to.equal(addr2.address);
      expect(leaderboard.points[0]).to.be.gt(leaderboard.points[1]);
      
      console.log("      📊 Mock Leaderboard (plaintext points):");
      for (let i = 0; i < Math.min(3, leaderboard.addresses.length); i++) {
        console.log(`      ${i+1}. ${leaderboard.addresses[i]}: ${leaderboard.points[i]} points`);
      }
      console.log("      ");
      console.log("      ℹ️  Note: FHE version cannot implement on-chain leaderboard");
      console.log("      Real deployment uses off-chain indexing for rankings");
    });
  });

  describe("代币兑换 - 剩余量检查", function () {
    it("应该返回正确的剩余百分比", async function () {
      const percentage = await magicTree.getTokenRemainingPercentage();
      expect(percentage).to.equal(10000); // 100% = 10000
    });

    it("应该正确计算代币剩余量", async function () {
      const totalSupply = await magicTree.TOTAL_TOKEN_SUPPLY();
      const remaining = await magicToken.remainingSupply();
      expect(remaining).to.equal(totalSupply);
    });
  });

  describe("每日施肥限制", function () {
    beforeEach(async function () {
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
    });

    it("应该允许每日最多30次施肥", async function () {
      for (let i = 0; i < 30; i++) {
        await magicTree.connect(addr1).fertilize();
        if (i < 29) await time.increase(31);
      }
      
      const treeInfo = await magicTree.getTreeInfo(addr1.address);
      expect(treeInfo.fertilizeCount).to.equal(30);
      expect(treeInfo.dailyFertilizeCount).to.equal(30);
    });

    it("超过每日限制应该拒绝施肥", async function () {
      for (let i = 0; i < 30; i++) {
        await magicTree.connect(addr1).fertilize();
        await time.increase(31);
      }
      
      await expect(
        magicTree.connect(addr1).fertilize()
      ).to.be.revertedWith("Daily fertilize limit reached");
    });

    it("新的一天应该重置每日计数", async function () {
      for (let i = 0; i < 5; i++) {
        await magicTree.connect(addr1).fertilize();
        if (i < 4) await time.increase(31);
      }
      
      let treeInfo = await magicTree.getTreeInfo(addr1.address);
      expect(treeInfo.dailyFertilizeCount).to.equal(5);
      
      await time.increase(24 * 60 * 60 + 61);
      await magicTree.connect(addr1).fertilize();
      
      treeInfo = await magicTree.getTreeInfo(addr1.address);
      expect(treeInfo.fertilizeCount).to.equal(6);
      expect(treeInfo.dailyFertilizeCount).to.equal(1);
    });
  });

  describe("🔥 排行榜（FHE限制）", function () {
    it("初始状态应该没有玩家", async function () {
      const totalPlayers = await magicTree.getTotalPlayers();
      expect(totalPlayers).to.equal(0);
    });

    it("🔥 FHE版本无法实现排行榜", async function () {
      // 由于积分是加密的，无法在链上排序
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      
      await expect(
        magicTree.getLeaderboard(10)
      ).to.be.revertedWith("Leaderboard not available in FHE version - use off-chain indexing");
      
      console.log("      ℹ️  Use off-chain indexing for leaderboard functionality");
      console.log("      Encrypted points cannot be compared on-chain");
      console.log("      Consider using: The Graph, Subsquid, or custom indexer");
    });
  });

  describe("提取资金", function () {
    beforeEach(async function () {
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      await magicTree.connect(addr2).mintTree({ value: ethers.parseEther("0.01") });
    });

    it("所有者应该能够提取资金", async function () {
      const initialBalance = await ethers.provider.getBalance(owner.address);
      const contractBalance = await magicTree.getBalance();
      
      await magicTree.withdraw();
      
      const finalBalance = await ethers.provider.getBalance(owner.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("非所有者不能提取资金", async function () {
      await expect(
        magicTree.connect(addr1).withdraw()
      ).to.be.revertedWith("Only owner can withdraw");
    });

    it("应该正确显示合约余额", async function () {
      const balance = await magicTree.getBalance();
      expect(balance).to.equal(ethers.parseEther("0.02"));
    });
  });

  describe("Mock功能验证", function () {
    it("getEncryptedPoints应该返回明文积分", async function () {
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      
      // 初始应该返回0
      const points = await magicTree.connect(addr1).getEncryptedPoints();
      expect(points).to.equal(0);
      
      console.log("      Initial points (plaintext in Mock):", points.toString());
    });

    it("getTreeInfo应该返回明文积分", async function () {
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      
      const treeInfo = await magicTree.getTreeInfo(addr1.address);
      
      // Mock版本：encryptedPoints实际是明文
      expect(treeInfo.encryptedPoints).to.equal(0);
      
      console.log("      TreeInfo points (plaintext in Mock):", treeInfo.encryptedPoints.toString());
    });

    it("采摘果实后积分应该增加", async function () {
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      
      const pointsBefore = await magicTree.connect(addr1).getEncryptedPoints();
      
      // 获得果实并采摘
      await magicTree.connect(addr1).fertilize();
      for (let i = 1; i < 5; i++) {
        await time.increase(31);
        await magicTree.connect(addr1).fertilize();
      }
      await time.increase(31);
      await magicTree.connect(addr1).harvestFruit();
      
      const pointsAfter = await magicTree.connect(addr1).getEncryptedPoints();
      
      // 积分应该增加
      expect(pointsAfter).to.be.gt(pointsBefore);
      expect(pointsAfter).to.be.gte(100);
      expect(pointsAfter).to.be.lte(500);
      
      console.log("      Points before harvest:", pointsBefore.toString());
      console.log("      Points after harvest:", pointsAfter.toString());
      console.log("      ");
      console.log("      ℹ️  In real FHE deployment:");
      console.log("      - Points are encrypted on-chain");
      console.log("      - Only the user can decrypt their own points");
      console.log("      - Comparison operations happen in encrypted space");
    });
  });

  describe("🔥 合约常量验证", function () {
    it("应该设置正确的常量值", async function () {
      expect(await magicTree.MINT_PRICE()).to.equal(ethers.parseEther("0.01"));
      expect(await magicTree.COOLDOWN_TIME()).to.equal(30);
      expect(await magicTree.FERTILIZE_FOR_FRUIT()).to.equal(5);
      expect(await magicTree.MAX_DAILY_FERTILIZE()).to.equal(30);
      expect(await magicTree.TOTAL_TOKEN_SUPPLY()).to.equal(ethers.parseEther("100000000"));
    });
  });

  describe("🔥 集成测试说明", function () {
    it("完整的FHE测试流程说明", function () {
      console.log("\n      ═══════════════════════════════════════════════");
      console.log("      🔐 FHE Integration Testing Guide");
      console.log("      ═══════════════════════════════════════════════\n");
      
      console.log("      1️⃣  Deploy to Zama Devnet:");
      console.log("         npx hardhat run scripts/deploy.js --network zama\n");
      
      console.log("      2️⃣  Frontend Testing:");
      console.log("         - User mints tree");
      console.log("         - User fertilizes and harvests fruits");
      console.log("         - User clicks 'Decrypt Points' to view balance");
      console.log("         - User enters points to exchange");
      console.log("         - Frontend encrypts the input");
      console.log("         - Call: redeemTokens(encryptedData, proof, amount)\n");
      
      console.log("      3️⃣  Security Checks:");
      console.log("         ✓ Points are encrypted on-chain");
      console.log("         ✓ Only user can decrypt their points");
      console.log("         ✓ FHE.sub prevents underflow (balance protection)");
      console.log("         ✓ No plaintext points exposed in events\n");
      
      console.log("      4️⃣  Known Limitations:");
      console.log("         ✗ Leaderboard not available (encrypted data)");
      console.log("         ✗ Cannot sort by points on-chain");
      console.log("         → Use off-chain indexing (The Graph, etc.)\n");
      
      console.log("      ═══════════════════════════════════════════════\n");
    });
  });
});