// 合约配置文件 (FHE版本)
export const MAGIC_TREE_ADDRESS = process.env.NEXT_PUBLIC_MAGIC_TREE_CONTRACT || "YOUR_MAGIC_TREE_ADDRESS_HERE";
export const MAGIC_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_MAGIC_TOKEN_CONTRACT || "YOUR_MAGIC_TOKEN_ADDRESS_HERE";

// 🔥 MagicTree FHE 合约 ABI
export const MAGIC_TREE_ABI = [
  // ========== 原有基础功能 ==========
  "function mintTree() external payable",
  "function fertilize() external",
  "function harvestFruit() external",
  
  // 🔥 修改：getTreeInfo 返回加密的points (euint32)
  // 注意：euint32 在ABI中表示为 uint256，但实际是加密handle
  "function getTreeInfo(address user) external view returns (bool exists, uint256 fertilizeCount, uint256 lastActionTime, uint256 fruits, uint256 encryptedPoints, uint256 cooldownRemaining, uint256 dailyFertilizeCount, uint256 dailyFertilizeRemaining)",
  
  "function getLeaderboard(uint256 limit) external pure returns (address[] addresses, uint256[] points, uint256[] fertilizeCounts)",
  "function getTotalPlayers() external view returns (uint256)",
  
  // ========== 🔥 FHE 专用函数 ==========
  
  // 获取当前用户的加密积分handle
  "function getEncryptedPoints() external view returns (uint256)",
  
  // ========== 代币兑换功能 ==========
  
  "function getCurrentExchangeRate() public view returns (uint256)",
  
  // 🔥 更新：redeemTokens 接收3个参数
  // 参数1: inputEuint32 (externalEuint32 - 加密的积分输入)
  // 参数2: inputProof (bytes - 加密证明)
  // 参数3: decryptedAmount (uint256 - 解密后的明文积分，用于计算代币)
  "function redeemTokens(bytes32 inputEuint32, bytes calldata inputProof, uint256 decryptedAmount) external",
  
  "function getTokenRemainingPercentage() external view returns (uint256)",
  "function magicToken() external view returns (address)",
  "function TOTAL_TOKEN_SUPPLY() external view returns (uint256)",
  
  // ========== 常量 ==========
  "function MINT_PRICE() external view returns (uint256)",
  "function COOLDOWN_TIME() external view returns (uint256)",
  "function FERTILIZE_FOR_FRUIT() external view returns (uint256)",
  "function MAX_DAILY_FERTILIZE() external view returns (uint256)",
  
  // ========== 原有事件 ==========
  "event TreeMinted(address indexed owner, uint256 timestamp)",
  "event TreeFertilized(address indexed owner, uint256 count, uint256 timestamp)",
  "event FruitHarvested(address indexed owner, uint256 fruitCount, uint256 timestamp)",
  
  // 🔥 修改：FruitDecomposed 不再包含明文积分（因为是加密的）
  "event FruitDecomposed(address indexed owner, uint256 timestamp)",
  
  // 🔥 修改：TokensRedeemed 不再包含pointsSpent（因为是加密的）
  "event TokensRedeemed(address indexed user, uint256 tokensReceived, uint256 timestamp)"
];

// MagicToken 合约 ABI（与FHE无关，保持不变）
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

// 🔥 新增：支持的FHE网络
export const SUPPORTED_FHE_CHAINS = {
  // Zama Devnet
  8009: {
    name: "Zama Devnet",
    rpcUrl: "https://devnet.zama.ai",
    blockExplorer: "https://explorer.zama.ai"
  },
  // Sepolia (如果部署了FHE合约)
  11155111: {
    name: "Sepolia Testnet",
    rpcUrl: "https://sepolia.infura.io/v3/YOUR_INFURA_KEY",
    blockExplorer: "https://sepolia.etherscan.io"
  }
} as const;

// 向后兼容
export const CONTRACT_ADDRESS = MAGIC_TREE_ADDRESS;
export const CONTRACT_ABI = MAGIC_TREE_ABI;

// 🔥 类型定义：用于TypeScript类型检查
export interface TreeInfo {
  exists: boolean;
  fertilizeCount: bigint;
  lastActionTime: bigint;
  fruits: bigint;
  encryptedPoints: string;  // 🔥 加密handle（字符串格式）
  cooldownRemaining: bigint;
  dailyFertilizeCount: bigint;
  dailyFertilizeRemaining: bigint;
}

export interface LeaderboardEntry {
  address: string;
  points: bigint;
  fertilizeCount: bigint;
}

// 🔥 FHE相关常量
export const FHE_CONFIG = {
  // 解密签名有效期（天）
  SIGNATURE_VALIDITY_DAYS: 7,
  
  // 本地存储键前缀
  STORAGE_PREFIX: "magictree_fhe_",
  
  // 解密超时时间（毫秒）
  DECRYPT_TIMEOUT: 30000,
  
  // 自动重试次数
  MAX_RETRY_ATTEMPTS: 3,
} as const;