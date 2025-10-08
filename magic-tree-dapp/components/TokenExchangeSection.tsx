'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { useWeb3 } from '@/contexts/Web3Context';
import { useFHEVM } from '@/hooks/useFHEVM';
import { useEffect, useState } from 'react';
import { useInMemoryStorage } from '@/hooks/useInMemoryStorage';

export default function TokenExchangeSection() {
  const { contract, treeInfo, refreshTreeInfo, signer } = useWeb3();
  const { t } = useLanguage();
  const { fhevmInstance, isReady } = useFHEVM();
  
  const [message, setMessage] = useState<{ text: string; type: string }>({ text: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [pointsToExchange, setPointsToExchange] = useState('');
  
  // 代币相关状态
  const [exchangeRate, setExchangeRate] = useState(1);
  const [tokenRemaining, setTokenRemaining] = useState(100);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [tokensToReceive, setTokensToReceive] = useState('0');

  // FHE解密状态
  const [decryptedPoints, setDecryptedPoints] = useState<bigint | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const { storage } = useInMemoryStorage();

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

  // 当treeInfo变化时清空解密缓存
  useEffect(() => {
    if (treeInfo?.encryptedPoints) {
      setDecryptedPoints(null);
    }
  }, [treeInfo?.encryptedPoints]);

  // 解密积分函数
  const handleDecryptPoints = async () => {
    if (!fhevmInstance || !contract || !signer || !treeInfo?.encryptedPoints) {
      setMessage({ 
        text: t('fheNotReady'), 
        type: 'error' 
      });
      return;
    }

    try {
      setIsDecrypting(true);
      setMessage({ 
        text: t('decryptingPoints'), 
        type: 'info' 
      });

      const { FhevmDecryptionSignature } = await import('../fhevm-react');
      
      const contractAddress = await contract.getAddress();
      const sig = await FhevmDecryptionSignature.loadOrSign(
        fhevmInstance,
        [contractAddress as `0x${string}`],
        signer,
        storage
      );

      if (!sig) {
        throw new Error('Failed to create decryption signature');
      }

      const decryptedData = await fhevmInstance.userDecrypt(
        [{ handle: treeInfo.encryptedPoints, contractAddress }],
        sig.privateKey,
        sig.publicKey,
        sig.signature,
        sig.contractAddresses,
        sig.userAddress,
        sig.startTimestamp,
        sig.durationDays
      );

      const points = BigInt(decryptedData[treeInfo.encryptedPoints]);
      setDecryptedPoints(points);
      
      setMessage({ 
        text: `${t('decryptSuccess')}: ${points} ${t('points')}`, 
        type: 'success' 
      });
    } catch (error: any) {
      console.error('Decrypt error:', error);
      setMessage({ 
        text: `${t('decryptFailed')}: ${error.message}`, 
        type: 'error' 
      });
    } finally {
      setIsDecrypting(false);
    }
  };

  // 🔥 更新：FHE版本的代币兑换（3个参数）
  const handleExchange = async () => {
    // ✅ 第一件事：立即设置 loading
    setLoading(true);
    setMessage({ text: t('checkingExchange'), type: 'info' });
    
    // 使用 setTimeout 0 确保 UI 立即更新
    await new Promise(resolve => setTimeout(resolve, 0));

    if (!contract || !fhevmInstance || !signer || !pointsToExchange) {
      setMessage({ text: t('invalidAmount'), type: 'error' });
      return;
    }
    
    const points = Number(pointsToExchange);
    if (isNaN(points) || points <= 0) {
      setMessage({ text: t('invalidAmount'), type: 'error' });
      return;
    }
    
    // 验证：如果已解密，检查积分是否足够
    if (decryptedPoints !== null && BigInt(points) > decryptedPoints) {
      setMessage({ text: t('insufficientPoints'), type: 'error' });
      return;
    }
    try {

      
      const contractAddress = await contract.getAddress();
      const signerAddress = await signer.getAddress();

      // 🔥 步骤1: 创建加密输入
      setMessage({ text: t('creatingEncryptedInput'), type: 'info' });
      const input = fhevmInstance.createEncryptedInput(
        contractAddress,
        signerAddress
      );
      input.add32(points);

      // 🔥 步骤2: 执行加密
      setMessage({ text: t('encryptingData'), type: 'info' });
      const encrypted = await input.encrypt();

      console.log('🔒 Encrypted exchange input:', {
        points: points,
        handle: encrypted.handles[0],
        handleType: typeof encrypted.handles[0],
        proof: encrypted.inputProof.slice(0, 20) + '...'
      });
  

      // 🔥 步骤3: 调用合约（传入3个参数）
      // 参数1: encrypted.handles[0] - externalEuint32 (加密的积分)
      // 参数2: encrypted.inputProof - bytes (加密证明)
      // 参数3: points - uint256 (明文积分数量，用于计算代币)
      setMessage({ text: t('sendingTransaction'), type: 'info' });
      const tx = await contract.redeemTokens(
        encrypted.handles[0],      // externalEuint32 inputEuint32
        encrypted.inputProof,      // bytes calldata inputProof
        points                     // uint256 decryptedAmount
      );
      
      setMessage({ text: `${t('txSubmitted')}: ${tx.hash.slice(0, 10)}...`, type: 'info' });
      
      const receipt = await tx.wait();
      
      // 解析事件获取实际兑换的代币数量
      const redeemEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed?.name === 'TokensRedeemed';
        } catch {
          return false;
        }
      });

      let actualTokens = tokensToReceive;
      if (redeemEvent) {
        const parsed = contract.interface.parseLog(redeemEvent);
        const tokensReceived = parsed?.args.tokensReceived;
        actualTokens = (Number(tokensReceived) / 10**18).toFixed(2);
      }
      
      setMessage({ 
        text: `${t('exchangeSuccess')} ${points} ${t('forTokens')} ${actualTokens} ${t('tokens')}`, 
        type: 'success' 
      });
      
      setPointsToExchange('');
      
      // 清空解密缓存（积分已改变）
      setDecryptedPoints(null);
      
      refreshTreeInfo();
    } catch (error: any) {
      console.error('Exchange error:', error);
      
      // 更详细的错误信息
      let errorMessage = error.message;
      if (error.message.includes('insufficient')) {
        errorMessage = t('pointsInsufficientCheck');
      } else if (error.message.includes('underflow')) {
        errorMessage = t('pointsInsufficientUnderflow');
      }
      
      setMessage({ text: `${t('exchangeFailed')} ${errorMessage}`, type: 'error' });
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
        
        {/* 积分显示卡片 - 支持FHE解密 */}
        <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl">
          <div className="text-sm opacity-80 mb-2 flex items-center gap-2">
            {t('yourPoints')}
            <span className="text-xs bg-purple-500/50 px-2 py-0.5 rounded-full">🔒 FHE</span>
          </div>
          {decryptedPoints !== null ? (
            <div>
              <div className="text-3xl font-bold text-green-300">
                {decryptedPoints.toString()}
              </div>
              <button
                onClick={() => setDecryptedPoints(null)}
                className="text-xs opacity-60 mt-1 hover:opacity-100 transition-opacity"
              >
                ✅ {t('decrypted')} • {t('clickToHide')}
              </button>
            </div>
          ) : (
            <div>
              <div className="text-2xl font-mono opacity-50 mb-2">{t('encryptedData')}</div>
              <button
                onClick={handleDecryptPoints}
                disabled={isDecrypting || !isReady}
                className="text-xs bg-purple-500/30 hover:bg-purple-500/50 px-3 py-1 rounded-full transition-all disabled:opacity-30"
              >
                {isDecrypting ? t('decrypting') : !isReady ? t('fhevmLoadingButton') : t('clickToDecrypt')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* FHE状态提示 */}
      {!isReady && (
        <div className="mb-6 p-3 bg-yellow-500/20 border-2 border-yellow-500/50 rounded-lg animate-pulse">
          <div className="text-sm">
            {t('fhevmWarning')}
          </div>
        </div>
      )}

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
            max={decryptedPoints !== null ? decryptedPoints.toString() : undefined}
          />
          <button
            onClick={() => {
              if (decryptedPoints !== null) {
                setPointsToExchange(decryptedPoints.toString());
              } else {
                setMessage({ 
                  text: t('decryptFirst'), 
                  type: 'error' 
                });
              }
            }}
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

      {/* 兑换按钮 - 优化加载状态和即时反馈 */}
      <button
        onClick={handleExchange}
        disabled={
          loading || 
          !isReady || 
          !pointsToExchange || 
          Number(pointsToExchange) <= 0 || 
          tokenRemaining <= 0
        }
        className={`
          w-full bg-gradient-to-r from-yellow-500 to-pink-500 
          hover:from-yellow-600 hover:to-pink-600 
          disabled:opacity-50 disabled:cursor-not-allowed 
          text-white font-bold py-5 px-8 rounded-full text-xl 
          transition-all duration-200
          ${loading ? 'scale-95 opacity-80' : 'hover:scale-105'}
          hover:shadow-2xl disabled:hover:scale-100
          active:scale-95
        `}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-3">
            {/* 方案1: 脉冲效果（立即启动） */}
            <span className="relative flex h-6 w-6">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-6 w-6 bg-white/30 items-center justify-center">
                <span className="h-3 w-3 rounded-full bg-white"></span>
              </span>
            </span>
            
            {/* 方案2: 三点跳动（备选） - 取消注释使用 */}
            {/* <span className="flex gap-1">
              <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </span> */}
            
            <span>{t('exchanging')}</span>
          </span>
        ) : !isReady ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-pulse">⏳</span>
            <span>{t('fhevmLoadingButton')}</span>
          </span>
        ) : tokenRemaining <= 0 ? (
          t('allTokensMinted')
        ) : (
          <span className="flex items-center justify-center gap-2">
            {t('exchangeTokensFHE')}
          </span>
        )}
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
        <div className="mb-3">
          <strong className="text-purple-300">{t('fhePrivacyTitle')}</strong>
        </div>
        <ul className="space-y-1 ml-6 mb-4">
          <li>{t('fhePrivacyPoint1')}</li>
          <li>{t('fhePrivacyPoint2')}</li>
          <li>{t('fhePrivacyPoint3')}</li>
          <li>{t('fhePrivacyPoint4')}</li>
          <li>{t('fhePrivacyPoint5')}</li>
        </ul>
        
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