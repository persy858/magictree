'use client';

import { useState, useEffect } from 'react';
import { useWeb3 } from '@/contexts/Web3Context';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFHEVM } from '@/hooks/useFHEVM';
import { useInMemoryStorage } from '@/hooks/useInMemoryStorage';

export default function TreeSection() {
  const { contract, treeInfo, refreshTreeInfo, signer, account } = useWeb3();
  const { t } = useLanguage();
  const [message, setMessage] = useState<{ text: string; type: string }>({ text: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // FHE相关状态
  const [isDecryptingPoints, setIsDecryptingPoints] = useState(false);
  const [decryptedPoints, setDecryptedPoints] = useState<bigint | null>(null);

  // 使用FHEVM实例
  const { fhevmInstance, isReady } = useFHEVM();

  const { storage } = useInMemoryStorage();

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

  // 当treeInfo变化时，清空解密的积分
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

    console.log("==========treeInfo");
    console.log(treeInfo);

    try {
      setIsDecryptingPoints(true);
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

  

      console.log("============fhevmInstance", fhevmInstance);
      console.log("============storage", storage);
      console.log("============signer", signer);
      console.log("============sig", sig);
      console.log("Encrypted points:", treeInfo.encryptedPoints);
      console.log("encryptedPoints Type:", typeof treeInfo.encryptedPoints);
      console.log("encryptedPoints length:", treeInfo.encryptedPoints.length);

      const decryptedData = await fhevmInstance.userDecrypt(
        [{ 
          handle: treeInfo.encryptedPoints, 
          contractAddress 
        }],
        sig.privateKey,
        sig.publicKey,
        sig.signature,
        sig.contractAddresses,
        sig.userAddress,
        sig.startTimestamp,
        sig.durationDays
      );

      console.log("decryptedData:", decryptedData);
      console.log(" decryptedData Type:", typeof decryptedData);

      const points = BigInt(decryptedData[treeInfo.encryptedPoints]);
      setDecryptedPoints(points);

      console.log(points)
      
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
      setIsDecryptingPoints(false);
    }
  };

  const handleFertilize = async () => {
    if (!contract) return;
    
    try {
      setLoading(true);
      setMessage({ text: t('fertilizing'), type: 'info' });
      
      const tx = await contract.fertilize();
      setMessage({ text: t('txSubmitted'), type: 'info' });
      
      const receipt = await tx.wait();
      
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
      
      refreshTreeInfo();

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
      
      await tx.wait();
      
      setMessage({ 
        text: t('harvestSuccessEncrypted'), 
        type: 'success' 
      });
      
      setDecryptedPoints(null);
      

      refreshTreeInfo();

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
          <div className="text-sm opacity-80 mb-2 flex items-center justify-center gap-2">
            {t('totalPoints')}
            <span className="text-xs bg-purple-500/50 px-2 py-1 rounded-full">🔒 FHE</span>
          </div>
          {decryptedPoints !== null ? (
            <div>
              <div className="text-4xl font-bold text-green-400 animate-pulse">
                {decryptedPoints.toString()}
              </div>
              <div className="text-xs mt-2 opacity-60">{t('alreadyDecrypted')}</div>
            </div>
          ) : (
            <div>
              <div className="text-3xl font-mono opacity-50">{t('encryptedData')}</div>
              <div className="text-xs mt-2 opacity-60">🔒 {t('encrypted')}</div>
            </div>
          )}
        </div>
      </div>

      {cooldown > 0 && (
        <div className="text-lg text-yellow-300 mb-4">
          {t('cooldownPrefix')} {cooldown}{t('cooldownSuffix')}
        </div>
      )}

      {treeInfo.dailyFertilizeRemaining !== undefined && (
        <div className="text-lg mb-4">
          {t('dailyLimit')} <span className="font-bold text-green-300">{treeInfo.dailyFertilizeRemaining.toString()}</span>{t('dailyLimitSuffix')}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <button
          onClick={handleFertilize}
          disabled={loading || cooldown > 0 || (treeInfo.dailyFertilizeRemaining !== undefined && treeInfo.dailyFertilizeRemaining === 0n)}
          className="bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-full text-lg transition-all hover:scale-105 hover:shadow-xl"
        >
          {loading ? '⏳' : t('fertilizeButton')}
        </button>
        
        <button
          onClick={handleHarvest}
          disabled={loading || treeInfo.fruits === 0n}
          className="bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-full text-lg transition-all hover:scale-105 hover:shadow-xl"
        >
          {loading ? '⏳' : t('harvestButton')}
        </button>

        <button
          onClick={handleDecryptPoints}
          disabled={
            isDecryptingPoints || 
            !isReady || 
            !treeInfo.encryptedPoints || 
            decryptedPoints !== null
          }
          className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-full text-lg transition-all hover:scale-105 hover:shadow-xl"
        >
          {isDecryptingPoints 
            ? t('decrypting')
            : decryptedPoints !== null 
              ? t('alreadyDecrypted')
              : isReady 
                ? t('decryptButton')
                : t('fhevmLoadingButton')}
        </button>
      </div>

      {!isReady && treeInfo.exists && (
        <div className="mb-4 p-3 bg-yellow-500/20 border-2 border-yellow-500/50 rounded-lg animate-pulse">
          <div className="text-sm">{t('fhevmWarning')}</div>
        </div>
      )}

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