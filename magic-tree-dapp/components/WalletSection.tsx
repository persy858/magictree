'use client';

import { useState } from 'react';
import { useWeb3 } from '@/contexts/Web3Context';
import { useLanguage } from '@/contexts/LanguageContext';

export default function WalletSection() {
  const { isConnected, account, chainId, connectWallet } = useWeb3();
  const { t } = useLanguage();
  const [error, setError] = useState<string>('');

  const handleConnect = async () => {
    try {
      setError('');
      await connectWallet();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 mb-8 text-center">
      {!isConnected ? (
        <div>
          <button
            onClick={handleConnect}
            className="bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white font-bold py-4 px-10 rounded-full text-lg transition-all hover:scale-105 hover:shadow-xl"
          >
            {t('connectWallet')}
          </button>
          {error && (
            <div className="mt-4 p-4 bg-red-500/30 border-2 border-red-500/50 rounded-lg">
              ❌ {error}
            </div>
          )}
        </div>
      ) : (
        <div>
          <p className="text-lg mb-2">{t('walletConnected')}</p>
          <p className="font-mono text-sm opacity-80">
            {account?.slice(0, 6)}...{account?.slice(-4)}
          </p>
          <div className="mt-4 text-sm opacity-70 bg-black/20 rounded-lg p-3">
            <p>{t('network')} {chainId === 11155111 ? 'Sepolia' : chainId}</p>
            <p>{t('address')} {account}</p>
          </div>
        </div>
      )}
    </div>
  );
}