// app/page.tsx
'use client';

import { useState } from 'react';
import { useWeb3 } from '@/contexts/Web3Context';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import WalletSection from '@/components/WalletSection';
import MintSection from '@/components/MintSection';
import TreeSection from '@/components/TreeSection';
import TokenExchangeSection from '@/components/TokenExchangeSection';
import FHEVMInitializer from '@/components/FHEVMInitializer';

export default function Home() {
  const { isConnected, treeInfo } = useWeb3();
  const { t } = useLanguage();
  const [fhevmReady, setFhevmReady] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-purple-900 text-white p-5">
      <LanguageSwitcher />
      
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-10 pt-16">
          <h1 className="text-5xl font-bold mb-3 drop-shadow-lg">
            {t('title')}
          </h1>
          <p className="text-xl opacity-90">
            {t('subtitle')}
          </p>
        </header>

        <WalletSection />

        {isConnected && (
          <>
            {/* 步骤1: 优先执行 FHEVM 初始化 */}
            <FHEVMInitializer onReady={setFhevmReady} />
            
            {/* 步骤2: 等待 FHEVM ready 后才渲染其他组件 */}
            {fhevmReady ? (
              <>
                {!treeInfo?.exists && <MintSection />}
                {treeInfo?.exists && <TreeSection />}
                {treeInfo?.exists && <TokenExchangeSection />}
              </>
            ) : (
              // FHEVM 未就绪时的占位符（可选）
              <div className="bg-white/10 backdrop-blur-md rounded-3xl p-10 text-center opacity-50">
                <div className="text-lg">等待 FHE 系统初始化...</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}