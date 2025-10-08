import hre from "hardhat";

async function main() {
  console.log("🚀 Starting MagicTreeFHE deployment...\n");
  console.log("⚠️  IMPORTANT: This requires FHEVM-compatible network (e.g., Zama Devnet)\n");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Step 1: Deploy MagicToken
  console.log("━".repeat(60));
  console.log("Step 1/3: Deploying MagicToken...");
  console.log("━".repeat(60));
  
  const MagicToken = await hre.ethers.getContractFactory("MagicToken");
  const magicToken = await MagicToken.deploy();
  await magicToken.waitForDeployment();
  
  const tokenAddress = await magicToken.getAddress();
  console.log("✅ MagicToken deployed to:", tokenAddress);
  console.log("   - Name:", await magicToken.name());
  console.log("   - Symbol:", await magicToken.symbol());
  console.log("   - Max supply:", hre.ethers.formatEther(await magicToken.MAX_SUPPLY()), "MTT");
  console.log("   - Decimals:", await magicToken.decimals(), "\n");

  // Step 2: Deploy MagicTreeFHE
  console.log("━".repeat(60));
  console.log("Step 2/3: Deploying MagicTreeFHE (FHE Version)...");
  console.log("━".repeat(60));
  
  const MagicTreeFHE = await hre.ethers.getContractFactory("MagicTreeFHEOracle");
  console.log("   Compiling FHE contract...");
  
  const magicTree = await MagicTreeFHE.deploy(tokenAddress);
  await magicTree.waitForDeployment();
  
  const treeAddress = await magicTree.getAddress();
  console.log("✅ MagicTreeFHE deployed to:", treeAddress);
  console.log("   - Mint price:", hre.ethers.formatEther(await magicTree.MINT_PRICE()), "ETH");
  console.log("   - Cooldown:", await magicTree.COOLDOWN_TIME(), "seconds");
  console.log("   - Daily limit:", await magicTree.MAX_DAILY_FERTILIZE(), "fertilizes");
  console.log("   - Fertilize for fruit:", await magicTree.FERTILIZE_FOR_FRUIT());
  console.log("   - 🔒 FHE: Points are encrypted (euint32)\n");

  // Step 3: Set Minter
  console.log("━".repeat(60));
  console.log("Step 3/3: Setting minter permission...");
  console.log("━".repeat(60));
  
  const setMinterTx = await magicToken.setMinter(treeAddress);
  await setMinterTx.wait();
  
  console.log("✅ Minter set successfully!");
  console.log("⚠️  WARNING: Minter is now permanently locked to MagicTreeFHE\n");

  // Verification
  console.log("━".repeat(60));
  console.log("Verifying deployment configuration...");
  console.log("━".repeat(60));
  
  const minter = await magicToken.minter();
  const minterSet = await magicToken.minterSet();
  const treeToken = await magicTree.magicToken();
  const initialRate = await magicTree.getCurrentExchangeRate();
  const percentage = await magicTree.getTokenRemainingPercentage();
  const totalPlayers = await magicTree.getTotalPlayers();
  
  console.log("Minter address:", minter);
  console.log("Minter locked:", minterSet ? "✅ Yes" : "❌ No");
  console.log("Tree token address:", treeToken);
  console.log("Initial exchange rate:", initialRate.toString(), "points = 1 MTT");
  console.log("Token remaining:", (Number(percentage) / 100).toFixed(2), "%");
  console.log("Total players:", totalPlayers.toString(), "\n");
  
  // Validate
  let errors = 0;
  
  if (minter.toLowerCase() !== treeAddress.toLowerCase()) {
    console.log("❌ ERROR: Minter address mismatch!");
    errors++;
  }
  if (!minterSet) {
    console.log("❌ ERROR: Minter not locked!");
    errors++;
  }
  if (treeToken.toLowerCase() !== tokenAddress.toLowerCase()) {
    console.log("❌ ERROR: Token address mismatch!");
    errors++;
  }
  
  if (errors === 0) {
    console.log("✅ All validations passed!\n");
  } else {
    console.log(`\n❌ Found ${errors} error(s)!\n`);
    process.exit(1);
  }

  // Summary
  console.log("═".repeat(60));
  console.log("         🎉 DEPLOYMENT SUCCESSFUL (FHE VERSION)");
  console.log("═".repeat(60));
  console.log("\n📋 Contract Addresses:\n");
  console.log("   MagicToken:   ", tokenAddress);
  console.log("   MagicTreeFHE: ", treeAddress);
  
  // Network-specific explorers
  const network = hre.network.name;
  console.log("\n🔍 Block Explorer:\n");
  
  if (network === "zamaDevnet" || network === "zama") {
    console.log(`   Token: https://explorer.zama.ai/address/${tokenAddress}`);
    console.log(`   Tree:  https://explorer.zama.ai/address/${treeAddress}`);
  } else if (network === "sepolia") {
    console.log(`   Token: https://sepolia.etherscan.io/address/${tokenAddress}`);
    console.log(`   Tree:  https://sepolia.etherscan.io/address/${treeAddress}`);
  } else {
    console.log(`   Network: ${network}`);
    console.log(`   Token: ${tokenAddress}`);
    console.log(`   Tree:  ${treeAddress}`);
  }
  
  console.log("\n" + "═".repeat(60));

  // Environment variables for frontend
  console.log("\n📝 Frontend Configuration:\n");
  console.log("Add these to your .env.local or config file:\n");
  console.log(`NEXT_PUBLIC_MAGIC_TOKEN_CONTRACT=${tokenAddress}`);
  console.log(`NEXT_PUBLIC_MAGIC_TREE_CONTRACT=${treeAddress}`);
  console.log(`NEXT_PUBLIC_NETWORK=${network}`);
  console.log(`NEXT_PUBLIC_CHAIN_ID=${(await hre.ethers.provider.getNetwork()).chainId}\n`);

  // Contract verification commands
  console.log("━".repeat(60));
  console.log("📜 Contract Verification Commands:\n");
  console.log(`npx hardhat verify --network ${network} ${tokenAddress}`);
  console.log(`npx hardhat verify --network ${network} ${treeAddress} ${tokenAddress}\n`);
  console.log("━".repeat(60));

  // Next steps
  console.log("\n✨ Next Steps:\n");
  console.log("1. ✅ Update frontend config with contract addresses");
  console.log("2. ✅ Test basic functions (mint, fertilize, harvest)");
  console.log("3. 🔐 Test FHE features:");
  console.log("   - Encrypted points display");
  console.log("   - Points decryption");
  console.log("   - Encrypted token redemption");
  console.log("4. ✅ Deploy frontend to production");
  console.log("5. 🎮 Start your game!\n");

  // Important notes
  console.log("⚠️  IMPORTANT NOTES:\n");
  console.log("• Points are encrypted using FHE (Fully Homomorphic Encryption)");
  console.log("• Users need to decrypt points using FHEVM client");
  console.log("• Leaderboard is NOT available (use off-chain indexing)");
  console.log("• Gas costs are higher than non-FHE version");
  console.log("• Make sure frontend has @fhevm/react installed");
  console.log("");

  return {
    magicToken: tokenAddress,
    magicTree: treeAddress,
    deployer: deployer.address,
    network: network,
    chainId: (await hre.ethers.provider.getNetwork()).chainId
  };
}

main()
  .then(() => {
    console.log("🎊 Deployment completed successfully!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    console.log("\n💡 Troubleshooting:");
    console.log("   - Check if you're connected to an FHEVM-compatible network");
    console.log("   - Verify you have enough ETH for gas");
    console.log("   - Ensure @fhevm/solidity is properly installed");
    console.log("");
    process.exit(1);
  });

export default main;