export const translations = {
    zh: {
      title: "🌳 神树DApp",
      subtitle: "培育你的神奇树木，收获丰硕果实",
      connectWallet: "连接钱包",
      walletConnected: "✅ 钱包已连接",
      plantTree: "🌱 种植你的神树",
      mintCost: "铸造一颗神树需要 0.01 ETH",
      mintButton: "种植神树 (0.01 ETH)",
      fertilizeCount: "施肥次数",
      fruitCount: "果实数量",
      totalPoints: "总积分",
      cooldownPrefix: "⏱️ 冷却中:",
      cooldownSuffix: "秒",
      fertilizeButton: "🌿 施肥 (需要Gas)",
      harvestButton: "🍎 采摘果实",
      
      installMetaMask: "请安装MetaMask钱包!",
      switchToSepolia: "请切换到 Sepolia 测试网！当前网络:",
      setContractAddress: "请先设置合约地址！",
      invalidAddress: "合约地址格式错误！",
      connectFailed: "连接钱包失败:",
      getTreeInfoFailed: "获取神树信息失败:",
      
      minting: "正在铸造神树...",
      txSubmitted: "交易已提交，等待确认...",
      mintSuccess: "🎉 神树铸造成功!",
      mintFailed: "❌ 铸造失败:",
      fertilizing: "正在施肥...",
      fertilizeSuccess: "✅ 施肥成功！",
      fertilizeWithFruit: "🎉 施肥成功！神树结出了果实！",
      fertilizeFailed: "❌ 施肥失败:",
      harvesting: "正在采摘果实...",
      harvestSuccess: "🎉 采摘成功！获得",
      harvestSuccessSuffix: "积分！",
      harvestFailed: "❌ 采摘失败:",
      
      network: "网络:",
      address: "地址:",
      contractAddr: "合约地址:",
      
      // 排行榜
      leaderboard: "🏆 积分排行榜",
      rank: "排名",
      player: "玩家",
      totalPoints: "总积分",
      fertilizations: "施肥次数",
      noPlayers: "暂无玩家",
      you: "你",
      loading: "加载中...",
      refresh: "刷新",
        dailyLimit: "每日限额",
        dailyLimitSuffix: "次"
    },
    en: {
      title: "🌳 Magic Tree DApp",
      subtitle: "Grow your magical tree and harvest bountiful fruits",
      connectWallet: "Connect Wallet",
      walletConnected: "✅ Wallet Connected",
      plantTree: "🌱 Plant Your Magic Tree",
      mintCost: "Minting a magic tree costs 0.01 ETH",
      mintButton: "Plant Tree (0.01 ETH)",
      fertilizeCount: "Fertilize Count",
      fruitCount: "Fruit Count",
      totalPoints: "Total Points",
      cooldownPrefix: "⏱️ Cooldown:",
      cooldownSuffix: "s",
      fertilizeButton: "🌿 Fertilize (Gas Required)",
      harvestButton: "🍎 Harvest Fruit",
      
      installMetaMask: "Please install MetaMask wallet!",
      switchToSepolia: "Please switch to Sepolia testnet! Current network:",
      setContractAddress: "Please set contract address!",
      invalidAddress: "Invalid contract address format!",
      connectFailed: "Failed to connect wallet:",
      getTreeInfoFailed: "Failed to get tree info:",
      
      minting: "Minting magic tree...",
      txSubmitted: "Transaction submitted, waiting for confirmation...",
      mintSuccess: "🎉 Magic tree minted successfully!",
      mintFailed: "❌ Minting failed:",
      fertilizing: "Fertilizing...",
      fertilizeSuccess: "✅ Fertilized successfully!",
      fertilizeWithFruit: "🎉 Fertilized successfully! The tree bore fruit!",
      fertilizeFailed: "❌ Fertilization failed:",
      harvesting: "Harvesting fruit...",
      harvestSuccess: "🎉 Harvest successful! Gained",
      harvestSuccessSuffix: "points!",
      harvestFailed: "❌ Harvest failed:",
      
      network: "Network:",
      address: "Address:",
      contractAddr: "Contract:",
      
      // Leaderboard
      leaderboard: "🏆 Points Leaderboard",
      rank: "Rank",
      player: "Player",
      totalPoints: "Total Points",
      fertilizations: "Fertilizations",
      noPlayers: "No players yet",
      you: "You",
      loading: "Loading...",
        refresh: "Refresh",
        dailyLimit: "DailyLimit",
        dailyLimitSuffix: "times"
        

    }
  };
  
  export type Language = keyof typeof translations;
  export type TranslationKey = keyof typeof translations.zh;