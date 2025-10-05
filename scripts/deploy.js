import hre from "hardhat";

async function main() {
  console.log("🌳 开始部署神树合约...");

  // 获取部署账户
  const [deployer] = await hre.ethers.getSigners();
  console.log("部署账户:", deployer.address);
  
  // 检查账户余额
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("账户余额:", hre.ethers.formatEther(balance), "ETH");

  // 部署合约
  const MagicTree = await hre.ethers.getContractFactory("MagicTree");
  console.log("\n⏳ 正在部署合约...");
  
  const magicTree = await MagicTree.deploy();
  await magicTree.waitForDeployment();
  
  const contractAddress = await magicTree.getAddress();
  
  console.log("\n✅ 神树合约部署成功!");
  console.log("📍 合约地址:", contractAddress);
  console.log("🔗 Etherscan:", `https://sepolia.etherscan.io/address/${contractAddress}`);
  console.log("\n📝 请将此地址更新到前端 HTML 文件的 CONTRACT_ADDRESS 变量中");
  
  // 等待几个区块确认后再验证
  console.log("\n⏳ 等待 5 个区块确认...");
  await magicTree.deploymentTransaction().wait(5);
  console.log("✅ 区块已确认");
  
  // 验证合约
  console.log("\n🔍 开始验证合约...");
  try {
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: [],
    });
    console.log("✅ 合约验证成功!");
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("ℹ️ 合约已经验证过了");
    } else {
      console.log("❌ 合约验证失败:", error.message);
      console.log("💡 你可以稍后手动验证合约");
    }
  }

  console.log("\n🎉 部署完成！下一步:");
  console.log("1. 更新前端的 CONTRACT_ADDRESS");
  console.log("2. 在 Sepolia 水龙头获取测试 ETH");
  console.log("3. 开始使用你的神树 DApp!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });