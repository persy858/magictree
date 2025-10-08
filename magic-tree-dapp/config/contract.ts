// contract.ts - 完整更新版本
export const MAGIC_TREE_ADDRESS = process.env.NEXT_PUBLIC_MAGIC_TREE_CONTRACT || "YOUR_MAGIC_TREE_ADDRESS_HERE";
export const MAGIC_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_MAGIC_TOKEN_CONTRACT || "YOUR_MAGIC_TOKEN_ADDRESS_HERE";

// 🔥 MagicTree FHE 合约 ABI（支持异步解密）
export const MAGIC_TREE_ABI = [
  // ========== 基础功能 ==========
  "function mintTree() external payable",
  "function fertilize() external",
  "function harvestFruit() external",
  
  "function getTreeInfo(address user) external view returns (bool exists, uint256 fertilizeCount, uint256 lastActionTime, uint256 fruits, uint256 encryptedPoints, uint256 cooldownRemaining, uint256 dailyFertilizeCount, uint256 dailyFertilizeRemaining)",
  
  "function getLeaderboard(uint256 limit) external pure returns (address[] addresses, uint256[] points, uint256[] fertilizeCounts)",
  "function getTotalPlayers() external view returns (uint256)",
  
  // ========== FHE 专用函数 ==========
  "function getEncryptedPoints() external view returns (uint256)",
  
  // ========== 🔥 代币兑换功能（两步异步解密） ==========
  
  "function getCurrentExchangeRate() public view returns (uint256)",
  
  // 🔥 步骤1：请求兑换代币
  // 参数1: encryptedAmount (externalEuint32 - 加密的积分输入，在 ABI 中表示为 bytes32)
  // 参数2: claimedAmount (uint256 - 用户声称的明文积分)
  // 参数3: inputProof (bytes - 加密证明)
  // 返回: redeemId (uint256 - 兑换请求ID)
  "function requestRedeemTokens(bytes32 encryptedAmount, uint256 claimedAmount, bytes calldata inputProof) external returns (uint256)",
  
  // 🔥 步骤2：请求解密（触发 Oracle）
  // 参数: redeemId (uint256 - 兑换请求ID)
  "function requestDecryption(uint256 redeemId) external",
  
  // 🔥 步骤3：回调函数（由 Oracle 自动调用）
  "function callbackRedeemTokens(uint256 requestId, bytes memory cleartexts, bytes memory decryptionProof) external",
  
  // 🔥 查询函数
  "function getRedeemStatus(uint256 redeemId) external view returns (address user, uint256 claimedAmount, bool isResolved, uint32 revealedSpend, uint32 revealedTotal, uint256 decryptionRequestId)",
  
  "function isDecryptionRequested(uint256 redeemId) external view returns (bool)",
  
  "function getUserLatestRequest(address user) external view returns (uint256)",
  
  "function getTokenRemainingPercentage() external view returns (uint256)",
  "function magicToken() external view returns (address)",
  "function TOTAL_TOKEN_SUPPLY() external view returns (uint256)",
  
  // ========== 常量 ==========
  "function MINT_PRICE() external view returns (uint256)",
  "function COOLDOWN_TIME() external view returns (uint256)",
  "function FERTILIZE_FOR_FRUIT() external view returns (uint256)",
  "function MAX_DAILY_FERTILIZE() external view returns (uint256)",
  
  // ========== 事件 ==========
  "event TreeMinted(address indexed owner, uint256 timestamp)",
  "event TreeFertilized(address indexed owner, uint256 count, uint256 timestamp)",
  "event FruitHarvested(address indexed owner, uint256 fruitCount, uint256 timestamp)",
  "event FruitDecomposed(address indexed owner, uint256 timestamp)",
  
  // 🔥 兑换相关事件
  "event RedeemRequested(address indexed user, uint256 redeemId, uint256 claimedAmount, uint256 timestamp)",
  "event DecryptionRequested(uint256 redeemId, uint256 decryptionRequestId)",
  "event RedeemProcessed(address indexed user, uint256 redeemId, uint32 actualAmount, uint256 tokensReceived)",
  "event RedeemFailed(address indexed user, uint256 redeemId, string reason)"
];

// MagicToken 合约 ABI（保持不变）
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
  "function MAX_SUPPLY() view returns (uint256)",
  "function remainingSupply() view returns (uint256)",
  "function minter() view returns (address)",
  "function minterSet() view returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

// 网络配置
export const SEPOLIA_CHAIN_ID = 11155111;

export const SUPPORTED_FHE_CHAINS = {
  8009: {
    name: "Zama Devnet",
    rpcUrl: "https://devnet.zama.ai",
    blockExplorer: "https://explorer.zama.ai"
  },
  11155111: {
    name: "Sepolia Testnet",
    rpcUrl: "https://sepolia.infura.io/v3/YOUR_INFURA_KEY",
    blockExplorer: "https://sepolia.etherscan.io"
  }
} as const;

export const CONTRACT_ADDRESS = MAGIC_TREE_ADDRESS;
export const CONTRACT_ABI = MAGIC_TREE_ABI;

// 🔥 类型定义
export interface TreeInfo {
  exists: boolean;
  fertilizeCount: bigint;
  lastActionTime: bigint;
  fruits: bigint;
  encryptedPoints: string;
  cooldownRemaining: bigint;
  dailyFertilizeCount: bigint;
  dailyFertilizeRemaining: bigint;
}

export interface LeaderboardEntry {
  address: string;
  points: bigint;
  fertilizeCount: bigint;
}

// 🔥 新增：兑换请求状态
export interface RedeemStatus {
  user: string;
  claimedAmount: bigint;
  isResolved: boolean;
  revealedSpend: number;
  revealedTotal: number;
  decryptionRequestId: bigint;
}

export const FHE_CONFIG = {
  SIGNATURE_VALIDITY_DAYS: 7,
  STORAGE_PREFIX: "magictree_fhe_",
  DECRYPT_TIMEOUT: 30000,
  MAX_RETRY_ATTEMPTS: 3,
  
  // 🔥 Oracle 相关配置
  ORACLE_CHECK_INTERVAL: 5000,      // 每5秒检查一次
  ORACLE_MAX_WAIT_TIME: 120000,     // 最多等待2分钟
} as const;