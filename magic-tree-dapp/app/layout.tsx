import type { Metadata } from 'next';
import './globals.css';
import { Web3Provider } from '@/contexts/Web3Context';
import { LanguageProvider } from '@/contexts/LanguageContext';

export const metadata: Metadata = {
  title: 'Magic Tree DApp - 神树DApp',
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
          <Web3Provider>
            {children}
          </Web3Provider>
        </LanguageProvider>
      </body>
    </html>
  );
}