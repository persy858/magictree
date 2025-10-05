import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("MagicTree", function () {
  let magicTree;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    const MagicTree = await ethers.getContractFactory("MagicTree");
    magicTree = await MagicTree.deploy();
  });

  describe("部署", function () {
    it("应该正确设置合约所有者", async function () {
      expect(await magicTree.owner()).to.equal(owner.address);
    });

    it("应该设置正确的 mint 价格", async function () {
      expect(await magicTree.MINT_PRICE()).to.equal(ethers.parseEther("0.01"));
    });
  });

  describe("Mint 神树", function () {
    it("应该能够 mint 神树", async function () {
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      const treeInfo = await magicTree.getTreeInfo(addr1.address);
      expect(treeInfo.exists).to.equal(true);
      expect(treeInfo.fertilizeCount).to.equal(0);
      expect(treeInfo.fruits).to.equal(0);
      expect(treeInfo.points).to.equal(0);
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
      
      // 快进 61 秒
      await time.increase(61);
      
      await magicTree.connect(addr1).fertilize();
      const treeInfo = await magicTree.getTreeInfo(addr1.address);
      expect(treeInfo.fertilizeCount).to.equal(2);
    });

    it("施肥 5 次后应该产生果实", async function () {
      // 第一次施肥
      await magicTree.connect(addr1).fertilize();
      
      // 后续4次施肥，每次前等待冷却
      for (let i = 1; i < 5; i++) {
        await time.increase(61);
        await magicTree.connect(addr1).fertilize();
      }
      
      const treeInfo = await magicTree.getTreeInfo(addr1.address);
      expect(treeInfo.fertilizeCount).to.equal(5);
      expect(treeInfo.fruits).to.equal(1);
    });

    it("应该触发 TreeFertilized 事件", async function () {
      await expect(
        magicTree.connect(addr1).fertilize()
      ).to.emit(magicTree, "TreeFertilized");
    });
  });

  describe("采摘果实", function () {
    beforeEach(async function () {
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      
      // 第一次施肥
      await magicTree.connect(addr1).fertilize();
      
      // 施肥 5 次产生 1 个果实
      for (let i = 1; i < 5; i++) {
        await time.increase(61);
        await magicTree.connect(addr1).fertilize();
      }
    });

    it("应该能够采摘果实", async function () {
      await magicTree.connect(addr1).harvestFruit();
      const treeInfo = await magicTree.getTreeInfo(addr1.address);
      expect(treeInfo.fruits).to.equal(0);
      expect(treeInfo.points).to.be.gt(0);
    });

    it("应该给予 100-500 之间的积分", async function () {
      await magicTree.connect(addr1).harvestFruit();
      const treeInfo = await magicTree.getTreeInfo(addr1.address);
      expect(treeInfo.points).to.be.gte(100);
      expect(treeInfo.points).to.be.lte(500);
    });

    it("应该拒绝无果实时采摘", async function () {
      await magicTree.connect(addr1).harvestFruit();
      await expect(
        magicTree.connect(addr1).harvestFruit()
      ).to.be.revertedWith("No fruits to harvest");
    });

    it("应该触发 FruitDecomposed 事件", async function () {
      await expect(
        magicTree.connect(addr1).harvestFruit()
      ).to.emit(magicTree, "FruitDecomposed");
    });
  });

  describe("获取神树信息", function () {
    it("应该返回不存在的神树信息", async function () {
      const treeInfo = await magicTree.getTreeInfo(addr1.address);
      expect(treeInfo.exists).to.equal(false);
    });

    it("应该返回正确的冷却时间", async function () {
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      await magicTree.connect(addr1).fertilize();
      
      const treeInfo = await magicTree.getTreeInfo(addr1.address);
      expect(treeInfo.cooldownRemaining).to.be.gt(0);
      expect(treeInfo.cooldownRemaining).to.be.lte(60);
      
      // 等待冷却完成
      await time.increase(61);
      const treeInfoAfter = await magicTree.getTreeInfo(addr1.address);
      expect(treeInfoAfter.cooldownRemaining).to.equal(0);
    });
  });

  describe("每日施肥限制", function () {
    beforeEach(async function () {
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
    });

    it("应该允许每日最多30次施肥", async function () {
      // 施肥30次
      for (let i = 0; i < 30; i++) {
        await magicTree.connect(addr1).fertilize();
        if (i < 29) await time.increase(61);
      }
      
      const treeInfo = await magicTree.getTreeInfo(addr1.address);
      expect(treeInfo.fertilizeCount).to.equal(30);
      expect(treeInfo.dailyFertilizeCount).to.equal(30);
    });

    it("超过每日限制应该拒绝施肥", async function () {
      // 施肥30次
      for (let i = 0; i < 30; i++) {
        await magicTree.connect(addr1).fertilize();
        await time.increase(61);
      }
      
      // 第31次应该失败
      await expect(
        magicTree.connect(addr1).fertilize()
      ).to.be.revertedWith("Daily fertilize limit reached");
    });

    it("新的一天应该重置每日计数", async function () {
      // 第一天施肥5次
      for (let i = 0; i < 5; i++) {
        await magicTree.connect(addr1).fertilize();
        if (i < 4) await time.increase(61);
      }
      
      let treeInfo = await magicTree.getTreeInfo(addr1.address);
      expect(treeInfo.dailyFertilizeCount).to.equal(5);
      
      // 时间前进到第二天（24小时 + 1分钟）
      await time.increase(24 * 60 * 60 + 61);
      
      // 第二天再次施肥
      await magicTree.connect(addr1).fertilize();
      
      treeInfo = await magicTree.getTreeInfo(addr1.address);
      expect(treeInfo.fertilizeCount).to.equal(6);  // 总次数
      expect(treeInfo.dailyFertilizeCount).to.equal(1);  // 今日次数应该重置
    });

    it("应该正确返回每日剩余次数", async function () {
      // 施肥10次
      for (let i = 0; i < 10; i++) {
        await magicTree.connect(addr1).fertilize();
        if (i < 9) await time.increase(61);
      }
      
      const treeInfo = await magicTree.getTreeInfo(addr1.address);
      expect(treeInfo.dailyFertilizeRemaining).to.equal(20);  // 30 - 10 = 20
    });

    it("未施肥的新树应该显示30次剩余", async function () {
      const treeInfo = await magicTree.getTreeInfo(addr1.address);
      expect(treeInfo.dailyFertilizeRemaining).to.equal(30);
    });
  });

  describe("排行榜", function () {
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

    it("应该显示正确的合约余额", async function () {
      const balance = await magicTree.getBalance();
      expect(balance).to.equal(ethers.parseEther("0.02"));
    });
  });

  describe("排行榜", function () {
    it("初始状态应该没有玩家", async function () {
      const totalPlayers = await magicTree.getTotalPlayers();
      expect(totalPlayers).to.equal(0);
    });

    it("mint 神树后应该添加到玩家列表", async function () {
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      
      const totalPlayers = await magicTree.getTotalPlayers();
      expect(totalPlayers).to.equal(1);
    });

    it("多个玩家 mint 应该正确记录", async function () {
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      await magicTree.connect(addr2).mintTree({ value: ethers.parseEther("0.01") });
      await magicTree.connect(owner).mintTree({ value: ethers.parseEther("0.01") });
      
      const totalPlayers = await magicTree.getTotalPlayers();
      expect(totalPlayers).to.equal(3);
    });

    it("同一玩家重复 mint 不应该重复添加", async function () {
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      
      // 尝试再次 mint 会失败
      await expect(
        magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") })
      ).to.be.revertedWith("Tree already exists");
      
      const totalPlayers = await magicTree.getTotalPlayers();
      expect(totalPlayers).to.equal(1);
    });

    it("应该返回正确的排行榜数据", async function () {
      // 玩家1: mint + 施肥5次 = 1个果实
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      for (let i = 0; i < 5; i++) {
        await magicTree.connect(addr1).fertilize();
        if (i < 4) await time.increase(61);
      }
      
      // 玩家2: mint + 施肥10次 = 2个果实
      await magicTree.connect(addr2).mintTree({ value: ethers.parseEther("0.01") });
      for (let i = 0; i < 10; i++) {
        await magicTree.connect(addr2).fertilize();
        if (i < 9) await time.increase(61);
      }
      
      // 获取排行榜
      const result = await magicTree.getLeaderboard(10);
      
      expect(result.addresses.length).to.equal(2);
      expect(result.points.length).to.equal(2);
      expect(result.fertilizeCounts.length).to.equal(2);
    });

    it("排行榜应该按积分降序排列", async function () {
      // addr1: 500积分（采摘1个果实）
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      for (let i = 0; i < 5; i++) {
        await magicTree.connect(addr1).fertilize();
        if (i < 4) await time.increase(61);
      }
      await time.increase(61);
      await magicTree.connect(addr1).harvestFruit();
      
      // addr2: 1000积分（采摘2个果实）
      await magicTree.connect(addr2).mintTree({ value: ethers.parseEther("0.01") });
      for (let i = 0; i < 10; i++) {
        await magicTree.connect(addr2).fertilize();
        if (i < 9) await time.increase(61);
      }
      await time.increase(61);
      await magicTree.connect(addr2).harvestFruit();
      await time.increase(61);
      await magicTree.connect(addr2).harvestFruit();
      
      // 获取排行榜
      const result = await magicTree.getLeaderboard(10);
      
      // addr2 应该排第一（积分更多）
      expect(result.addresses[0].toLowerCase()).to.equal(addr2.address.toLowerCase());
      expect(result.points[0]).to.be.gt(result.points[1]);
    });

    it("排行榜应该限制返回数量", async function () {
      // mint 3个玩家
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      await magicTree.connect(addr2).mintTree({ value: ethers.parseEther("0.01") });
      await magicTree.connect(owner).mintTree({ value: ethers.parseEther("0.01") });
      
      // 只获取前2名
      const result = await magicTree.getLeaderboard(2);
      
      expect(result.addresses.length).to.equal(2);
    });

    it("空排行榜应该返回空数组", async function () {
      const result = await magicTree.getLeaderboard(10);
      
      expect(result.addresses.length).to.equal(0);
      expect(result.points.length).to.equal(0);
      expect(result.fertilizeCounts.length).to.equal(0);
    });

    it("排行榜应该包含正确的施肥次数", async function () {
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      
      // 施肥3次
      for (let i = 0; i < 3; i++) {
        await magicTree.connect(addr1).fertilize();
        if (i < 2) await time.increase(61);
      }
      
      const result = await magicTree.getLeaderboard(10);
      
      expect(result.fertilizeCounts[0]).to.equal(3);
    });
  });
});