'use client';

import { useState } from 'react';
import { useWeb3 } from '@/contexts/Web3Context';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import WalletSection from '@/components/WalletSection';
import MintSection from '@/components/MintSection';
import TreeSection from '@/components/TreeSection';
import Leaderboard from '@/components/Leaderboard';

export default function Home() {
  const { isConnected, treeInfo } = useWeb3();
  const { t } = useLanguage();

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
            {!treeInfo?.exists && <MintSection />}
            {treeInfo?.exists && <TreeSection />}
            
            <Leaderboard />
          </>
        )}
      </div>
    </div>
  );
}