// 合约配置文件
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "YOUR_CONTRACT_ADDRESS_HERE";

export const CONTRACT_ABI = [
  "function mintTree() external payable",
  "function fertilize() external",
  "function harvestFruit() external",
  "function getTreeInfo(address user) external view returns (bool exists, uint256 fertilizeCount, uint256 lastActionTime, uint256 fruits, uint256 points, uint256 cooldownRemaining)",
  "function getLeaderboard(uint256 limit) external view returns (address[] addresses, uint256[] points, uint256[] fertilizeCounts)",
  "function getTotalPlayers() external view returns (uint256)",
  "event TreeMinted(address indexed owner, uint256 timestamp)",
  "event TreeFertilized(address indexed owner, uint256 count, uint256 timestamp)",
  "event FruitHarvested(address indexed owner, uint256 fruitCount, uint256 timestamp)",
  "event FruitDecomposed(address indexed owner, uint256 points, uint256 timestamp)"
];

export const SEPOLIA_CHAIN_ID = 11155111;