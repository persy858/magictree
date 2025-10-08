import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { MagicTreeFHEOracle } from "../types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * 辅助函数：创建多个水果
 * @param contract 合约实例
 * @param signer 签名者
 * @param fruitCount 需要创建的水果数量
 */
 export async function createFruits(
    contract: MagicTreeFHEOracle,
    signer: HardhatEthersSigner,
    fruitCount: number
  ) {
    const cooldownTime = await contract.COOLDOWN_TIME();
    const fertilizeForFruit = await contract.FERTILIZE_FOR_FRUIT();
    
    for (let fruitIndex = 0; fruitIndex < fruitCount; fruitIndex++) {
      for (let fertIndex = 0; fertIndex < Number(fertilizeForFruit); fertIndex++) {
        await contract.connect(signer).fertilize();
        
        // ✅ 修复:除了最后一次施肥,每次都需要等待冷却
        const isLastFertilizeOfLastFruit = 
          fruitIndex === fruitCount - 1 && 
          fertIndex === Number(fertilizeForFruit) - 1;
        
        if (!isLastFertilizeOfLastFruit) {
          await time.increase(cooldownTime);
        }
      }
    }
  }


/**
 * 收获多次水果
 */
 export async function harvestMultipleTimes(
    contract: MagicTreeFHEOracle,
    signer: HardhatEthersSigner,
    times: number
  ) {
    const cooldownTime = await contract.COOLDOWN_TIME();
    
    for (let i = 0; i < times; i++) {
      // 创建水果(会自动处理冷却)
      await createFruits(contract, signer, 1);
      
      // 收获水果前需要等待冷却(因为最后一次施肥刚完成)
      await time.increase(cooldownTime);
      
      await contract.connect(signer).harvestFruit();
      
      // 如果不是最后一次收获,等待冷却后再继续
      if (i < times - 1) {
        await time.increase(cooldownTime);
      }
    }
  }

/**
 * 辅助函数：创建加密输入
 * @param contractAddress 合约地址
 * @param signerAddress 签名者地址
 * @param value 要加密的值
 */
export async function createEncryptedInput(
  contractAddress: string,
  signerAddress: string,
  value: number
) {
  return await fhevm
    .createEncryptedInput(contractAddress, signerAddress)
    .add32(value)
    .encrypt();
}

/**
 * 辅助函数：铸造树并获得指定数量的积分
 * @param contract 合约实例
 * @param signer 签名者
 * @param targetPoints 目标积分（大约值）
 */
export async function mintTreeWithPoints(
  contract: MagicTreeFHEOracle,
  signer: HardhatEthersSigner,
  targetPoints: number
): Promise<void> {
  const mintPrice = await contract.MINT_PRICE();
  await contract.connect(signer).mintTree({ value: mintPrice });

  // 每次收获大约获得 128-637 积分，取中间值 380
  const estimatedPointsPerHarvest = 380;
  const harvests = Math.ceil(targetPoints / estimatedPointsPerHarvest);

  await harvestMultipleTimes(contract, signer, harvests);
}

/**
 * 辅助函数：批量创建玩家
 * @param contract 合约实例
 * @param deployer 部署者（用于发送ETH）
 * @param count 玩家数量
 */
export async function createPlayers(
  contract: MagicTreeFHEOracle,
  deployer: HardhatEthersSigner,
  count: number
): Promise<void> {
  const mintPrice = await contract.MINT_PRICE();

  for (let i = 0; i < count; i++) {
    const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
    await deployer.sendTransaction({
      to: wallet.address,
      value: ethers.parseEther("1"),
    });
    await contract.connect(wallet).mintTree({ value: mintPrice });
  }
}

/**
 * 辅助函数：等待冷却时间结束
 * @param contract 合约实例
 * @param extraSeconds 额外等待的秒数
 */
export async function waitCooldown(
  contract: MagicTreeFHEOracle,
  extraSeconds: number = 0
): Promise<void> {
  const cooldownTime = await contract.COOLDOWN_TIME();
  await time.increase(BigInt(cooldownTime) + BigInt(extraSeconds));
}

/**
 * 辅助函数：前进到新的一天
 */
export async function advanceToNextDay(): Promise<void> {
  await time.increase(24 * 60 * 60);
}

/**
 * 辅助函数：获取当前区块时间
 */
export async function getCurrentBlockTime(): Promise<number> {
  const block = await ethers.provider.getBlock("latest");
  return block!.timestamp;
}

/**
 * 辅助函数：估算汇率
 * @param totalPlayers 总玩家数
 */
export function calculateExpectedRate(totalPlayers: number): number {
  const tier = Math.floor(totalPlayers / 500);
  return 1 + tier * 2;
}

/**
 * 辅助函数：估算代币数量
 * @param points 积分
 * @param rate 汇率
 */
export function calculateExpectedTokens(points: number, rate: number): bigint {
  return (BigInt(points) * BigInt(10 ** 18)) / BigInt(rate);
}

/**
 * 辅助函数：从事件日志中提取 redeemId
 * @param contract 合约实例
 * @param receipt 交易回执
 */
export function extractRedeemId(
  contract: MagicTreeFHEOracle,
  receipt: any
): number | null {
  const event = receipt?.logs.find((log: any) => {
    try {
      const parsed = contract.interface.parseLog(log);
      return parsed?.name === "RedeemRequested";
    } catch {
      return false;
    }
  });

  if (event) {
    const parsed = contract.interface.parseLog(event);
    return Number(parsed?.args[1]); // redeemId 是第二个参数
  }

  return null;
}

/**
 * 辅助函数：验证树的状态
 * @param contract 合约实例
 * @param userAddress 用户地址
 * @param expectedState 期望的状态
 */
export async function verifyTreeState(
  contract: MagicTreeFHEOracle,
  userAddress: string,
  expectedState: {
    exists?: boolean;
    fertilizeCount?: number;
    fruits?: number;
    dailyFertilizeCount?: number;
  }
): Promise<void> {
  const treeInfo = await contract.getTreeInfo(userAddress);

  if (expectedState.exists !== undefined) {
    if (treeInfo.exists !== expectedState.exists) {
      throw new Error(
        `Tree exists mismatch: expected ${expectedState.exists}, got ${treeInfo.exists}`
      );
    }
  }

  if (expectedState.fertilizeCount !== undefined) {
    if (treeInfo.fertilizeCount !== BigInt(expectedState.fertilizeCount)) {
      throw new Error(
        `Fertilize count mismatch: expected ${expectedState.fertilizeCount}, got ${treeInfo.fertilizeCount}`
      );
    }
  }

  if (expectedState.fruits !== undefined) {
    if (treeInfo.fruits !== BigInt(expectedState.fruits)) {
      throw new Error(
        `Fruits mismatch: expected ${expectedState.fruits}, got ${treeInfo.fruits}`
      );
    }
  }

  if (expectedState.dailyFertilizeCount !== undefined) {
    if (treeInfo.dailyFertilizeCount !== BigInt(expectedState.dailyFertilizeCount)) {
      throw new Error(
        `Daily fertilize count mismatch: expected ${expectedState.dailyFertilizeCount}, got ${treeInfo.dailyFertilizeCount}`
      );
    }
  }
}