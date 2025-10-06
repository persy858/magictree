'use client';

import { useState, useEffect } from 'react';
import { useWeb3 } from '@/contexts/Web3Context';
import { useLanguage } from '@/contexts/LanguageContext';

export default function TokenExchangeSection() {
  const { contract, treeInfo, refreshTreeInfo } = useWeb3();
  const { t } = useLanguage();
  const [message, setMessage] = useState<{ text: string; type: string }>({ text: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [pointsToExchange, setPointsToExchange] = useState('');
  
  // 代币相关状态
  const [exchangeRate, setExchangeRate] = useState(1);
  const [tokenRemaining, setTokenRemaining] = useState(100);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [tokensToReceive, setTokensToReceive] = useState('0');

  // 获取代币信息
  useEffect(() => {
    const fetchTokenInfo = async () => {
      if (!contract) return;
      
      try {
        const rate = await contract.getCurrentExchangeRate();
        setExchangeRate(Number(rate));
        
        const percentage = await contract.getTokenRemainingPercentage();
        setTokenRemaining(Number(percentage) / 100);
        
        const players = await contract.getTotalPlayers();
        setTotalPlayers(Number(players));
      } catch (error) {
        console.error('Error fetching token info:', error);
      }
    };
    
    fetchTokenInfo();
    const interval = setInterval(fetchTokenInfo, 10000);
    return () => clearInterval(interval);
  }, [contract]);

  // 计算可获得的代币数量
  useEffect(() => {
    if (pointsToExchange && !isNaN(Number(pointsToExchange))) {
      const points = Number(pointsToExchange);
      const tokens = points / exchangeRate;
      setTokensToReceive(tokens.toFixed(2));
    } else {
      setTokensToReceive('0');
    }
  }, [pointsToExchange, exchangeRate]);

  const handleExchange = async () => {
    if (!contract || !pointsToExchange) return;
    
    const points = Number(pointsToExchange);
    if (isNaN(points) || points <= 0) {
      setMessage({ text: t('invalidAmount'), type: 'error' });
      return;
    }
    
    if (treeInfo && points > Number(treeInfo.points)) {
      setMessage({ text: t('insufficientPoints'), type: 'error' });
      return;
    }
    
    try {
      setLoading(true);
      setMessage({ text: t('exchanging'), type: 'info' });
      
      const tx = await contract.redeemTokens(points);
      setMessage({ text: t('txSubmitted'), type: 'info' });
      
      await tx.wait();
      
      setMessage({ 
        text: `${t('exchangeSuccess')} ${points} ${t('forTokens')} ${tokensToReceive} ${t('tokens')}`, 
        type: 'success' 
      });
      
      setPointsToExchange('');
      
      setTimeout(() => {
        refreshTreeInfo();
      }, 2000);
    } catch (error: any) {
      console.error('Exchange error:', error);
      setMessage({ text: `${t('exchangeFailed')} ${error.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const getCurrentTier = () => {
    return Math.floor(totalPlayers / 500);
  };

  const getNextTierPlayers = () => {
    return (getCurrentTier() + 1) * 500;
  };

  if (!treeInfo) return null;

  return (
    <div className="bg-white/15 backdrop-blur-md rounded-3xl p-10 mt-8">
      <h2 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-yellow-300 to-pink-300 bg-clip-text text-transparent">
        {t('tokenExchange')}
      </h2>

      {/* 代币余量进度条 */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm opacity-80">{t('tokenSupplyRemaining')}</span>
          <span className="text-lg font-bold">{tokenRemaining.toFixed(2)}%</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-6 overflow-hidden backdrop-blur-sm">
          <div 
            className="h-full bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 transition-all duration-1000 ease-out flex items-center justify-center text-xs font-bold"
            style={{ width: `${tokenRemaining}%` }}
          >
            {tokenRemaining > 10 && `${tokenRemaining.toFixed(1)}%`}
          </div>
        </div>
        <div className="text-center mt-2 text-sm opacity-70">
          {tokenRemaining === 100 
            ? `100M MTT ${t('available')}` 
            : `${(tokenRemaining * 1000000).toFixed(0)}K MTT ${t('remaining')}`}
        </div>
      </div>

      {/* 兑换信息卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl">
          <div className="text-sm opacity-80 mb-2">{t('currentRate')}</div>
          <div className="text-3xl font-bold">
            {exchangeRate} <span className="text-lg opacity-70">{t('points')}</span>
          </div>
          <div className="text-xs opacity-60 mt-1">= 1 {t('mttToken')}</div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl">
          <div className="text-sm opacity-80 mb-2">{t('totalPlayers')}</div>
          <div className="text-3xl font-bold">{totalPlayers}</div>
          <div className="text-xs opacity-60 mt-1">
            {t('tier')} {getCurrentTier()} • {t('nextAt')} {getNextTierPlayers()}
          </div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl">
          <div className="text-sm opacity-80 mb-2">{t('yourPoints')}</div>
          <div className="text-3xl font-bold text-green-300">
            {treeInfo.points.toString()}
          </div>
          <div className="text-xs opacity-60 mt-1">{t('availableToExchange')}</div>
        </div>
      </div>

      {/* 兑换输入 */}
      <div className="bg-white/10 backdrop-blur-sm p-8 rounded-2xl mb-6">
        <label className="block text-sm opacity-80 mb-3">{t('pointsToExchange')}</label>
        <div className="flex gap-4 mb-4">
          <input
            type="number"
            value={pointsToExchange}
            onChange={(e) => setPointsToExchange(e.target.value)}
            placeholder={t('enterPointsAmount')}
            className="flex-1 bg-white/20 backdrop-blur-sm rounded-xl px-6 py-4 text-lg font-semibold outline-none focus:ring-2 focus:ring-pink-400 transition-all placeholder-white/40"
            min="0"
            max={treeInfo.points.toString()}
          />
          <button
            onClick={() => setPointsToExchange(treeInfo.points.toString())}
            className="bg-white/20 hover:bg-white/30 px-6 py-4 rounded-xl font-semibold transition-all hover:scale-105"
          >
            {t('max')}
          </button>
        </div>
        
        {pointsToExchange && (
          <div className="text-center p-4 bg-gradient-to-r from-yellow-500/20 to-pink-500/20 rounded-xl">
            <div className="text-sm opacity-80 mb-1">{t('youWillReceive')}</div>
            <div className="text-3xl font-bold bg-gradient-to-r from-yellow-300 to-pink-300 bg-clip-text text-transparent">
              {tokensToReceive} MTT
            </div>
          </div>
        )}
      </div>

      {/* 兑换按钮 */}
      <button
        onClick={handleExchange}
        disabled={loading || !pointsToExchange || Number(pointsToExchange) <= 0 || tokenRemaining <= 0}
        className="w-full bg-gradient-to-r from-yellow-500 to-pink-500 hover:from-yellow-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-5 px-8 rounded-full text-xl transition-all hover:scale-105 hover:shadow-2xl"
      >
        {loading ? t('exchanging') : tokenRemaining <= 0 ? t('allTokensMinted') : t('exchangeTokens')}
      </button>

      {/* 消息提示 */}
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

      {/* 说明文字 */}
      <div className="mt-8 p-6 bg-white/5 backdrop-blur-sm rounded-2xl text-sm opacity-70">
        <div className="mb-2">📊 <strong>{t('exchangeRateTiers')}</strong></div>
        <ul className="space-y-1 ml-6">
          <li>• {t('tierInfo1')}</li>
          <li>• {t('tierInfo2')}</li>
          <li>• {t('tierInfo3')}</li>
          <li>• {t('tierInfoIncrease')}</li>    
        </ul>
      </div>
    </div>
  );
}