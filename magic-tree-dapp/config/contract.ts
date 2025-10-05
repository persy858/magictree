// 合约配置文件
export const MAGIC_TREE_ADDRESS = process.env.NEXT_PUBLIC_MAGIC_TREE_CONTRACT || "YOUR_MAGIC_TREE_ADDRESS_HERE";
export const MAGIC_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_MAGIC_TOKEN_CONTRACT || "YOUR_MAGIC_TOKEN_ADDRESS_HERE";

// MagicTree 合约 ABI（包含代币兑换功能）
export const MAGIC_TREE_ABI = [
  // 原有功能
  "function mintTree() external payable",
  "function fertilize() external",
  "function harvestFruit() external",
  "function getTreeInfo(address user) external view returns (bool exists, uint256 fertilizeCount, uint256 lastActionTime, uint256 fruits, uint256 points, uint256 cooldownRemaining, uint256 dailyFertilizeCount, uint256 dailyFertilizeRemaining)",
  "function getLeaderboard(uint256 limit) external view returns (address[] addresses, uint256[] points, uint256[] fertilizeCounts)",
  "function getTotalPlayers() external view returns (uint256)",
  
  // 代币兑换功能 (新增)
  "function getCurrentExchangeRate() public view returns (uint256)",
  "function redeemTokens(uint256 pointsToSpend) external",
  "function getTokenRemainingPercentage() external view returns (uint256)",
  "function magicToken() external view returns (address)",
  "function TOTAL_TOKEN_SUPPLY() external view returns (uint256)",
  
  // 原有事件
  "event TreeMinted(address indexed owner, uint256 timestamp)",
  "event TreeFertilized(address indexed owner, uint256 count, uint256 timestamp)",
  "event FruitHarvested(address indexed owner, uint256 fruitCount, uint256 timestamp)",
  "event FruitDecomposed(address indexed owner, uint256 points, uint256 timestamp)",
  
  // 代币兑换事件 (新增)
  "event TokensRedeemed(address indexed user, uint256 pointsSpent, uint256 tokensReceived, uint256 timestamp)"
];

// MagicToken 合约 ABI（可选，如果需要直接与代币交互）
export const MAGIC_TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  
  // MagicToken 特有功能
  "function MAX_SUPPLY() view returns (uint256)",
  "function remainingSupply() view returns (uint256)",
  "function minter() view returns (address)",
  "function minterSet() view returns (bool)",
  
  // 事件
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

// 网络配置
export const SEPOLIA_CHAIN_ID = 11155111;

// 向后兼容
export const CONTRACT_ADDRESS = MAGIC_TREE_ADDRESS;
export const CONTRACT_ABI = MAGIC_TREE_ABI;