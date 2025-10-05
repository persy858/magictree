'use client';

import { useState, useEffect } from 'react';
import { useWeb3 } from '@/contexts/Web3Context';
import { useLanguage } from '@/contexts/LanguageContext';

interface LeaderboardEntry {
  address: string;
  points: bigint;
  fertilizeCount: bigint;
}

export default function Leaderboard() {
  const { contract, account } = useWeb3();
  const { t } = useLanguage();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalPlayers, setTotalPlayers] = useState(0);

  const loadLeaderboard = async () => {
    if (!contract) return;
    
    try {
      setLoading(true);
      
      // 获取总玩家数
      const total = await contract.getTotalPlayers();
      setTotalPlayers(Number(total));
      
      // 获取前10名
      const result = await contract.getLeaderboard(10);
      
      const entries: LeaderboardEntry[] = [];
      for (let i = 0; i < result.addresses.length; i++) {
        entries.push({
          address: result.addresses[i],
          points: result.points[i],
          fertilizeCount: result.fertilizeCounts[i],
        });
      }
      
      setLeaderboard(entries);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (contract) {
      loadLeaderboard();
    }
  }, [contract]);

  if (!contract) return null;

  return (
    <div className="bg-white/15 backdrop-blur-md rounded-3xl p-8 mt-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">{t('leaderboard')}</h2>
        <button
          onClick={loadLeaderboard}
          disabled={loading}
          className="px-4 py-2 bg-white/20 hover:bg-white/30 disabled:opacity-50 rounded-full transition-all text-sm"
        >
          {loading ? t('loading') : t('refresh')}
        </button>
      </div>

      {leaderboard.length === 0 ? (
        <div className="text-center py-8 opacity-70">
          {loading ? t('loading') : t('noPlayers')}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/20">
                <th className="px-4 py-3 text-left">{t('rank')}</th>
                <th className="px-4 py-3 text-left">{t('player')}</th>
                <th className="px-4 py-3 text-right">{t('totalPoints')}</th>
                <th className="px-4 py-3 text-right">{t('fertilizations')}</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, index) => {
                const isCurrentUser = account && entry.address.toLowerCase() === account.toLowerCase();
                
                return (
                  <tr
                    key={entry.address}
                    className={`border-b border-white/10 hover:bg-white/5 transition-colors ${
                      isCurrentUser ? 'bg-yellow-500/20' : ''
                    }`}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {index === 0 && <span className="text-2xl">🥇</span>}
                        {index === 1 && <span className="text-2xl">🥈</span>}
                        {index === 2 && <span className="text-2xl">🥉</span>}
                        {index > 2 && <span className="text-lg font-bold">#{index + 1}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-mono">
                      <div className="flex items-center gap-2">
                        <span>
                          {entry.address.slice(0, 6)}...{entry.address.slice(-4)}
                        </span>
                        {isCurrentUser && (
                          <span className="px-2 py-1 bg-yellow-500/30 rounded-full text-xs">
                            {t('you')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-xl font-bold text-yellow-300">
                        {entry.points.toString()}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right opacity-70">
                      {entry.fertilizeCount.toString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 text-center text-sm opacity-70">
        Total Players: {totalPlayers}
      </div>
    </div>
  );
}