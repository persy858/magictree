// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, externalEuint32, euint32 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

interface IMagicToken {
    function mint(address to, uint256 amount) external;
    function remainingSupply() external view returns (uint256);
    function MAX_SUPPLY() external view returns (uint256);
}

/**
 * @title MagicTreeFHE
 * @notice 使用 FHEVM 官方异步解密实现安全的代币兑换
 * @dev 参考官方 BeliefMarketFHE 实现
 */
contract MagicTreeFHEOracle is SepoliaConfig {
    
    // ==================== 数据结构 ====================
    
    struct Tree {
        bool exists;
        uint256 fertilizeCount;
        uint256 lastActionTime;
        uint256 fruits;
        euint32 points;
        uint256 dailyFertilizeCount;
        uint256 lastFertilizeDate;
    }
    
    mapping(address => Tree) public trees;
    address[] public allPlayers;
    mapping(address => bool) private isPlayer;
    IMagicToken public immutable magicToken;
    uint256 public constant TOTAL_TOKEN_SUPPLY = 100_000_000 * 10**18;
    
    struct PendingRedeem {
        address user;
        euint32 pointsToSpend;
        uint256 claimedAmount;
        uint256 requestTime;
        bool isResolved;
        uint256 decryptionRequestId;
        uint32 revealedSpend;
        uint32 revealedTotal;
    }
    
    mapping(uint256 => PendingRedeem) public pendingRedeems;
    mapping(address => uint256) public userLatestRequest;
    mapping(uint256 => uint256) internal requestIdToRedeemId;
    
    // 事件
    event TreeMinted(address indexed owner, uint256 timestamp);
    event TreeFertilized(address indexed owner, uint256 count, uint256 timestamp);
    event FruitHarvested(address indexed owner, uint256 fruitCount, uint256 timestamp);
    event FruitDecomposed(address indexed owner, uint256 timestamp);
    event RedeemRequested(address indexed user, uint256 redeemId, uint256 claimedAmount, uint256 timestamp);
    event DecryptionRequested(uint256 redeemId, uint256 decryptionRequestId);
    event RedeemProcessed(address indexed user, uint256 redeemId, uint32 actualAmount, uint256 tokensReceived);
    event RedeemFailed(address indexed user, uint256 redeemId, string reason);
    
    // 常量
    uint256 public constant MINT_PRICE = 0.01 ether;
    uint256 public constant COOLDOWN_TIME = 10 seconds;
    uint256 public constant FERTILIZE_FOR_FRUIT = 5;
    uint256 public constant MAX_DAILY_FERTILIZE = 5;
    address public owner;
    
    uint256 private redeemCounter;
    
    constructor(address _tokenAddress) {
        owner = msg.sender;
        magicToken = IMagicToken(_tokenAddress);
        redeemCounter = 0;
    }
    
    // ==================== 基础功能 ====================
    
    function mintTree() external payable {
        require(!trees[msg.sender].exists, "Tree already exists");
        require(msg.value == MINT_PRICE, "Incorrect ETH amount");
        
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
        
        FHE.allowThis(trees[msg.sender].points);
        FHE.allow(trees[msg.sender].points, msg.sender);
        
        if (!isPlayer[msg.sender]) {
            allPlayers.push(msg.sender);
            isPlayer[msg.sender] = true;
        }
        
        emit TreeMinted(msg.sender, block.timestamp);
    }
    
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
    
    function harvestFruit() external {
        Tree storage tree = trees[msg.sender];
        require(tree.exists, "Tree does not exist");
        require(tree.fruits > 0, "No fruits to harvest");
        
        tree.fruits--;
        
        euint32 randomValue = FHE.randEuint32();
        euint32 mask = FHE.asEuint32(2047);
        euint32 lowBits = FHE.and(randomValue, mask);
        euint32 minValue = FHE.asEuint32(1000);
        euint32 randomPoints = FHE.add(lowBits, minValue);
        
        tree.points = FHE.add(tree.points, randomPoints);
        
        FHE.allowThis(tree.points);
        FHE.allow(tree.points, msg.sender);
        
        emit FruitDecomposed(msg.sender, block.timestamp);
    }
    
    // ==================== 🔥 异步解密兑换 ====================
    
    /**
     * @notice 步骤1：请求兑换代币
     * @param encryptedAmount 加密的积分输入
     * @param claimedAmount 用户声称的明文数量
     * @param inputProof 加密证明
     */
    function requestRedeemTokens(
        externalEuint32 encryptedAmount,
        uint256 claimedAmount,
        bytes calldata inputProof
    ) external returns (uint256 redeemId) {
        Tree storage tree = trees[msg.sender];
        require(tree.exists, "Tree does not exist");
        require(claimedAmount > 0, "Amount must be greater than 0");
        
        // 🔥 修正：使用 FHE.fromExternal（官方用法）
        euint32 pointsToSpend = FHE.fromExternal(encryptedAmount, inputProof);
        
         // ✅ 添加这两行:授予合约访问权限
        FHE.allowThis(pointsToSpend);
        FHE.allow(pointsToSpend, msg.sender);

        redeemCounter++;
        redeemId = redeemCounter;
        
        pendingRedeems[redeemId] = PendingRedeem({
            user: msg.sender,
            pointsToSpend: pointsToSpend,
            claimedAmount: claimedAmount,
            requestTime: block.timestamp,
            isResolved: false,
            decryptionRequestId: 0,
            revealedSpend: 0,
            revealedTotal: 0
        });
        
        userLatestRequest[msg.sender] = redeemId;
        
        emit RedeemRequested(msg.sender, redeemId, claimedAmount, block.timestamp);
        
        return redeemId;
    }
    
    /**
     * @notice 步骤2：请求解密
     */
    function requestDecryption(uint256 redeemId) external {
        PendingRedeem storage redeem = pendingRedeems[redeemId];
        require(redeem.user != address(0), "Redeem does not exist");
        require(!redeem.isResolved, "Already resolved");
        require(msg.sender == redeem.user, "Only requester can decrypt");
        require(redeem.decryptionRequestId == 0, "Decryption already requested");
        
        Tree storage tree = trees[redeem.user];
        
        bytes32[] memory cts = new bytes32[](2);
        cts[0] = FHE.toBytes32(redeem.pointsToSpend);
        cts[1] = FHE.toBytes32(tree.points);
        
        uint256 decryptionRequestId = FHE.requestDecryption(
            cts, 
            this.callbackRedeemTokens.selector
        );
        
        redeem.decryptionRequestId = decryptionRequestId;
        requestIdToRedeemId[decryptionRequestId] = redeemId;
        
        emit DecryptionRequested(redeemId, decryptionRequestId);
    }
    
    /**
     * @notice 步骤3：解密回调
     */
    function callbackRedeemTokens(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory decryptionProof
    ) external {
        FHE.checkSignatures(requestId, cleartexts, decryptionProof);
        
        (uint32 revealedSpend, uint32 revealedTotal) = abi.decode(cleartexts, (uint32, uint32));
        
        uint256 redeemId = requestIdToRedeemId[requestId];
        PendingRedeem storage redeem = pendingRedeems[redeemId];
        
        require(redeem.user != address(0), "Invalid redeem");
        require(!redeem.isResolved, "Already resolved");
        
        redeem.revealedSpend = revealedSpend;
        redeem.revealedTotal = revealedTotal;
        redeem.isResolved = true;
        
        bool isValid = true;
        string memory failureReason = "";
        
        if (uint256(revealedSpend) != redeem.claimedAmount) {
            isValid = false;
            failureReason = "Claimed amount mismatch";
        }
        
        if (isValid && revealedSpend > revealedTotal) {
            isValid = false;
            failureReason = "Insufficient points";
        }
        
        if (isValid && revealedSpend == 0) {
            isValid = false;
            failureReason = "Amount is zero";
        }
        
        if (!isValid) {
            emit RedeemFailed(redeem.user, redeemId, failureReason);
            return;
        }
        
        Tree storage tree = trees[redeem.user];
        
        tree.points = FHE.sub(tree.points, redeem.pointsToSpend);
        FHE.allowThis(tree.points);
        FHE.allow(tree.points, redeem.user);
        
        uint256 rate = getCurrentExchangeRate();
        uint256 tokensToReceive = (uint256(revealedSpend) * 10**18) / rate;
        
        uint256 remaining = magicToken.remainingSupply();
        if (tokensToReceive > remaining) {
            emit RedeemFailed(redeem.user, redeemId, "Not enough tokens left");
            return;
        }
        
        magicToken.mint(redeem.user, tokensToReceive);
        
        emit RedeemProcessed(redeem.user, redeemId, revealedSpend, tokensToReceive);
    }
    
    // ==================== 查询函数 ====================
    
    function getCurrentExchangeRate() public view returns (uint256) {
        uint256 totalPlayers = allPlayers.length;
        uint256 tier = totalPlayers / 500;
        return 1 + (tier * 2);
    }
    
    function getRedeemStatus(uint256 redeemId) external view returns (
        address user,
        uint256 claimedAmount,
        bool isResolved,
        uint32 revealedSpend,
        uint32 revealedTotal,
        uint256 decryptionRequestId
    ) {
        PendingRedeem memory redeem = pendingRedeems[redeemId];
        return (
            redeem.user,
            redeem.claimedAmount,
            redeem.isResolved,
            redeem.revealedSpend,
            redeem.revealedTotal,
            redeem.decryptionRequestId
        );
    }
    
    function isDecryptionRequested(uint256 redeemId) external view returns (bool) {
        return pendingRedeems[redeemId].decryptionRequestId != 0;
    }
    
    function getUserLatestRequest(address user) external view returns (uint256) {
        return userLatestRequest[user];
    }
    
    function getEncryptedPoints() external view returns (euint32) {
        require(trees[msg.sender].exists, "Tree does not exist");
        return trees[msg.sender].points;
    }
    
    function getTreeInfo(address user) external view returns (
        bool exists,
        uint256 fertilizeCount,
        uint256 lastActionTime,
        uint256 fruits,
        euint32 encryptedPoints,
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
        
        return (tree.exists, tree.fertilizeCount, tree.lastActionTime, tree.fruits, tree.points, cooldown, dailyCount, dailyRemaining);
    }
    
    function getTokenRemainingPercentage() external view returns (uint256) {
        if (TOTAL_TOKEN_SUPPLY == 0) return 0;
        uint256 remaining = magicToken.remainingSupply();
        return (remaining * 10000) / TOTAL_TOKEN_SUPPLY;
    }
    
    function getTotalPlayers() external view returns (uint256) {
        return allPlayers.length;
    }
    
    function withdraw() external {
        require(msg.sender == owner, "Only owner can withdraw");
        (bool success, ) = payable(owner).call{value: address(this).balance}("");
        require(success, "Transfer failed");
    }
    
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    function getLeaderboard(uint256) external pure returns (address[] memory, uint256[] memory, uint256[] memory) {
        revert("Leaderboard not available in FHE version");
    }
}