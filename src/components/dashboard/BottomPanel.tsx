'use client';

import { useState, useEffect } from 'react';
import { useChartStore } from '@/stores/chartStore';

type TabKey = 'positions' | 'trades' | 'logs' | 'assets';

interface Position {
  symbol: string;
  positionSide: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  isolatedWallet: string;
  leverage: string;
}

export function BottomPanel() {
  const [activeTab, setActiveTab] = useState<TabKey>('positions');
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const setSymbol = useChartStore((state) => state.setSymbol);

  useEffect(() => {
    const fetchPositions = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/trading/binance/account');
        if (!response.ok) {
          throw new Error('Failed to fetch positions');
        }
        const data = await response.json();
        // Filter out positions with 0 amount
        const activePositions = (data.positions || []).filter(
          (pos: Position) => parseFloat(pos.positionAmt) !== 0
        );
        setPositions(activePositions);
      } catch (error) {
        console.error('Error fetching positions:', error);
        setPositions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPositions();

    // Update positions every 5 seconds
    const interval = setInterval(fetchPositions, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleSymbolClick = (symbol: string) => {
    setSymbol(symbol);
  };

  return (
    <div className="flex h-[280px] flex-col bg-panel-dark rounded-lg">
      <div className="flex border-b border-border-dark px-4">
        <button
          onClick={() => setActiveTab('positions')}
          className={`px-4 py-3 text-sm font-${activeTab === 'positions' ? 'bold' : 'medium'} ${
            activeTab === 'positions'
              ? 'border-b-2 border-white text-white'
              : 'text-text-secondary-dark hover:text-text-main-dark'
          }`}
        >
          현재 포지션
        </button>
        <button
          onClick={() => setActiveTab('trades')}
          className={`px-4 py-3 text-sm font-${activeTab === 'trades' ? 'bold' : 'medium'} ${
            activeTab === 'trades'
              ? 'border-b-2 border-white text-white'
              : 'text-text-secondary-dark hover:text-text-main-dark'
          }`}
        >
          거래 내역
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-3 text-sm font-${activeTab === 'logs' ? 'bold' : 'medium'} ${
            activeTab === 'logs'
              ? 'border-b-2 border-white text-white'
              : 'text-text-secondary-dark hover:text-text-main-dark'
          }`}
        >
          자동매매 로그
        </button>
        <button
          onClick={() => setActiveTab('assets')}
          className={`px-4 py-3 text-sm font-${activeTab === 'assets' ? 'bold' : 'medium'} ${
            activeTab === 'assets'
              ? 'border-b-2 border-white text-white'
              : 'text-text-secondary-dark hover:text-text-main-dark'
          }`}
        >
          자산 현황
        </button>
      </div>
      <div className="flex-1 overflow-auto p-2">
        {activeTab === 'positions' && (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-text-secondary-dark uppercase">
              <tr>
                <th className="px-4 py-2" scope="col">
                  종목
                </th>
                <th className="px-4 py-2" scope="col">
                  종류
                </th>
                <th className="px-4 py-2 text-right" scope="col">
                  수량
                </th>
                <th className="px-4 py-2 text-right" scope="col">
                  진입가
                </th>
                <th className="px-4 py-2 text-right" scope="col">
                  현재가
                </th>
                <th className="px-4 py-2 text-right" scope="col">
                  레버리지
                </th>
                <th className="px-4 py-2 text-right" scope="col">
                  미실현 손익
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-secondary-dark">
                    로딩 중...
                  </td>
                </tr>
              ) : positions.length > 0 ? (
                positions.map((position) => {
                  const positionAmt = parseFloat(position.positionAmt);
                  const entryPrice = parseFloat(position.entryPrice);
                  const markPrice = parseFloat(position.markPrice);
                  const unRealizedProfit = parseFloat(position.unRealizedProfit);
                  const isLong = positionAmt > 0;
                  const roe = entryPrice > 0
                    ? ((markPrice - entryPrice) / entryPrice * 100 * parseFloat(position.leverage) * (isLong ? 1 : -1))
                    : 0;

                  return (
                    <tr key={position.symbol} className="border-b border-border-dark hover:bg-background-dark/50 transition">
                      <td
                        className="px-4 py-2 font-bold cursor-pointer hover:text-positive transition"
                        onClick={() => handleSymbolClick(position.symbol)}
                      >
                        {position.symbol}
                      </td>
                      <td className={`px-4 py-2 font-bold ${isLong ? 'text-positive' : 'text-negative'}`}>
                        {position.positionSide === 'BOTH' ? (isLong ? '롱' : '숏') : position.positionSide}
                      </td>
                      <td className="px-4 py-2 text-right">{Math.abs(positionAmt).toFixed(4)}</td>
                      <td className="px-4 py-2 text-right">{entryPrice.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">{markPrice.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">{position.leverage}x</td>
                      <td className={`px-4 py-2 text-right font-semibold ${unRealizedProfit >= 0 ? 'text-positive' : 'text-negative'}`}>
                        {unRealizedProfit >= 0 ? '+' : ''}
                        {unRealizedProfit.toFixed(2)} USDT ({roe >= 0 ? '+' : ''}
                        {roe.toFixed(2)}%)
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-secondary-dark">
                    현재 포지션이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {activeTab === 'trades' && (
          <div className="flex items-center justify-center h-full text-text-secondary-dark">거래 내역이 없습니다.</div>
        )}
        {activeTab === 'logs' && (
          <div className="flex items-center justify-center h-full text-text-secondary-dark">
            자동매매 로그가 없습니다.
          </div>
        )}
        {activeTab === 'assets' && (
          <div className="flex items-center justify-center h-full text-text-secondary-dark">자산 현황 데이터 준비 중</div>
        )}
      </div>
    </div>
  );
}
