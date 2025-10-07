// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

interface IMagicToken {
    function mint(address to, uint256 amount) external;
    function remainingSupply() external view returns (uint256);
    function MAX_SUPPLY() external view returns (uint256);
}

/**
 * @title MagicTreeFHE
 * @notice 使用FHE（全同态加密）保护用户积分隐私的神树合约
 * @dev 继承SepoliaConfig以支持FHEVM
 */
contract MagicTreeFHE is SepoliaConfig {
    // 🔥 神树结构 - points改为加密类型
    struct Tree {
        bool exists;
        uint256 fertilizeCount;
        uint256 lastActionTime;
        uint256 fruits;
        euint32 points;              // 🔥 加密的积分 (FHE)
        uint256 dailyFertilizeCount;
        uint256 lastFertilizeDate;
    }
    
    // 用户地址 => 神树数据
    mapping(address => Tree) public trees;
    
    // 排行榜：所有用户地址列表
    address[] public allPlayers;
    mapping(address => bool) private isPlayer;
    
    // 代币合约地址
    IMagicToken public immutable magicToken;
    
    // 代币总供应量（不可修改）
    uint256 public constant TOTAL_TOKEN_SUPPLY = 100_000_000 * 10**18;
    
    // 🔥 事件 - 修改为不包含敏感数据
    event TreeMinted(address indexed owner, uint256 timestamp);
    event TreeFertilized(address indexed owner, uint256 count, uint256 timestamp);
    event FruitHarvested(address indexed owner, uint256 fruitCount, uint256 timestamp);
    event FruitDecomposed(address indexed owner, uint256 timestamp); // 🔥 不包含积分
    event TokensRedeemed(address indexed user, uint256 tokensReceived, uint256 timestamp); // 🔥 不包含积分花费
    
    // Mint价格
    uint256 public constant MINT_PRICE = 0.01 ether;
    
    // 冷却时间
    uint256 public constant COOLDOWN_TIME = 20 seconds;
    
    // 结果实所需施肥次数
    uint256 public constant FERTILIZE_FOR_FRUIT = 5;
    
    // 每日最大施肥次数
    uint256 public constant MAX_DAILY_FERTILIZE = 30;
    
    // 合约所有者
    address public owner;
    
    constructor(address _tokenAddress) {
        owner = msg.sender;
        magicToken = IMagicToken(_tokenAddress);
    }
    
    // Mint神树
    function mintTree() external payable {
        require(!trees[msg.sender].exists, "Tree already exists");
        require(msg.value == MINT_PRICE, "Incorrect ETH amount");
        
        // 🔥 初始化加密的积分为0
        euint32 initialPoints = FHE.asEuint32(0);
        
        trees[msg.sender] = Tree({
            exists: true,
            fertilizeCount: 0,
            lastActionTime: 0,
            fruits: 0,
            points: initialPoints,
            dailyFertilizeCount: 0,
            lastFertilizeDate: 0
        });
        
        // 🔥 设置FHE权限
        FHE.allowThis(trees[msg.sender].points);
        FHE.allow(trees[msg.sender].points, msg.sender);
        
        // 添加到玩家列表
        if (!isPlayer[msg.sender]) {
            allPlayers.push(msg.sender);
            isPlayer[msg.sender] = true;
        }
        
        emit TreeMinted(msg.sender, block.timestamp);
    }
    
    // 施肥
    function fertilize() external {
        Tree storage tree = trees[msg.sender];
        require(tree.exists, "Tree does not exist");
        require(
            tree.lastActionTime == 0 || block.timestamp >= tree.lastActionTime + COOLDOWN_TIME, 
            "Cooldown not finished"
        );
        
        // 获取当前日期（天数）
        uint256 currentDay = block.timestamp / 1 days;
        
        // 如果是新的一天，重置每日计数
        if (tree.lastFertilizeDate != currentDay) {
            tree.dailyFertilizeCount = 0;
            tree.lastFertilizeDate = currentDay;
        }
        
        // 检查每日限制
        require(tree.dailyFertilizeCount < MAX_DAILY_FERTILIZE, "Daily fertilize limit reached");
        
        tree.fertilizeCount++;
        tree.dailyFertilizeCount++;
        tree.lastActionTime = block.timestamp;
        
        // 每5次施肥结出1个果实
        if (tree.fertilizeCount % FERTILIZE_FOR_FRUIT == 0) {
            tree.fruits++;
            emit FruitHarvested(msg.sender, tree.fruits, block.timestamp);
        }
        
        emit TreeFertilized(msg.sender, tree.fertilizeCount, block.timestamp);
    }
    
    // 🔥 采摘果实（使用FHE随机数生成加密积分）
    function harvestFruit() external {
        Tree storage tree = trees[msg.sender];
        require(tree.exists, "Tree does not exist");
        require(tree.fruits > 0, "No fruits to harvest");
        
        tree.fruits--;
        
       // 🔥 使用低位比特来生成随机数
        // 取随机数的低9位（0-511），然后映射到128-639
        euint32 randomValue = FHE.randEuint32();
        
        // 取低9位：0-511
        euint32 mask = FHE.asEuint32(511);  // 2^9 - 1
        euint32 lowBits = FHE.and(randomValue, mask);
        
        // 加上最小值128，得到范围 128-639（跨度512）
        euint32 minValue = FHE.asEuint32(128);
        euint32 randomPoints = FHE.add(lowBits, minValue);
        
        // 🔥 FHE加法：增加加密积分
        tree.points = FHE.add(tree.points, randomPoints);
        
        // 🔥 更新FHE权限
        FHE.allowThis(tree.points);
        FHE.allow(tree.points, msg.sender);
        
        // 🔥 事件不包含积分（因为是加密的）
        emit FruitDecomposed(msg.sender, block.timestamp);
    }
    
    // 🔥 获取加密的积分handle（供前端解密使用）
    function getEncryptedPoints() external view returns (euint32) {
        require(trees[msg.sender].exists, "Tree does not exist");
        return trees[msg.sender].points;
    }
    
    // 计算当前兑换比例（多少积分换1个代币）
    function getCurrentExchangeRate() public view returns (uint256) {
        uint256 totalPlayers = allPlayers.length;
        uint256 tier = totalPlayers / 500;
        // 0-499人: tier=0, rate=1 (1积分=1代币)
        // 500-999人: tier=1, rate=3 (3积分=1代币)
        // 1000-1499人: tier=2, rate=5 (5积分=1代币)
        return 1 + (tier * 2);
    }
    
    // 🔥 兑换代币（使用 FHE 加密输入）
    /**
     * @notice 兑换代币 - 用户提交加密的积分数量
     * @param inputEuint32 加密的积分输入（要花费的积分）
     * @param inputProof 输入证明
     * @param decryptedAmount 解密后的积分数量（用于计算代币，前端提供）
     * 
     * 工作流程：
     * 1. 用户在前端解密当前积分
     * 2. 用户加密要花费的积分数量并生成证明
     * 3. 合约扣除加密积分（如果余额不足会下溢导致 revert）
     * 4. 使用解密值计算代币数量并铸造
     * 
     * ⚠️ 注意：
     * - FHE.sub 如果发生下溢会自动 revert
     * - 前端需要确保 decryptedAmount 与加密输入一致
     */
    function redeemTokens(
        externalEuint32 inputEuint32,
        bytes calldata inputProof,
        uint256 decryptedAmount
    ) external {
        Tree storage tree = trees[msg.sender];
        require(tree.exists, "Tree does not exist");
        require(decryptedAmount > 0, "Amount must be greater than 0");
        
        // 🔥 转换外部加密输入为内部加密类型
        euint32 pointsToSpend = FHE.fromExternal(inputEuint32, inputProof);
        
        // 计算当前兑换比例
        uint256 rate = getCurrentExchangeRate();
        
        // 使用解密值计算代币数量（带18位小数）
        uint256 tokensToReceive = (decryptedAmount * 10**18) / rate;
        
        // 检查代币剩余量
        uint256 remainingTokens = magicToken.remainingSupply();
        require(tokensToReceive <= remainingTokens, "Not enough tokens left");
        
        // 🔥 扣除加密积分
        // 注意：如果 tree.points < pointsToSpend，FHE.sub 会导致下溢
        // 这会使交易 revert，从而保护用户不会花费超过拥有的积分
        tree.points = FHE.sub(tree.points, pointsToSpend);
        
        // 🔥 更新 FHE 权限
        FHE.allowThis(tree.points);
        FHE.allow(tree.points, msg.sender);
        
        // 铸造代币给用户
        magicToken.mint(msg.sender, tokensToReceive);
        
        emit TokensRedeemed(msg.sender, tokensToReceive, block.timestamp);
    }
    
    // 获取代币剩余量百分比
    function getTokenRemainingPercentage() external view returns (uint256) {
        if (TOTAL_TOKEN_SUPPLY == 0) return 0;
        uint256 remaining = magicToken.remainingSupply();
        return (remaining * 10000) / TOTAL_TOKEN_SUPPLY;
    }
    
    // 🔥 获取用户神树信息（返回加密的points handle）
    function getTreeInfo(address user) external view returns (
        bool exists,
        uint256 fertilizeCount,
        uint256 lastActionTime,
        uint256 fruits,
        euint32 encryptedPoints,      // 🔥 返回加密handle
        uint256 cooldownRemaining,
        uint256 dailyFertilizeCount,
        uint256 dailyFertilizeRemaining
    ) {
        Tree memory tree = trees[user];
        uint256 cooldown = 0;
        
        if (tree.exists && tree.lastActionTime > 0 && block.timestamp < tree.lastActionTime + COOLDOWN_TIME) {
            cooldown = (tree.lastActionTime + COOLDOWN_TIME) - block.timestamp;
        }
        
        // 计算今日剩余施肥次数
        uint256 currentDay = block.timestamp / 1 days;
        uint256 dailyCount = tree.lastFertilizeDate == currentDay ? tree.dailyFertilizeCount : 0;
        uint256 dailyRemaining = MAX_DAILY_FERTILIZE > dailyCount ? MAX_DAILY_FERTILIZE - dailyCount : 0;
        
        return (
            tree.exists,
            tree.fertilizeCount,
            tree.lastActionTime,
            tree.fruits,
            tree.points,              // 🔥 返回加密handle
            cooldown,
            dailyCount,
            dailyRemaining
        );
    }
    
    // 提取合约余额（仅合约所有者）
    function withdraw() external {
        require(msg.sender == owner, "Only owner can withdraw");
        (bool success, ) = payable(owner).call{value: address(this).balance}("");
        require(success, "Transfer failed");
    }
    
    // 获取合约余额
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    // 🔥 注意：排行榜功能在FHE版本中无法直接实现
    // 因为积分是加密的，无法链上排序
    // 可以考虑使用链下索引或零知识证明实现
    function getLeaderboard(uint256 /* limit */) external pure returns (
        address[] memory /* addresses */,
        uint256[] memory /* points */,
        uint256[] memory /* fertilizeCounts */
    ) {
        // FHE版本中无法实现排行榜
        // 返回空数组或使用链下解决方案
        revert("Leaderboard not available in FHE version - use off-chain indexing");
    }
    
    // 获取总玩家数
    function getTotalPlayers() external view returns (uint256) {
        return allPlayers.length;
    }
}