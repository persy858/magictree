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
      
      // 施肥 5 次产生 1 个果实
      for (let i = 0; i < 5; i++) {
        await magicTree.connect(addr1).fertilize();
        if (i < 4) {
          await time.increase(61);
        }
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

    it("应该显示正确的合约余额", async function () {
      const balance = await magicTree.getBalance();
      expect(balance).to.equal(ethers.parseEther("0.02"));
    });
  });
});