// hooks/useFHEVM.tsx
'use client';

import { useState, useEffect } from 'react';
import { useFhevm } from '../fhevm-react/useFhevm';
import { useWeb3 } from '@/contexts/Web3Context';

/**
 * FHEVM Hook - 管理FHE实例的初始化和状态
 * 适配你现有的Web3Context
 */
export function useFHEVM() {
  const { rawProvider, chainId } = useWeb3();
  const [isReady, setIsReady] = useState(false);
    

  // 🔥 初始化FHEVM实例
  const {
    instance: fhevmInstance,
    status: fhevmStatus,
    error: fhevmError,
  } = useFhevm({
    provider: rawProvider, // 使用原始的window.ethereum
    chainId: chainId ?? undefined, // ✅ 将 null 转换为 undefined
    enabled: !!rawProvider && !!chainId, // 只有当provider和chainId都存在时才启用
    initialMockChains: { // 关键是这个
    31337: "http://localhost:8545",
    }
  });

  // 监听FHEVM实例状态
  useEffect(() => {
    if (fhevmStatus === 'ready' && fhevmInstance) {
        setIsReady(true);
      console.log('✅ FHEVM instance ready');
    } else if (fhevmStatus === 'error') {
      setIsReady(false);
      console.error('❌ FHEVM initialization error:', fhevmError);
    } else if (fhevmStatus === 'loading') {
      setIsReady(false);
      console.log('⏳ FHEVM instance loading...');
    }
  }, [fhevmStatus, fhevmInstance, fhevmError]);


  return {
    fhevmInstance,
    isReady,
    status: fhevmStatus,
    error: fhevmError,
  };
}