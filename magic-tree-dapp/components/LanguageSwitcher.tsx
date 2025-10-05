'use client';

import { useLanguage } from '@/contexts/LanguageContext';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="fixed top-5 right-5 z-50 flex gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full">
      <button
        onClick={() => setLanguage('en')}
        className={`px-4 py-1 rounded-full transition-all cursor-pointer ${
          language === 'en'
            ? 'bg-white/30 border-2 border-white/80 font-bold'
            : 'border-2 border-white/30 hover:bg-white/20'
        }`}
        type="button"
      >
        English
      </button>
      <button
        onClick={() => setLanguage('zh')}
        className={`px-4 py-1 rounded-full transition-all cursor-pointer ${
          language === 'zh'
            ? 'bg-white/30 border-2 border-white/80 font-bold'
            : 'border-2 border-white/30 hover:bg-white/20'
        }`}
        type="button"
      >
        中文
      </button>
    </div>
  );
}