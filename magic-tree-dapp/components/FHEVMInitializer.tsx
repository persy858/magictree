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
  
  
  // 成功后不显示任何内容
  return null;
}