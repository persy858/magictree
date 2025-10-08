import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { MagicTreeFHEOracle, MagicToken } from "../types";
import { expect } from "chai";
import {
  createFruits,
  harvestMultipleTimes,
  createEncryptedInput,
  mintTreeWithPoints,
  createPlayers,
  waitCooldown,
  advanceToNextDay,
  calculateExpectedRate,
  verifyTreeState,
} from "./helpers";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  charlie: HardhatEthersSigner;
};

describe("MagicTreeFHEOracle - Advanced Tests", function () {
  let signers: Signers;
  let magicTreeContract: MagicTreeFHEOracle;
  let magicTokenContract: MagicToken;
  let magicTreeAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
      alice: ethSigners[1],
      bob: ethSigners[2],
      charlie: ethSigners[3],
    };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This test suite can only run on FHEVM mock environment`);
      this.skip();
    }

    const MagicTokenFactory = await ethers.getContractFactory("MagicToken");
    magicTokenContract = await MagicTokenFactory.deploy();
    const magicTokenAddress = await magicTokenContract.getAddress();

    const MagicTreeFactory = await ethers.getContractFactory("MagicTreeFHEOracle");
    magicTreeContract = await MagicTreeFactory.deploy(magicTokenAddress);
    magicTreeAddress = await magicTreeContract.getAddress();

    await magicTokenContract.setMinter(magicTreeAddress);
  });

  describe("Complex Gameplay Scenarios", function () {
    it("should handle multiple players with different progression levels", async function () {
      const mintPrice = await magicTreeContract.MINT_PRICE();

      // Alice: 初学者,只铸造树
      await magicTreeContract.connect(signers.alice).mintTree({ value: mintPrice });

      // Bob: 中级玩家,施肥并获得一些果实
      await magicTreeContract.connect(signers.bob).mintTree({ value: mintPrice });
      await createFruits(magicTreeContract, signers.bob, 2);

      // Charlie: 高级玩家,收获多个果实获得积分
      await magicTreeContract.connect(signers.charlie).mintTree({ value: mintPrice });
      await harvestMultipleTimes(magicTreeContract, signers.charlie, 3);

      // 验证各玩家状态
      await verifyTreeState(magicTreeContract, signers.alice.address, {
        exists: true,
        fertilizeCount: 0,
        fruits: 0,
      });

      await verifyTreeState(magicTreeContract, signers.bob.address, {
        exists: true,
        fertilizeCount: 10,
        fruits: 2,
      });

      const charlieInfo = await magicTreeContract.getTreeInfo(signers.charlie.address);
      expect(charlieInfo.exists).to.be.true;
      expect(charlieInfo.fertilizeCount).to.equal(15);
      expect(charlieInfo.fruits).to.equal(0); // 已全部收获
    });

    it("should handle rapid sequential actions with cooldown management", async function () {
      const mintPrice = await magicTreeContract.MINT_PRICE();
      await magicTreeContract.connect(signers.alice).mintTree({ value: mintPrice });

      // 尝试快速施肥多次
      await magicTreeContract.connect(signers.alice).fertilize();

      // 应该失败(冷却中)
      await expect(
        magicTreeContract.connect(signers.alice).fertilize()
      ).to.be.revertedWith("Cooldown not finished");

      // 等待冷却后成功
      await waitCooldown(magicTreeContract, 1);
      await magicTreeContract.connect(signers.alice).fertilize();

      const treeInfo = await magicTreeContract.getTreeInfo(signers.alice.address);
      expect(treeInfo.fertilizeCount).to.equal(2);
    });

    it("should handle daily limit reset correctly across multiple days", async function () {
      const mintPrice = await magicTreeContract.MINT_PRICE();
      await magicTreeContract.connect(signers.alice).mintTree({ value: mintPrice });

      // 第一天:施肥 5 次
      for (let i = 0; i < 5; i++) {
        await magicTreeContract.connect(signers.alice).fertilize();
        await waitCooldown(magicTreeContract);
      }

      let treeInfo = await magicTreeContract.getTreeInfo(signers.alice.address);
      expect(treeInfo.dailyFertilizeCount).to.equal(5);

      // 前进到第二天
      await advanceToNextDay();

      // 应该能够再次施肥
      await magicTreeContract.connect(signers.alice).fertilize();

      treeInfo = await magicTreeContract.getTreeInfo(signers.alice.address);
      expect(treeInfo.dailyFertilizeCount).to.equal(1);
      expect(treeInfo.fertilizeCount).to.equal(6);
    });
  });

  describe("Exchange Rate Dynamics", function () {
    it("should increase exchange rate as player base grows", async function () {
      const initialRate = await magicTreeContract.getCurrentExchangeRate();
      expect(initialRate).to.equal(1);

      // 添加 500 个玩家进入 tier 1
      await createPlayers(magicTreeContract, signers.deployer, 500);

      const rate1 = await magicTreeContract.getCurrentExchangeRate();
      expect(rate1).to.equal(calculateExpectedRate(500));

      // 添加更多玩家进入 tier 2
      await createPlayers(magicTreeContract, signers.deployer, 500);

      const rate2 = await magicTreeContract.getCurrentExchangeRate();
      expect(rate2).to.equal(calculateExpectedRate(1000));
    });

    it("should affect token redemption amounts based on rate", async function () {
      const mintPrice = await magicTreeContract.MINT_PRICE();

      // Alice 在低汇率时准备兑换
      await magicTreeContract.connect(signers.alice).mintTree({ value: mintPrice });
      await harvestMultipleTimes(magicTreeContract, signers.alice, 2);

      const rateBeforePlayers = await magicTreeContract.getCurrentExchangeRate();
      expect(rateBeforePlayers).to.equal(1);

      // 添加大量玩家提高汇率
      await createPlayers(magicTreeContract, signers.deployer, 500);

      const rateAfterPlayers = await magicTreeContract.getCurrentExchangeRate();
      expect(rateAfterPlayers).to.be.greaterThan(rateBeforePlayers);
    });
  });

  describe("Points Accumulation and Redemption", function () {
    it("should accumulate points from multiple fruit harvests", async function () {
      const mintPrice = await magicTreeContract.MINT_PRICE();
      await magicTreeContract.connect(signers.alice).mintTree({ value: mintPrice });

      // 收获多次
      await harvestMultipleTimes(magicTreeContract, signers.alice, 5);

      // 验证有加密积分
      const encryptedPoints = await magicTreeContract
        .connect(signers.alice)
        .getEncryptedPoints();
      expect(encryptedPoints).to.not.equal(ethers.ZeroHash);
    });

    it("should handle full redemption flow", async function () {
      const mintPrice = await magicTreeContract.MINT_PRICE();
      await magicTreeContract.connect(signers.alice).mintTree({ value: mintPrice });

      // 获得足够的积分
      await harvestMultipleTimes(magicTreeContract, signers.alice, 3);

      const claimedAmount = 500;

      // 步骤 1: 请求兑换
      const encryptedInput = await createEncryptedInput(
        magicTreeAddress,
        signers.alice.address,
        claimedAmount
      );

      const tx1 = await magicTreeContract
        .connect(signers.alice)
        .requestRedeemTokens(
          encryptedInput.handles[0],
          claimedAmount,
          encryptedInput.inputProof
        );
      await tx1.wait();

      const redeemId = await magicTreeContract.getUserLatestRequest(signers.alice.address);
      expect(redeemId).to.equal(1);

      // 步骤 2: 请求解密
      const tx2 = await magicTreeContract
        .connect(signers.alice)
        .requestDecryption(redeemId);
      const receipt = await tx2.wait();

      // 检查 DecryptionRequested 事件
      const event = receipt?.logs.find((log: any) => {
        try {
          const parsed = magicTreeContract.interface.parseLog(log);
          return parsed?.name === "DecryptionRequested";
        } catch {
          return false;
        }
      });
      expect(event).to.not.be.undefined;

      // 步骤 3: 检查状态
      const status = await magicTreeContract.getRedeemStatus(redeemId);
      expect(status.user).to.equal(signers.alice.address);
      expect(status.claimedAmount).to.equal(claimedAmount);
    });

    it("should track multiple redemption requests correctly", async function () {
      const mintPrice = await magicTreeContract.MINT_PRICE();
      await magicTreeContract.connect(signers.alice).mintTree({ value: mintPrice });
      await harvestMultipleTimes(magicTreeContract, signers.alice, 3);

      // 第一次兑换请求
      const claimedAmount1 = 200;
      const encryptedInput1 = await createEncryptedInput(
        magicTreeAddress,
        signers.alice.address,
        claimedAmount1
      );

      await magicTreeContract
        .connect(signers.alice)
        .requestRedeemTokens(
          encryptedInput1.handles[0],
          claimedAmount1,
          encryptedInput1.inputProof
        );

      const redeemId1 = await magicTreeContract.getUserLatestRequest(signers.alice.address);
      expect(redeemId1).to.equal(1);

      // 第二次兑换请求
      const claimedAmount2 = 100;
      const encryptedInput2 = await createEncryptedInput(
        magicTreeAddress,
        signers.alice.address,
        claimedAmount2
      );

      await magicTreeContract
        .connect(signers.alice)
        .requestRedeemTokens(
          encryptedInput2.handles[0],
          claimedAmount2,
          encryptedInput2.inputProof
        );

      const redeemId2 = await magicTreeContract.getUserLatestRequest(signers.alice.address);
      expect(redeemId2).to.equal(2);

      // 验证两个请求都存在
      const status1 = await magicTreeContract.getRedeemStatus(redeemId1);
      expect(status1.claimedAmount).to.equal(claimedAmount1);

      const status2 = await magicTreeContract.getRedeemStatus(redeemId2);
      expect(status2.claimedAmount).to.equal(claimedAmount2);
    });
  });

  describe("Edge Cases and Security", function () {
    it("should prevent unauthorized decryption requests", async function () {
      const mintPrice = await magicTreeContract.MINT_PRICE();

      // Alice 创建兑换请求
      await magicTreeContract.connect(signers.alice).mintTree({ value: mintPrice });
      await harvestMultipleTimes(magicTreeContract, signers.alice, 2);

      const claimedAmount = 300;
      const encryptedInput = await createEncryptedInput(
        magicTreeAddress,
        signers.alice.address,
        claimedAmount
      );

      await magicTreeContract
        .connect(signers.alice)
        .requestRedeemTokens(
          encryptedInput.handles[0],
          claimedAmount,
          encryptedInput.inputProof
        );

      const redeemId = await magicTreeContract.getUserLatestRequest(signers.alice.address);

      // Bob 尝试解密 Alice 的请求
      await expect(
        magicTreeContract.connect(signers.bob).requestDecryption(redeemId)
      ).to.be.revertedWith("Only requester can decrypt");
    });

    it("should handle maximum daily fertilize limit correctly", async function () {
      const mintPrice = await magicTreeContract.MINT_PRICE();
      await magicTreeContract.connect(signers.alice).mintTree({ value: mintPrice });

      const maxDaily = await magicTreeContract.MAX_DAILY_FERTILIZE();

      // 施肥到极限
      for (let i = 0; i < Number(maxDaily); i++) {
        await magicTreeContract.connect(signers.alice).fertilize();
        await waitCooldown(magicTreeContract);
      }

      // 验证达到极限
      await expect(
        magicTreeContract.connect(signers.alice).fertilize()
      ).to.be.revertedWith("Daily fertilize limit reached");

      // 前进到新的一天
      await advanceToNextDay();

      // 应该能够再次施肥
      await expect(
        magicTreeContract.connect(signers.alice).fertilize()
      ).to.not.be.reverted;
    });

    it("should maintain correct state after multiple operations", async function () {
      const mintPrice = await magicTreeContract.MINT_PRICE();
      await magicTreeContract.connect(signers.alice).mintTree({ value: mintPrice });

      // 复杂操作序列
      await createFruits(magicTreeContract, signers.alice, 2); // 10 次施肥,产生 2 个果实
      
      await waitCooldown(magicTreeContract); // 等待冷却后收获
      await magicTreeContract.connect(signers.alice).harvestFruit(); // 收获 1 个
      
      await waitCooldown(magicTreeContract); // 等待冷却后继续施肥
      await createFruits(magicTreeContract, signers.alice, 1); // 5 次施肥,产生 1 个果实
      
      await waitCooldown(magicTreeContract); // 等待冷却后收获
      await magicTreeContract.connect(signers.alice).harvestFruit(); // 收获 1 个

      // 验证最终状态
      const treeInfo = await magicTreeContract.getTreeInfo(signers.alice.address);
      expect(treeInfo.fertilizeCount).to.equal(15); // 总共 15 次施肥
      expect(treeInfo.fruits).to.equal(1); // 3 个产生,2 个收获,剩 1 个
    });

    it("should prevent tree operations without minting first", async function () {
      // 尝试在没有铸造树的情况下施肥
      await expect(
        magicTreeContract.connect(signers.alice).fertilize()
      ).to.be.revertedWith("Tree does not exist");

      // 尝试在没有铸造树的情况下收获
      await expect(
        magicTreeContract.connect(signers.alice).harvestFruit()
      ).to.be.revertedWith("Tree does not exist");
    });

    it("should handle zero claimed amount correctly", async function () {
      const mintPrice = await magicTreeContract.MINT_PRICE();
      await magicTreeContract.connect(signers.alice).mintTree({ value: mintPrice });
      await harvestMultipleTimes(magicTreeContract, signers.alice, 2);

      const claimedAmount = 0;
      const encryptedInput = await createEncryptedInput(
        magicTreeAddress,
        signers.alice.address,
        claimedAmount
      );

      await expect(
        magicTreeContract
          .connect(signers.alice)
          .requestRedeemTokens(
            encryptedInput.handles[0],
            claimedAmount,
            encryptedInput.inputProof
          )
      ).to.be.revertedWith("Amount must be greater than 0");
    });
  });

  describe("Token Supply Management", function () {
    it("should track token remaining percentage correctly", async function () {
      const initialPercentage = await magicTreeContract.getTokenRemainingPercentage();
      expect(initialPercentage).to.equal(10000); // 100.00%

      // TODO: 在实际兑换后测试百分比变化
      // 需要完整的异步解密流程
    });

    it("should verify contract has correct token supply reference", async function () {
      const totalSupply = await magicTreeContract.TOTAL_TOKEN_SUPPLY();
      const tokenMaxSupply = await magicTokenContract.MAX_SUPPLY();

      expect(totalSupply).to.equal(tokenMaxSupply);
    });

    it("should verify contract balance increases with minting", async function () {
      const mintPrice = await magicTreeContract.MINT_PRICE();
      const initialBalance = await magicTreeContract.getBalance();

      await magicTreeContract.connect(signers.alice).mintTree({ value: mintPrice });

      const newBalance = await magicTreeContract.getBalance();
      expect(newBalance).to.equal(initialBalance + mintPrice);
    });
  });

  describe("View Functions", function () {
    it("should return correct tree info for non-existent tree", async function () {
      const treeInfo = await magicTreeContract.getTreeInfo(signers.alice.address);
      
      expect(treeInfo.exists).to.be.false;
      expect(treeInfo.fertilizeCount).to.equal(0);
      expect(treeInfo.fruits).to.equal(0);
      expect(treeInfo.cooldownRemaining).to.equal(0);
    });

    it("should calculate cooldown remaining correctly", async function () {
      const mintPrice = await magicTreeContract.MINT_PRICE();
      await magicTreeContract.connect(signers.alice).mintTree({ value: mintPrice });

      // 施肥后立即检查冷却时间
      await magicTreeContract.connect(signers.alice).fertilize();
      
      const treeInfo = await magicTreeContract.getTreeInfo(signers.alice.address);
      const cooldownTime = await magicTreeContract.COOLDOWN_TIME();
      
      expect(treeInfo.cooldownRemaining).to.be.greaterThan(0);
      expect(treeInfo.cooldownRemaining).to.be.lessThanOrEqual(cooldownTime);
    });

    it("should show zero cooldown when ready", async function () {
      const mintPrice = await magicTreeContract.MINT_PRICE();
      await magicTreeContract.connect(signers.alice).mintTree({ value: mintPrice });

      await magicTreeContract.connect(signers.alice).fertilize();
      await waitCooldown(magicTreeContract);

      const treeInfo = await magicTreeContract.getTreeInfo(signers.alice.address);
      expect(treeInfo.cooldownRemaining).to.equal(0);
    });

    it("should track daily fertilize remaining correctly", async function () {
      const mintPrice = await magicTreeContract.MINT_PRICE();
      await magicTreeContract.connect(signers.alice).mintTree({ value: mintPrice });

      const maxDaily = await magicTreeContract.MAX_DAILY_FERTILIZE();
      
      // 初始状态
      let treeInfo = await magicTreeContract.getTreeInfo(signers.alice.address);
      expect(treeInfo.dailyFertilizeRemaining).to.equal(maxDaily);

      // 施肥一次
      await magicTreeContract.connect(signers.alice).fertilize();
      
      treeInfo = await magicTreeContract.getTreeInfo(signers.alice.address);
      expect(treeInfo.dailyFertilizeRemaining).to.equal(maxDaily - 1n);
    });

    it("should revert leaderboard query in FHE version", async function () {
      await expect(
        magicTreeContract.getLeaderboard(10)
      ).to.be.revertedWith("Leaderboard not available in FHE version");
    });
  });
});