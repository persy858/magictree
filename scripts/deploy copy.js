import hre from "hardhat";

async function main() {
  console.log("Starting Magic Tree deployment...\n");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Step 1: Deploy MagicToken
  console.log("Step 1/3: Deploying MagicToken...");
  const MagicToken = await hre.ethers.getContractFactory("MagicToken");
  const magicToken = await MagicToken.deploy();
  await magicToken.waitForDeployment();
  
  const tokenAddress = await magicToken.getAddress();
  console.log("MagicToken deployed to:", tokenAddress);
  console.log("Max supply:", hre.ethers.formatEther(await magicToken.MAX_SUPPLY()), "MTT\n");

  // Step 2: Deploy MagicTree
  console.log("Step 2/3: Deploying MagicTree...");
  const MagicTree = await hre.ethers.getContractFactory("MagicTree");
  const magicTree = await MagicTree.deploy(tokenAddress);
  await magicTree.waitForDeployment();
  
  const treeAddress = await magicTree.getAddress();
  console.log("MagicTree deployed to:", treeAddress);
  console.log("Mint price:", hre.ethers.formatEther(await magicTree.MINT_PRICE()), "ETH");
  console.log("Cooldown:", await magicTree.COOLDOWN_TIME(), "seconds");
  console.log("Daily limit:", await magicTree.MAX_DAILY_FERTILIZE(), "fertilizes\n");

  // Step 3: Set Minter
  console.log("Step 3/3: Setting minter permission...");
  const setMinterTx = await magicToken.setMinter(treeAddress);
  await setMinterTx.wait();
  console.log("Minter set successfully!");
  console.log("WARNING: Minter is now permanently locked\n");

  // Verification
  console.log("Verifying deployment...");
  
  const minter = await magicToken.minter();
  const minterSet = await magicToken.minterSet();
  const treeToken = await magicTree.magicToken();
  const initialRate = await magicTree.getCurrentExchangeRate();
  const percentage = await magicTree.getTokenRemainingPercentage();
  
  console.log("Minter address:", minter);
  console.log("Minter locked:", minterSet);
  console.log("Tree token address:", treeToken);
  console.log("Initial exchange rate:", initialRate.toString(), "points = 1 MTT");
  console.log("Token remaining:", (Number(percentage) / 100).toFixed(2), "%\n");
  
  // Validate
  let errors = 0;
  if (minter.toLowerCase() !== treeAddress.toLowerCase()) {
    console.log("ERROR: Minter address mismatch!");
    errors++;
  }
  if (!minterSet) {
    console.log("ERROR: Minter not locked!");
    errors++;
  }
  if (treeToken.toLowerCase() !== tokenAddress.toLowerCase()) {
    console.log("ERROR: Token address mismatch!");
    errors++;
  }
  
  if (errors === 0) {
    console.log("All validations passed!\n");
  } else {
    console.log(`\nFound ${errors} error(s)!\n`);
    process.exit(1);
  }

  // Summary
  console.log("=".repeat(60));
  console.log("Deployment Summary\n");
  console.log("MagicToken:", tokenAddress);
  console.log("MagicTree:", treeAddress);
  console.log("\nEtherscan (Sepolia):");
  console.log(`  Token: https://sepolia.etherscan.io/address/${tokenAddress}`);
  console.log(`  Tree:  https://sepolia.etherscan.io/address/${treeAddress}`);
  console.log("=".repeat(60));

  // Environment variables
  console.log("\nAdd to .env.local:\n");
  console.log(`NEXT_PUBLIC_MAGIC_TOKEN_CONTRACT=${tokenAddress}`);
  console.log(`NEXT_PUBLIC_MAGIC_TREE_CONTRACT=${treeAddress}\n`);

  // Verification commands
  console.log("To verify contracts:\n");
  console.log(`npx hardhat verify --network sepolia ${tokenAddress}`);
  console.log(`npx hardhat verify --network sepolia ${treeAddress} ${tokenAddress}\n`);

  return {
    magicToken: tokenAddress,
    magicTree: treeAddress,
    deployer: deployer.address
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });

export default main;