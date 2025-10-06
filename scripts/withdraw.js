import hre from "hardhat";

async function main() {
  const contractAddress = "0x560745De9B5b364C2ee90AaE1354897853344E0B";
  
  console.log("💰 开始提取合约余额...");
  
  // 获取合约实例
  const MagicTree = await hre.ethers.getContractFactory("MagicTree");
  const magicTree = MagicTree.attach(contractAddress);
  
  // 获取当前账户
  const [owner] = await hre.ethers.getSigners();
  console.log("提取账户:", owner.address);
  
  // 获取合约余额
  const balance = await magicTree.getBalance();
  console.log("合约余额:", hre.ethers.formatEther(balance), "ETH");
  
  if (balance === 0n) {
    console.log("⚠️ 合约余额为 0，无需提取");
    return;
  }
  
  // 获取提取前的钱包余额
  const balanceBefore = await hre.ethers.provider.getBalance(owner.address);
  console.log("钱包余额(提取前):", hre.ethers.formatEther(balanceBefore), "ETH");
  
  // 提取
  console.log("\n⏳ 正在提取...");
  const tx = await magicTree.withdraw();
  console.log("交易哈希:", tx.hash);
  
  const receipt = await tx.wait();
  console.log("✅ 交易已确认，区块:", receipt.blockNumber);
  
  // 获取提取后的余额
  const balanceAfter = await hre.ethers.provider.getBalance(owner.address);
  console.log("\n钱包余额(提取后):", hre.ethers.formatEther(balanceAfter), "ETH");
  
  // 计算实际收到的金额（扣除 gas 费）
  const gasUsed = receipt.gasUsed * receipt.gasPrice;
  const netReceived = balance - gasUsed;
  console.log("Gas 费用:", hre.ethers.formatEther(gasUsed), "ETH");
  console.log("实际收到:", hre.ethers.formatEther(netReceived), "ETH");
  
  console.log("\n🎉 提取完成!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });