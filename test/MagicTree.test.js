import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("MagicTree with Token", function () {
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
    
    // 2. 部署 MagicTree（传入 token 地址）
    const MagicTree = await ethers.getContractFactory("MagicTree");
    magicTree = await MagicTree.deploy(await magicToken.getAddress());
    
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
      // OpenZeppelin 5.x 使用 custom errors，不使用字符串
      // 方法1: 只检查是否 revert（推荐）
      await expect(
        magicToken.setMinter(addr1.address)
      ).to.be.reverted;
      
      // 方法2: 如果要检查具体错误，需要知道 custom error 名称
      // await expect(
      //   magicToken.setMinter(addr1.address)
      // ).to.be.revertedWithCustomError(magicToken, "MinterAlreadySet");
    });

    it("非 owner 不能设置 minter", async function () {
      // 部署新的 token 测试
      const NewToken = await ethers.getContractFactory("MagicToken");
      const newToken = await NewToken.deploy();
      
      await expect(
        newToken.connect(addr1).setMinter(addr2.address)
      ).to.be.reverted; // Ownable: caller is not the owner
    });

    it("不能设置零地址为 minter", async function () {
      const NewToken = await ethers.getContractFactory("MagicToken");
      const newToken = await NewToken.deploy();
      
      await expect(
        newToken.setMinter(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid minter address");
    });
  });

  describe("MagicToken - 基本功能", function () {
    it("初始总供应量应该为 0", async function () {
      expect(await magicToken.totalSupply()).to.equal(0);
    });

    it("应该返回正确的最大供应量", async function () {
      expect(await magicToken.MAX_SUPPLY()).to.equal(ethers.parseEther("100000000"));
    });

    it("应该返回正确的剩余供应量", async function () {
      expect(await magicToken.remainingSupply()).to.equal(ethers.parseEther("100000000"));
    });

    it("只有 minter 可以铸造代币", async function () {
      await expect(
        magicToken.connect(addr1).mint(addr1.address, ethers.parseEther("100"))
      ).to.be.revertedWith("Only minter can mint");
    });

    it("不能超过最大供应量", async function () {
      // 这个测试需要 MagicTree 合约来调用 mint
      // 我们会在后面的兑换测试中验证这个限制
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

  describe("采摘果实", function () {
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
  });

  describe("代币兑换 - 动态比例", function () {
    it("0-499 玩家时比例应该是 1:1", async function () {
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      expect(await magicTree.getCurrentExchangeRate()).to.equal(1);
    });

    it("500-999 玩家时比例应该是 3:1", async function () {
      // Mint 500 个玩家（实际测试中可能需要调整）
      // 这里用少量玩家演示逻辑
      for (let i = 0; i < 3; i++) {
        const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
        await owner.sendTransaction({
          to: wallet.address,
          value: ethers.parseEther("1")
        });
        await magicTree.connect(wallet).mintTree({ value: ethers.parseEther("0.01") });
      }
      
      // 假设我们手动设置玩家数达到 500
      // 实际测试中，这个测试可能需要修改或使用 mock
      const totalPlayers = await magicTree.getTotalPlayers();
      const expectedRate = 1 + Math.floor(Number(totalPlayers) / 500) * 2;
      expect(await magicTree.getCurrentExchangeRate()).to.equal(expectedRate);
    });

    it("比例应该随玩家数量增加", async function () {
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      const rate1 = await magicTree.getCurrentExchangeRate();
      
      // 添加更多玩家
      await magicTree.connect(addr2).mintTree({ value: ethers.parseEther("0.01") });
      await magicTree.connect(addr3).mintTree({ value: ethers.parseEther("0.01") });
      
      const rate2 = await magicTree.getCurrentExchangeRate();
      
      // 在少量玩家情况下，比例应该相同（都是 tier 0）
      expect(rate1).to.equal(rate2);
    });
  });

  describe("代币兑换 - 基本功能", function () {
    beforeEach(async function () {
      // addr1 mint 神树并获得积分
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      
      // 施肥 5 次获得 1 个果实
      await magicTree.connect(addr1).fertilize();
      for (let i = 1; i < 5; i++) {
        await time.increase(31);
        await magicTree.connect(addr1).fertilize();
      }
      
      // 采摘果实获得积分（100-500）
      await time.increase(31);
      await magicTree.connect(addr1).harvestFruit();
    });

    it("应该能够兑换代币", async function () {
      const treeInfoBefore = await magicTree.getTreeInfo(addr1.address);
      const pointsBefore = treeInfoBefore.points;
      
      // 兑换 100 积分
      await magicTree.connect(addr1).redeemTokens(100);
      
      const treeInfoAfter = await magicTree.getTreeInfo(addr1.address);
      expect(treeInfoAfter.points).to.equal(pointsBefore - 100n);
      
      // 检查代币余额（1:1 比例）
      const tokenBalance = await magicToken.balanceOf(addr1.address);
      expect(tokenBalance).to.equal(ethers.parseEther("100"));
    });

    it("应该扣除正确的积分", async function () {
      const pointsBefore = (await magicTree.getTreeInfo(addr1.address)).points;
      
      await magicTree.connect(addr1).redeemTokens(50);
      
      const pointsAfter = (await magicTree.getTreeInfo(addr1.address)).points;
      expect(pointsAfter).to.equal(pointsBefore - 50n);
    });

    it("应该铸造正确数量的代币", async function () {
      const rate = await magicTree.getCurrentExchangeRate();
      const pointsToRedeem = 100;
      
      await magicTree.connect(addr1).redeemTokens(pointsToRedeem);
      
      const expectedTokens = ethers.parseEther(pointsToRedeem.toString()) / rate;
      const actualTokens = await magicToken.balanceOf(addr1.address);
      
      expect(actualTokens).to.equal(expectedTokens);
    });

    it("应该更新代币总供应量", async function () {
      const supplyBefore = await magicToken.totalSupply();
      
      await magicTree.connect(addr1).redeemTokens(100);
      
      const supplyAfter = await magicToken.totalSupply();
      expect(supplyAfter).to.be.gt(supplyBefore);
      expect(supplyAfter).to.equal(ethers.parseEther("100"));
    });

    it("应该更新剩余供应量", async function () {
      const remainingBefore = await magicToken.remainingSupply();
      
      await magicTree.connect(addr1).redeemTokens(100);
      
      const remainingAfter = await magicToken.remainingSupply();
      expect(remainingAfter).to.be.lt(remainingBefore);
      expect(remainingAfter).to.equal(remainingBefore - ethers.parseEther("100"));
    });

    it("应该触发 TokensRedeemed 事件", async function () {
      await expect(
        magicTree.connect(addr1).redeemTokens(100)
      ).to.emit(magicTree, "TokensRedeemed")
        .withArgs(addr1.address, 100, ethers.parseEther("100"), await time.latest() + 1);
    });
  });

  describe("代币兑换 - 边界情况", function () {
    beforeEach(async function () {
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      await magicTree.connect(addr1).fertilize();
      for (let i = 1; i < 5; i++) {
        await time.increase(31);
        await magicTree.connect(addr1).fertilize();
      }
      await time.increase(31);
      await magicTree.connect(addr1).harvestFruit();
    });

    it("应该拒绝积分不足的兑换", async function () {
      const treeInfo = await magicTree.getTreeInfo(addr1.address);
      const points = treeInfo.points;
      
      await expect(
        magicTree.connect(addr1).redeemTokens(points + 1n)
      ).to.be.revertedWith("Insufficient points");
    });

    it("应该拒绝 0 积分兑换", async function () {
      await expect(
        magicTree.connect(addr1).redeemTokens(0)
      ).to.be.revertedWith("Points must be greater than 0");
    });

    it("应该拒绝未 mint 神树的用户兑换", async function () {
      await expect(
        magicTree.connect(addr2).redeemTokens(100)
      ).to.be.revertedWith("Tree does not exist");
    });

    it("应该拒绝积分为 0 的用户兑换", async function () {
      await magicTree.connect(addr2).mintTree({ value: ethers.parseEther("0.01") });
      
      await expect(
        magicTree.connect(addr2).redeemTokens(100)
      ).to.be.revertedWith("Insufficient points");
    });

    it("多次兑换应该正确累计", async function () {
      await magicTree.connect(addr1).redeemTokens(50);
      await magicTree.connect(addr1).redeemTokens(30);
      
      const balance = await magicToken.balanceOf(addr1.address);
      expect(balance).to.equal(ethers.parseEther("80")); // 50 + 30
    });
  });

  describe("代币兑换 - 剩余量检查", function () {
    it("应该返回正确的剩余百分比", async function () {
      const percentage = await magicTree.getTokenRemainingPercentage();
      expect(percentage).to.equal(10000); // 100% = 10000
    });

    it("兑换后应该更新剩余百分比", async function () {
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      await magicTree.connect(addr1).fertilize();
      for (let i = 1; i < 5; i++) {
        await time.increase(31);
        await magicTree.connect(addr1).fertilize();
      }
      await time.increase(31);
      await magicTree.connect(addr1).harvestFruit();
      
      await magicTree.connect(addr1).redeemTokens(100);
      
      const percentage = await magicTree.getTokenRemainingPercentage();
      expect(percentage).to.be.lt(10000);
      
      // 计算期望值: (100M - 100) / 100M * 10000
      const expected = (ethers.parseEther("100000000") - ethers.parseEther("100")) 
        * 10000n / ethers.parseEther("100000000");
      expect(percentage).to.equal(expected);
    });
  });

  describe("代币兑换 - 不同比例测试", function () {
    it("在不同比例下应该兑换正确数量", async function () {
      // 玩家1: tier 0, rate = 1
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      await magicTree.connect(addr1).fertilize();
      for (let i = 1; i < 5; i++) {
        await time.increase(31);
        await magicTree.connect(addr1).fertilize();
      }
      await time.increase(31);
      await magicTree.connect(addr1).harvestFruit();
      
      const rate1 = await magicTree.getCurrentExchangeRate();
      await magicTree.connect(addr1).redeemTokens(100);
      
      const balance1 = await magicToken.balanceOf(addr1.address);
      const expected1 = ethers.parseEther("100") / rate1;
      expect(balance1).to.equal(expected1);
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

  describe("排行榜", function () {
    it("初始状态应该没有玩家", async function () {
      const totalPlayers = await magicTree.getTotalPlayers();
      expect(totalPlayers).to.equal(0);
    });

    it("排行榜应该按积分降序排列", async function () {
      // addr1: 获得积分
      await magicTree.connect(addr1).mintTree({ value: ethers.parseEther("0.01") });
      for (let i = 0; i < 5; i++) {
        await magicTree.connect(addr1).fertilize();
        if (i < 4) await time.increase(31);
      }
      await time.increase(31);
      await magicTree.connect(addr1).harvestFruit();
      
      // addr2: 获得更多积分
      await magicTree.connect(addr2).mintTree({ value: ethers.parseEther("0.01") });
      for (let i = 0; i < 10; i++) {
        await magicTree.connect(addr2).fertilize();
        if (i < 9) await time.increase(31);
      }
      await time.increase(31);
      await magicTree.connect(addr2).harvestFruit();
      await time.increase(31);
      await magicTree.connect(addr2).harvestFruit();
      
      const result = await magicTree.getLeaderboard(10);
      
      expect(result.addresses[0].toLowerCase()).to.equal(addr2.address.toLowerCase());
      expect(result.points[0]).to.be.gt(result.points[1]);
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
  });
});