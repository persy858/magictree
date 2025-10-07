'use client';

import { useState } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '@/contexts/Web3Context';
import { useLanguage } from '@/contexts/LanguageContext';

export default function MintSection() {
  const { contract, refreshTreeInfo } = useWeb3();
  const { t } = useLanguage();
  const [message, setMessage] = useState<{ text: string; type: string }>({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  const handleMint = async () => {
    if (!contract) return;
    
    try {
      setLoading(true);
      setMessage({ text: t('minting'), type: 'info' });
      
      const tx = await contract.mintTree({ value: ethers.parseEther('0.01') });
      setMessage({ text: t('txSubmitted'), type: 'info' });
      
      await tx.wait();
      setMessage({ text: t('mintSuccess'), type: 'success' });

      refreshTreeInfo();
    } catch (error: any) {
      console.error('Mint error:', error);
      setMessage({ text: `${t('mintFailed')} ${error.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/15 backdrop-blur-md rounded-3xl p-10 text-center">
      <h2 className="text-3xl font-bold mb-4">{t('plantTree')}</h2>
      <p className="text-lg mb-6 opacity-90">{t('mintCost')}</p>
      
      <button
        onClick={handleMint}
        disabled={loading}
        className="bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-10 rounded-full text-lg transition-all hover:scale-105 hover:shadow-xl"
      >
        {loading ? '⏳' : t('mintButton')}
      </button>

      {message.text && (
        <div
          className={`mt-6 p-4 rounded-lg ${
            message.type === 'error'
              ? 'bg-red-500/30 border-2 border-red-500/50'
              : message.type === 'success'
              ? 'bg-green-500/30 border-2 border-green-500/50'
              : 'bg-blue-500/30 border-2 border-blue-500/50'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}