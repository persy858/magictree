// components/FHEVMInitializer.tsx
'use client';

import { useEffect } from 'react';
import { useFHEVM } from '@/hooks/useFHEVM';
import { useLanguage } from '@/contexts/LanguageContext';

interface FHEVMInitializerProps {
  onReady?: (ready: boolean) => void;
}

export default function FHEVMInitializer({ onReady }: FHEVMInitializerProps) {
  const { isReady, status, error } = useFHEVM();
  const { t } = useLanguage();
  useEffect(() => {
    console.log('FHEVM Status:', status);
    if (isReady) {
      console.log('✅ FHEVM initialized');
      onReady?.(true);
    }
    if (error) {
      console.error('❌ FHEVM initialization error:', error);
      onReady?.(false);
    }
  }, [isReady, error, onReady]);
  
  // 显示加载状态
  if (status === 'loading') {
    return (
      <div className="bg-white/15 backdrop-blur-md rounded-3xl p-10 text-center mb-8">
        <div className="text-4xl mb-4">🔐</div>
        <div className="text-xl font-semibold mb-2">{t('FHEiniting')}</div>
        <div className="flex justify-center items-center gap-2">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    );
  }
  
  
  // 成功后不显示任何内容
  return null;
}