'use client';

import { useState, useEffect } from 'react';
import { useWeb3 } from '@/contexts/Web3Context';
import { useLanguage } from '@/contexts/LanguageContext';

export default function TreeSection() {
  const { contract, treeInfo, refreshTreeInfo } = useWeb3();
  const { t } = useLanguage();
  const [message, setMessage] = useState<{ text: string; type: string }>({ text: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (treeInfo && treeInfo.cooldownRemaining > 0n) {
      setCooldown(Number(treeInfo.cooldownRemaining));
    }
  }, [treeInfo]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  const handleFertilize = async () => {
    if (!contract) return;
    
    try {
      setLoading(true);
      setMessage({ text: t('fertilizing'), type: 'info' });
      
      const tx = await contract.fertilize();
      setMessage({ text: t('txSubmitted'), type: 'info' });
      
      const receipt = await tx.wait();
      
      // 检查是否产生果实
      const fruitEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed?.name === 'FruitHarvested';
        } catch {
          return false;
        }
      });
      
      if (fruitEvent) {
        setMessage({ text: t('fertilizeWithFruit'), type: 'success' });
      } else {
        setMessage({ text: t('fertilizeSuccess'), type: 'success' });
      }
      
      setTimeout(() => {
        refreshTreeInfo();
      }, 2000);
    } catch (error: any) {
      console.error('Fertilize error:', error);
      setMessage({ text: `${t('fertilizeFailed')} ${error.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleHarvest = async () => {
    if (!contract) return;
    
    try {
      setLoading(true);
      setMessage({ text: t('harvesting'), type: 'info' });
      
      const tx = await contract.harvestFruit();
      setMessage({ text: t('txSubmitted'), type: 'info' });
      
      const receipt = await tx.wait();
      
      // 解析获得的积分
      const decomposeEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed?.name === 'FruitDecomposed';
        } catch {
          return false;
        }
      });
      
      if (decomposeEvent) {
        const parsed = contract.interface.parseLog(decomposeEvent);
        const points = parsed?.args.points;
        setMessage({ 
          text: `${t('harvestSuccess')} ${points} ${t('harvestSuccessSuffix')}`, 
          type: 'success' 
        });
      }
      
      setTimeout(() => {
        refreshTreeInfo();
      }, 2000);
    } catch (error: any) {
      console.error('Harvest error:', error);
      setMessage({ text: `${t('harvestFailed')} ${error.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!treeInfo) return null;

  return (
    <div className="bg-white/15 backdrop-blur-md rounded-3xl p-10 text-center">
      <div className="text-8xl mb-6 animate-sway">🌳</div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl">
          <div className="text-sm opacity-80 mb-2">{t('fertilizeCount')}</div>
          <div className="text-4xl font-bold">{treeInfo.fertilizeCount.toString()}</div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl">
          <div className="text-sm opacity-80 mb-2">{t('fruitCount')}</div>
          <div className="text-4xl font-bold">
            <span className="animate-bounce-slow inline-block">🍎</span> {treeInfo.fruits.toString()}
          </div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl">
          <div className="text-sm opacity-80 mb-2">{t('totalPoints')}</div>
          <div className="text-4xl font-bold">{treeInfo.points.toString()}</div>
        </div>
      </div>

      {cooldown > 0 && (
        <div className="text-lg text-yellow-300 mb-4">
          {t('cooldownPrefix')} {cooldown}{t('cooldownSuffix')}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
        <button
          onClick={handleFertilize}
          disabled={loading || cooldown > 0}
          className="bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-full text-lg transition-all hover:scale-105 hover:shadow-xl"
        >
          {loading ? '⏳' : t('fertilizeButton')}
        </button>
        
        <button
          onClick={handleHarvest}
          disabled={loading || treeInfo.fruits === 0n}
          className="bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-full text-lg transition-all hover:scale-105 hover:shadow-xl"
        >
          {t('harvestButton')}
        </button>
      </div>

      {message.text && (
        <div
          className={`mt-6 p-4 rounded-lg animate-fadeIn ${
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