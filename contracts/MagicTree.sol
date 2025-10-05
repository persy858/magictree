// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MagicTree {
    // 神树结构
    struct Tree {
        bool exists;
        uint256 fertilizeCount;
        uint256 lastActionTime;
        uint256 fruits;
        uint256 points;
    }
    
    // 用户地址 => 神树数据
    mapping(address => Tree) public trees;
    
    // 排行榜：所有用户地址列表
    address[] public allPlayers;
    mapping(address => bool) private isPlayer;
    
    // 事件
    event TreeMinted(address indexed owner, uint256 timestamp);
    event TreeFertilized(address indexed owner, uint256 count, uint256 timestamp);
    event FruitHarvested(address indexed owner, uint256 fruitCount, uint256 timestamp);
    event FruitDecomposed(address indexed owner, uint256 points, uint256 timestamp);
    
    // Mint价格
    uint256 public constant MINT_PRICE = 0.01 ether;
    
    // 冷却时间（1分钟）
    uint256 public constant COOLDOWN_TIME = 1 minutes;
    
    // 结果实所需施肥次数
    uint256 public constant FERTILIZE_FOR_FRUIT = 5;
    
    // 合约所有者
    address public owner;
    
    constructor() {
        owner = msg.sender;
    }
    
    // Mint神树
    function mintTree() external payable {
        require(!trees[msg.sender].exists, "Tree already exists");
        require(msg.value == MINT_PRICE, "Incorrect ETH amount");
        
        trees[msg.sender] = Tree({
            exists: true,
            fertilizeCount: 0,
            lastActionTime: 0, // 初始化为0，允许立即施肥
            fruits: 0,
            points: 0
        });
        
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
        
        tree.fertilizeCount++;
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
    
    // 获取用户神树信息
    function getTreeInfo(address user) external view returns (
        bool exists,
        uint256 fertilizeCount,
        uint256 lastActionTime,
        uint256 fruits,
        uint256 points,
        uint256 cooldownRemaining
    ) {
        Tree memory tree = trees[user];
        uint256 cooldown = 0;
        
        if (tree.exists && tree.lastActionTime > 0 && block.timestamp < tree.lastActionTime + COOLDOWN_TIME) {
            cooldown = (tree.lastActionTime + COOLDOWN_TIME) - block.timestamp;
        }
        
        return (
            tree.exists,
            tree.fertilizeCount,
            tree.lastActionTime,
            tree.fruits,
            tree.points,
            cooldown
        );
    }
    
    // 简单的随机数生成（注意：链上随机数不够安全，生产环境建议使用Chainlink VRF）
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
        
        // 限制返回数量
        uint256 returnCount = limit > playerCount ? playerCount : limit;
        
        // 创建临时数组用于排序
        address[] memory tempAddresses = new address[](playerCount);
        uint256[] memory tempPoints = new uint256[](playerCount);
        
        // 复制所有玩家数据
        for (uint256 i = 0; i < playerCount; i++) {
            tempAddresses[i] = allPlayers[i];
            tempPoints[i] = trees[allPlayers[i]].points;
        }
        
        // 简单冒泡排序（按积分降序）
        for (uint256 i = 0; i < playerCount - 1; i++) {
            for (uint256 j = 0; j < playerCount - i - 1; j++) {
                if (tempPoints[j] < tempPoints[j + 1]) {
                    // 交换积分
                    uint256 tempPoint = tempPoints[j];
                    tempPoints[j] = tempPoints[j + 1];
                    tempPoints[j + 1] = tempPoint;
                    
                    // 交换地址
                    address tempAddr = tempAddresses[j];
                    tempAddresses[j] = tempAddresses[j + 1];
                    tempAddresses[j + 1] = tempAddr;
                }
            }
        }
        
        // 准备返回数据
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