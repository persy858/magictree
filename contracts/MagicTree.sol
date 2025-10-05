// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IMagicToken {
    function mint(address to, uint256 amount) external;
    function remainingSupply() external view returns (uint256);
    function MAX_SUPPLY() external view returns (uint256);
}

contract MagicTree {
    // 神树结构
    struct Tree {
        bool exists;
        uint256 fertilizeCount;
        uint256 lastActionTime;
        uint256 fruits;
        uint256 points;
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
    
    // 事件
    event TreeMinted(address indexed owner, uint256 timestamp);
    event TreeFertilized(address indexed owner, uint256 count, uint256 timestamp);
    event FruitHarvested(address indexed owner, uint256 fruitCount, uint256 timestamp);
    event FruitDecomposed(address indexed owner, uint256 points, uint256 timestamp);
    event TokensRedeemed(address indexed user, uint256 pointsSpent, uint256 tokensReceived, uint256 timestamp);
    
    // Mint价格
    uint256 public constant MINT_PRICE = 0.01 ether;
    
    // 冷却时间（1分钟）
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
            points: 0,
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
    
    // 采摘果实（分解获得积分）
    function harvestFruit() external {
        Tree storage tree = trees[msg.sender];
        require(tree.exists, "Tree does not exist");
        require(tree.fruits > 0, "No fruits to harvest");
        
        tree.fruits--;
        
        // 生成100-500的随机积分
        uint256 randomPoints = _random(100, 500);
        tree.points += randomPoints;
        
        emit FruitDecomposed(msg.sender, randomPoints, block.timestamp);
    }
    
    // 计算当前兑换比例（多少积分换1个代币）
    // 动态调整：每500人比例+2
    function getCurrentExchangeRate() public view returns (uint256) {
        uint256 totalPlayers = allPlayers.length;
        uint256 tier = totalPlayers / 500;
        // 0-499人: tier=0, rate=1 (1积分=1代币)
        // 500-999人: tier=1, rate=3 (3积分=1代币)
        // 1000-1499人: tier=2, rate=5 (5积分=1代币)
        // 以此类推...
        return 1 + (tier * 2);
    }
    
    // 兑换代币（按需铸造，无需预先转移代币）
    function redeemTokens(uint256 pointsToSpend) external {
        Tree storage tree = trees[msg.sender];
        require(tree.exists, "Tree does not exist");
        require(tree.points >= pointsToSpend, "Insufficient points");
        require(pointsToSpend > 0, "Points must be greater than 0");
        
        // 计算当前兑换比例
        uint256 rate = getCurrentExchangeRate();
        
        // 计算可获得的代币数量（带18位小数）
        uint256 tokensToReceive = (pointsToSpend * 10**18) / rate;
        
        // 检查代币剩余量（从代币合约查询）
        uint256 remainingTokens = magicToken.remainingSupply();
        require(tokensToReceive <= remainingTokens, "Not enough tokens left");
        
        // 扣除积分
        tree.points -= pointsToSpend;
        
        // 直接铸造代币给用户（合约不持有代币，零资金风险）
        magicToken.mint(msg.sender, tokensToReceive);
        
        emit TokensRedeemed(msg.sender, pointsToSpend, tokensToReceive, block.timestamp);
    }
    
    // 获取代币剩余量百分比（0-10000，代表0%-100%，精度0.01%）
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
        uint256 points,
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
            tree.points,
            cooldown,
            dailyCount,
            dailyRemaining
        );
    }
    
    // 简单的随机数生成
    function _random(uint256 min, uint256 max) private view returns (uint256) {
        uint256 randomHash = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender
        )));
        return min + (randomHash % (max - min + 1));
    }
    
    // 提取合约余额（仅合约所有者）
    function withdraw() external {
        require(msg.sender == owner, "Only owner can withdraw");
        payable(owner).transfer(address(this).balance);
    }
    
    // 获取合约余额
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    // 获取排行榜（前N名）
    function getLeaderboard(uint256 limit) external view returns (
        address[] memory addresses,
        uint256[] memory points,
        uint256[] memory fertilizeCounts
    ) {
        uint256 playerCount = allPlayers.length;
        if (playerCount == 0) {
            return (new address[](0), new uint256[](0), new uint256[](0));
        }
        
        uint256 returnCount = limit > playerCount ? playerCount : limit;
        
        address[] memory tempAddresses = new address[](playerCount);
        uint256[] memory tempPoints = new uint256[](playerCount);
        
        for (uint256 i = 0; i < playerCount; i++) {
            tempAddresses[i] = allPlayers[i];
            tempPoints[i] = trees[allPlayers[i]].points;
        }
        
        // 冒泡排序
        for (uint256 i = 0; i < playerCount - 1; i++) {
            for (uint256 j = 0; j < playerCount - i - 1; j++) {
                if (tempPoints[j] < tempPoints[j + 1]) {
                    uint256 tempPoint = tempPoints[j];
                    tempPoints[j] = tempPoints[j + 1];
                    tempPoints[j + 1] = tempPoint;
                    
                    address tempAddr = tempAddresses[j];
                    tempAddresses[j] = tempAddresses[j + 1];
                    tempAddresses[j + 1] = tempAddr;
                }
            }
        }
        
        addresses = new address[](returnCount);
        points = new uint256[](returnCount);
        fertilizeCounts = new uint256[](returnCount);
        
        for (uint256 i = 0; i < returnCount; i++) {
            addresses[i] = tempAddresses[i];
            points[i] = tempPoints[i];
            fertilizeCounts[i] = trees[tempAddresses[i]].fertilizeCount;
        }
        
        return (addresses, points, fertilizeCounts);
    }
    
    // 获取总玩家数
    function getTotalPlayers() external view returns (uint256) {
        return allPlayers.length;
    }
}