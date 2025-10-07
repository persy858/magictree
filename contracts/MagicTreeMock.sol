// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IMagicToken {
    function mint(address to, uint256 amount) external;
    function remainingSupply() external view returns (uint256);
    function MAX_SUPPLY() external view returns (uint256);
}

/**
 * @title MagicTreeMock
 * @notice Mock版本的MagicTree合约，用于本地Hardhat测试
 * @dev 使用普通uint256代替加密的euint32，模拟FHE功能
 */
contract MagicTreeMock {
    // 神树结构 - points改为普通类型用于测试
    struct Tree {
        bool exists;
        uint256 fertilizeCount;
        uint256 lastActionTime;
        uint256 fruits;
        uint256 points;              // Mock: 使用普通uint256
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
    
    // 代币总供应量
    uint256 public constant TOTAL_TOKEN_SUPPLY = 100_000_000 * 10**18;
    
    // 事件
    event TreeMinted(address indexed owner, uint256 timestamp);
    event TreeFertilized(address indexed owner, uint256 count, uint256 timestamp);
    event FruitHarvested(address indexed owner, uint256 fruitCount, uint256 timestamp);
    event FruitDecomposed(address indexed owner, uint256 timestamp);
    event TokensRedeemed(address indexed user, uint256 tokensReceived, uint256 timestamp);
    
    // Mint价格
    uint256 public constant MINT_PRICE = 0.01 ether;
    
    // 冷却时间
    uint256 public constant COOLDOWN_TIME = 30 seconds;
    
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
        
        trees[msg.sender] = Tree({
            exists: true,
            fertilizeCount: 0,
            lastActionTime: 0,
            fruits: 0,
            points: 0,  // Mock: 初始化为0
            dailyFertilizeCount: 0,
            lastFertilizeDate: 0
        });
        
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
        
        uint256 currentDay = block.timestamp / 1 days;
        
        if (tree.lastFertilizeDate != currentDay) {
            tree.dailyFertilizeCount = 0;
            tree.lastFertilizeDate = currentDay;
        }
        
        require(tree.dailyFertilizeCount < MAX_DAILY_FERTILIZE, "Daily fertilize limit reached");
        
        tree.fertilizeCount++;
        tree.dailyFertilizeCount++;
        tree.lastActionTime = block.timestamp;
        
        if (tree.fertilizeCount % FERTILIZE_FOR_FRUIT == 0) {
            tree.fruits++;
            emit FruitHarvested(msg.sender, tree.fruits, block.timestamp);
        }
        
        emit TreeFertilized(msg.sender, tree.fertilizeCount, block.timestamp);
    }
    
    // 采摘果实 - Mock版本使用确定性随机数
    function harvestFruit() external {
        Tree storage tree = trees[msg.sender];
        require(tree.exists, "Tree does not exist");
        require(tree.fruits > 0, "No fruits to harvest");
        
        tree.fruits--;
        
        // Mock: 使用伪随机数生成100-500的积分
        uint256 randomPoints = _mockRandom(100, 500);
        tree.points += randomPoints;
        
        emit FruitDecomposed(msg.sender, block.timestamp);
    }
    
    // Mock随机数生成器
    function _mockRandom(uint256 min, uint256 max) private view returns (uint256) {
        uint256 random = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            trees[msg.sender].fertilizeCount
        )));
        return min + (random % (max - min + 1));
    }
    
    // 获取积分 - Mock版本返回明文
    function getEncryptedPoints() external view returns (uint256) {
        require(trees[msg.sender].exists, "Tree does not exist");
        return trees[msg.sender].points;
    }
    
    // 计算当前兑换比例
    function getCurrentExchangeRate() public view returns (uint256) {
        uint256 totalPlayers = allPlayers.length;
        uint256 tier = totalPlayers / 500;
        return 1 + (tier * 2);
    }
    
    // 兑换代币 - Mock版本使用普通参数
    function redeemTokens(uint256 pointsToSpend) external {
        Tree storage tree = trees[msg.sender];
        require(tree.exists, "Tree does not exist");
        require(pointsToSpend > 0, "Points must be greater than 0");
        require(tree.points >= pointsToSpend, "Insufficient points");
        
        uint256 rate = getCurrentExchangeRate();
        uint256 tokensToReceive = (pointsToSpend * 10**18) / rate;
        
        uint256 remainingTokens = magicToken.remainingSupply();
        require(tokensToReceive <= remainingTokens, "Not enough tokens left");
        
        tree.points -= pointsToSpend;
        
        magicToken.mint(msg.sender, tokensToReceive);
        
        emit TokensRedeemed(msg.sender, tokensToReceive, block.timestamp);
    }
    
    // 获取代币剩余量百分比
    function getTokenRemainingPercentage() external view returns (uint256) {
        if (TOTAL_TOKEN_SUPPLY == 0) return 0;
        uint256 remaining = magicToken.remainingSupply();
        return (remaining * 10000) / TOTAL_TOKEN_SUPPLY;
    }
    
    // 获取用户神树信息
    function getTreeInfo(address user) external view returns (
        bool exists,
        uint256 fertilizeCount,
        uint256 lastActionTime,
        uint256 fruits,
        uint256 encryptedPoints,  // Mock: 返回明文
        uint256 cooldownRemaining,
        uint256 dailyFertilizeCount,
        uint256 dailyFertilizeRemaining
    ) {
        Tree memory tree = trees[user];
        uint256 cooldown = 0;
        
        if (tree.exists && tree.lastActionTime > 0 && block.timestamp < tree.lastActionTime + COOLDOWN_TIME) {
            cooldown = (tree.lastActionTime + COOLDOWN_TIME) - block.timestamp;
        }
        
        uint256 currentDay = block.timestamp / 1 days;
        uint256 dailyCount = tree.lastFertilizeDate == currentDay ? tree.dailyFertilizeCount : 0;
        uint256 dailyRemaining = MAX_DAILY_FERTILIZE > dailyCount ? MAX_DAILY_FERTILIZE - dailyCount : 0;
        
        return (
            tree.exists,
            tree.fertilizeCount,
            tree.lastActionTime,
            tree.fruits,
            tree.points,
            cooldown,
            dailyCount,
            dailyRemaining
        );
    }
    
    // 提取合约余额
    function withdraw() external {
        require(msg.sender == owner, "Only owner can withdraw");
        (bool success, ) = payable(owner).call{value: address(this).balance}("");
        require(success, "Transfer failed");
    }
    
    // 获取合约余额
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    // Mock版本的排行榜
    function getLeaderboard(uint256 limit) external view returns (
        address[] memory addresses,
        uint256[] memory points,
        uint256[] memory fertilizeCounts
    ) {
        uint256 playerCount = allPlayers.length;
        uint256 resultCount = playerCount < limit ? playerCount : limit;
        
        addresses = new address[](resultCount);
        points = new uint256[](resultCount);
        fertilizeCounts = new uint256[](resultCount);
        
        // 简单排序（冒泡排序）
        address[] memory sortedPlayers = new address[](playerCount);
        for (uint256 i = 0; i < playerCount; i++) {
            sortedPlayers[i] = allPlayers[i];
        }
        
        for (uint256 i = 0; i < playerCount; i++) {
            for (uint256 j = i + 1; j < playerCount; j++) {
                if (trees[sortedPlayers[i]].points < trees[sortedPlayers[j]].points) {
                    address temp = sortedPlayers[i];
                    sortedPlayers[i] = sortedPlayers[j];
                    sortedPlayers[j] = temp;
                }
            }
        }
        
        for (uint256 i = 0; i < resultCount; i++) {
            addresses[i] = sortedPlayers[i];
            points[i] = trees[sortedPlayers[i]].points;
            fertilizeCounts[i] = trees[sortedPlayers[i]].fertilizeCount;
        }
        
        return (addresses, points, fertilizeCounts);
    }
    
    // 获取总玩家数
    function getTotalPlayers() external view returns (uint256) {
        return allPlayers.length;
    }
}