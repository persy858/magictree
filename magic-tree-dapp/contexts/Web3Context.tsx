'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { BrowserProvider, Contract, ethers } from 'ethers';
import { 
  MAGIC_TREE_ADDRESS, 
  MAGIC_TREE_ABI, 
  SEPOLIA_CHAIN_ID 
} from '@/config/contract';

declare global {
  interface Window {
    ethereum?: any;
  }
}

// 🔥 修改：TreeInfo接口 - points改为encryptedPoints
interface TreeInfo {
  exists: boolean;
  fertilizeCount: bigint;
  lastActionTime: bigint;
  fruits: bigint;
  encryptedPoints: string;  // 🔥 改为加密handle（euint32转为字符串）
  cooldownRemaining: bigint;
  dailyFertilizeCount: bigint;
  dailyFertilizeRemaining: bigint;
}

// 🔥 新增：扩展Web3ContextType，添加原始provider用于FHEVM
interface Web3ContextType {
  provider: BrowserProvider | null;
  signer: any;
  contract: Contract | null;
  account: string | null;
  chainId: number | null;
  treeInfo: TreeInfo | null;
  isConnected: boolean;
  connectWallet: () => Promise<void>;
  refreshTreeInfo: () => Promise<void>;
  rawProvider: any; // 🔥 新增：原始的window.ethereum用于FHEVM
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);


export function Web3Provider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<any>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [treeInfo, setTreeInfo] = useState<TreeInfo | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [rawProvider, setRawProvider] = useState<any>(null); // 🔥 新增

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        throw new Error('Please install MetaMask!');
      }

      // 🔥 保存原始provider给FHEVM使用
      setRawProvider(window.ethereum);

      const browserProvider = new BrowserProvider(window.ethereum);
      await browserProvider.send('eth_requestAccounts', []);
      
      const network = await browserProvider.getNetwork();
      const userSigner = await browserProvider.getSigner();
      const userAccount = await userSigner.getAddress();

      setProvider(browserProvider);
      setSigner(userSigner);
      setAccount(userAccount);
      setChainId(Number(network.chainId));

      if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaa36a7' }], // Sepolia
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            alert('Please add Sepolia network to MetaMask');
          }
        }
        return;
      }

      if (!ethers.isAddress(MAGIC_TREE_ADDRESS)) {
        throw new Error('Invalid contract address');
      }

      const magicTreeContract = new Contract(
        MAGIC_TREE_ADDRESS, 
        MAGIC_TREE_ABI, 
        userSigner
      );
      setContract(magicTreeContract);
      setIsConnected(true);

      // 加载神树信息
      await loadTreeInfo(magicTreeContract, userAccount);
    } catch (error: any) {
      console.error('Connection error:', error);
      throw error;
    }
  };

  // 🔥 修改：loadTreeInfo函数 - 处理加密的points
  const loadTreeInfo = async (contractInstance: Contract, userAddress: string) => {
    try {
      const info = await contractInstance.getTreeInfo(userAddress);
      
      // 🔥 注意：如果合约返回的是euint32，它会被转换为字符串handle
      setTreeInfo({
        exists: info[0],
        fertilizeCount: info[1],
        lastActionTime: info[2],
        fruits: info[3],
        encryptedPoints: `0x${BigInt(info[4]).toString(16).padStart(64, '0')}`, // 🔥 这里是加密handle
        cooldownRemaining: info[5],
        dailyFertilizeCount: info[6],
        dailyFertilizeRemaining: info[7],
      });

      console.log('✅ Tree info loaded, encrypted points handle:', info[4]);

    } catch (error) {
      console.error('Failed to load tree info:', error);
    }
  };

  const refreshTreeInfo = async () => {
    if (contract && account) {
      await loadTreeInfo(contract, account);
    }
  };

  // 🔥 修改：事件监听 - FHE版本不再从事件中获取明文积分
  useEffect(() => {
    if (contract && account) {
      const handleEvent = () => {
        setTimeout(() => refreshTreeInfo(), 2000);
      };

      // 原有事件
      contract.on('TreeMinted', handleEvent);
      contract.on('TreeFertilized', handleEvent);
      
      // 🔥 注意：FruitDecomposed事件可能不再包含points参数（因为是加密的）
      contract.on('FruitDecomposed', (owner, timestamp) => {
        console.log('🎁 Fruit decomposed (FHE):', { owner, timestamp });
        handleEvent();
      });
      
      // 代币兑换事件（重要：兑换后需要刷新积分）
      contract.on('TokensRedeemed', (user, tokensReceived, timestamp) => {
        console.log('💰 Tokens redeemed:', { user, tokensReceived, timestamp });
        handleEvent();
      });

      return () => {
        contract.off('TreeMinted', handleEvent);
        contract.off('TreeFertilized', handleEvent);
        contract.off('FruitDecomposed', handleEvent);
        contract.off('TokensRedeemed', handleEvent);
      };
    }
  }, [contract, account]);

  // 监听账户和网络变化
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = () => {
        console.log('🔄 Accounts changed, reloading...');
        window.location.reload();
      };

      const handleChainChanged = () => {
        console.log('🔄 Chain changed, reloading...');
        window.location.reload();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  return (
    <Web3Context.Provider
      value={{
        provider,
        signer,
        contract,
        account,
        chainId,
        treeInfo,
        isConnected,
        connectWallet,
        refreshTreeInfo,
        rawProvider, // 🔥 新增：暴露原始provider
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within Web3Provider');
  }
  return context;
}