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

interface TreeInfo {
  exists: boolean;
  fertilizeCount: bigint;
  lastActionTime: bigint;
  fruits: bigint;
  points: bigint;
  cooldownRemaining: bigint;
  dailyFertilizeCount: bigint;
  dailyFertilizeRemaining: bigint;
}

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

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        throw new Error('Please install MetaMask!');
      }

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

  const loadTreeInfo = async (contractInstance: Contract, userAddress: string) => {
    try {
      const info = await contractInstance.getTreeInfo(userAddress);
      setTreeInfo({
        exists: info[0],
        fertilizeCount: info[1],
        lastActionTime: info[2],
        fruits: info[3],
        points: info[4],
        cooldownRemaining: info[5],
        dailyFertilizeCount: info[6],
        dailyFertilizeRemaining: info[7],
      });
    } catch (error) {
      console.error('Failed to load tree info:', error);
    }
  };

  const refreshTreeInfo = async () => {
    if (contract && account) {
      await loadTreeInfo(contract, account);
    }
  };

  // 监听事件，自动刷新
  useEffect(() => {
    if (contract && account) {
      const handleEvent = () => {
        setTimeout(() => refreshTreeInfo(), 2000);
      };

      // 原有事件
      contract.on('TreeMinted', handleEvent);
      contract.on('TreeFertilized', handleEvent);
      contract.on('FruitDecomposed', handleEvent);
      
      // 新增：代币兑换事件（重要！兑换后需要刷新积分）
      contract.on('TokensRedeemed', handleEvent);

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
      window.ethereum.on('accountsChanged', () => {
        window.location.reload();
      });
      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners('accountsChanged');
        window.ethereum.removeAllListeners('chainChanged');
      }
    };
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