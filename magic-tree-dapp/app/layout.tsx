import type { Metadata } from 'next';
import './globals.css';
import { Web3Provider } from '@/contexts/Web3Context';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { InMemoryStorageProvider } from '@/hooks/useInMemoryStorage';

export const metadata: Metadata = {
  title: 'Magic Tree On Zama',
  description: 'Grow your magical tree and harvest bountiful fruits',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
      <LanguageProvider>
          <InMemoryStorageProvider> {/* ✅ 添加内存存储 Provider */}
            <Web3Provider>
              {children}
            </Web3Provider>
          </InMemoryStorageProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}