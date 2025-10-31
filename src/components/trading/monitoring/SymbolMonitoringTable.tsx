'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, DollarSign, Info, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';

interface IndicatorValue {
  type: string;
  value: number;
  comparisonOperator: string;
  comparisonValue: number;
  signal: boolean;
  // DMI specific fields
  adx?: number;
  plusDI?: number;
  minusDI?: number;
  diComparison?: string;
  adxThreshold?: number;
  adxComparator?: string;
  adxVsDi?: string;
}

interface MarketData {
  volume24h: number;
  high24h: number;
  low24h: number;
  quoteVolume24h: number;
  openPrice24h: number;
  prevClosePrice: number;
  bidPrice: number;
  bidQty: number;
  askPrice: number;
  askQty: number;
  weightedAvgPrice: number;
}

interface TechnicalIndicators {
  rsi?: { value: number; overbought: boolean; oversold: boolean };
  macd?: { macd: number; signal: number; histogram: number; trend: 'bullish' | 'bearish' | 'neutral' };
  dmi?: { adx: number; plusDI: number; minusDI: number; trend: 'strong' | 'weak' };
  bb?: { upper: number; middle: number; lower: number; width: number };
  ma?: { ma7: number; ma25: number; ma50: number; ma200: number };
  volume?: { current: number; avg: number; ratio: number };
  atr?: { value: number; volatility: 'high' | 'medium' | 'low' };
  stochRsi?: { k: number; d: number; signal: 'buy' | 'sell' | 'neutral' };
}

interface PositionDetails {
  entryPrice?: number;
  entryTime?: Date;
  unrealizedPnl?: number;
  realizedPnl?: number;
  profitRate?: number;
  quantity?: number;
  leverage?: number;
  marginType?: 'cross' | 'isolated';
  liquidationPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
}

interface TradeHistory {
  lastTradeTime?: Date;
  totalTrades24h: number;
  winRate24h: number;
  avgProfit: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
}

interface SymbolMonitoringData {
  symbol: string;
  currentPrice: number;
  priceChange24h: number;

  // 시장 데이터
  marketData: MarketData;

  // 기술적 지표
  technicalIndicators: TechnicalIndicators;

  // 포지션 정보
  position: 'long' | 'short' | 'none';
  hasOpenPosition: boolean;
  positionDetails: PositionDetails;

  // 지표 정보
  indicators: IndicatorValue[];
  exitIndicators?: IndicatorValue[]; // EXIT 지표
  longEntrySignal: boolean;  // 롱 진입 신호
  shortEntrySignal: boolean; // 숏 진입 신호
  entrySignal: boolean;  // 진입 신호 (롱 또는 숏)
  exitSignal: boolean;
  signalStrength: number; // 0-100

  // 주문 금액 설정
  initialOrderAmount: number; // 최초 매수금액
  additionalOrderAmount: number; // 추가 매수 예정금액
  maxOrderAmount: number; // 매수한도
  currentInvestment: number; // 현재 투자금액

  // 평가 정보
  lastEvaluationTime: Date;
  lastSignalTime?: Date;
  evaluationCount24h: number;
  successRate24h: number;

  // 거래 내역
  tradeHistory: TradeHistory;

  // 위험 관리
  riskScore: number; // 0-100
  recommendedAction?: 'buy' | 'sell' | 'hold' | 'close';
}

export function SymbolMonitoringTable() {
  const [symbols, setSymbols] = useState<SymbolMonitoringData[]>([]);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 데이터 가져오기
  const fetchMonitoringData = async () => {
    try {
      // 활성 전략 가져오기
      const strategyRes = await fetch('/api/strategies?active=true');
      const data = await strategyRes.json();

      if (!data.strategies || data.strategies.length === 0) {
        setSymbols([]);
        setIsLoading(false);
        return;
      }

      const activeStrategy = data.strategies[0];

      // settings 필드 확인 - 구조가 다를 수 있음
      console.log('Active strategy structure:', activeStrategy);

      // 심볼 가져오기 - AutoTradingSettings 구조에 맞게
      const symbolSelection = activeStrategy?.settings?.symbolSelection;
      const monitoringSymbols = symbolSelection?.manualSymbols || [];

      if (monitoringSymbols.length === 0) {
        console.warn('No symbols found in strategy:', activeStrategy);
        setSymbols([]);
        setIsLoading(false);
        return;
      }

      // 각 심볼별 데이터 구성
      const symbolDataPromises = monitoringSymbols.map(async (symbol: string) => {
        try {
          // 현재 가격 및 시장 정보
          const tickerRes = await fetch(`/api/binance/ticker?symbol=${symbol}`);
          const ticker = tickerRes.ok ? await tickerRes.json() : null;

          // Binance API 필드 파싱
          const currentPrice = ticker ? parseFloat(ticker.lastPrice || ticker.price || 0) : 0;
          const priceChangePercent = ticker ? parseFloat(ticker.priceChangePercent || 0) : 0;

          // 시장 데이터 파싱
          const marketData: MarketData = ticker ? {
            volume24h: parseFloat(ticker.volume || 0),
            high24h: parseFloat(ticker.highPrice || 0),
            low24h: parseFloat(ticker.lowPrice || 0),
            quoteVolume24h: parseFloat(ticker.quoteVolume || 0),
            openPrice24h: parseFloat(ticker.openPrice || 0),
            prevClosePrice: parseFloat(ticker.prevClosePrice || 0),
            bidPrice: parseFloat(ticker.bidPrice || 0),
            bidQty: parseFloat(ticker.bidQty || 0),
            askPrice: parseFloat(ticker.askPrice || 0),
            askQty: parseFloat(ticker.askQty || 0),
            weightedAvgPrice: parseFloat(ticker.weightedAvgPrice || 0)
          } : {
            volume24h: 0, high24h: 0, low24h: 0, quoteVolume24h: 0,
            openPrice24h: 0, prevClosePrice: 0, bidPrice: 0, bidQty: 0,
            askPrice: 0, askQty: 0, weightedAvgPrice: 0
          };

        // 최근 평가 정보
        const evalRes = await fetch(`/api/monitoring/condition-evaluations?symbol=${symbol}&limit=100`);
        const evaluations = await evalRes.json();

        // 디버그: API 응답 확인
        console.log(`[DEBUG] ${symbol} evaluations response:`, {
          success: evaluations.success,
          count: evaluations.evaluations?.length,
          firstEval: evaluations.evaluations?.[0]
        });

        // 포지션 정보
        const positionsRes = await fetch('/api/monitoring/positions');
        const positionsData = await positionsRes.json();
        const position = positionsData.positions?.find((p: any) => p.symbol === symbol);

        // 포지션 세부 정보
        const positionDetails: PositionDetails = position ? {
          entryPrice: position.entry_price || 0,
          entryTime: position.opened_at ? new Date(position.opened_at) : undefined,
          unrealizedPnl: position.unrealized_pnl || 0,
          realizedPnl: position.realized_pnl || 0,
          profitRate: position.pnl_percentage || 0,
          quantity: position.quantity || 0,
          leverage: position.leverage || 1,
          marginType: position.margin_type || 'cross',
          liquidationPrice: position.liquidation_price,
          stopLoss: position.stop_loss,
          takeProfit: position.take_profit
        } : {};

        // 최신 평가에서 지표 정보 추출
        const latestEval = evaluations.evaluations?.[0];
        let indicators: IndicatorValue[] = [];
        let exitIndicators: IndicatorValue[] = []; // EXIT 지표 추가
        let entrySignal = false;
        let longEntrySignal = false; // 롱 진입 신호
        let shortEntrySignal = false; // 숏 진입 신호
        let exitSignal = false;
        let lastSignalTime: Date | undefined;

        // 최근 평가 중에서 ENTRY와 EXIT 각각 찾기 (direction은 details에서 확인)
        const entryEvaluations = evaluations.evaluations?.filter((e: any) => e.condition_type === 'ENTRY') || [];
        const latestLongEntry = entryEvaluations.find((e: any) => e.details?.context?.direction === 'long');
        const latestShortEntry = entryEvaluations.find((e: any) => e.details?.context?.direction === 'short');
        const latestEntry = latestLongEntry || latestShortEntry || entryEvaluations[0];
        const latestExit = evaluations.evaluations?.find((e: any) => e.condition_type === 'EXIT');

        // ENTRY_LONG 평가 처리
        if (latestLongEntry) {
          longEntrySignal = latestLongEntry.evaluation_result || false;

          if (latestLongEntry.details?.indicatorDetails && Array.isArray(latestLongEntry.details.indicatorDetails)) {
            indicators = latestLongEntry.details.indicatorDetails.map((ind: any) => ({
              type: ind.type || 'unknown',
              value: ind.value || 0,
              comparisonOperator: ind.comparison?.operator || 'none',
              comparisonValue: ind.comparison?.value || ind.comparison?.target || 0,
              signal: ind.signal || false,
              // DMI 상세 정보 추가 - details 객체에서 가져오거나 ind 객체에서 직접 가져오기
              ...(ind.type === 'dmi' ? {
                adx: ind.details?.adx || ind.adx || ind.value || 0,
                plusDI: ind.details?.plusDI || ind.plusDI || 0,
                minusDI: ind.details?.minusDI || ind.minusDI || 0,
                diComparison: ind.details?.diComparison || ind.diComparison || ind.config?.diComparison,
                adxThreshold: ind.details?.adxThreshold || ind.config?.adx?.value || 25,
                adxComparator: ind.details?.adxComparator || ind.config?.adx?.comparator || 'over',
                adxVsDi: ind.details?.adxVsDi || ind.config?.adxVsDi || null
              } : {})
            }));
          }

          if (longEntrySignal) {
            lastSignalTime = new Date(latestLongEntry.evaluated_at);
            entrySignal = true; // 롱 신호가 있으면 일반 진입 신호도 true
          }
        }

        // ENTRY_SHORT 평가 처리
        if (latestShortEntry) {
          shortEntrySignal = latestShortEntry.evaluation_result || false;

          // 숏 지표가 더 최신이거나 롱 지표가 없으면 숏 지표 사용
          if (!latestLongEntry || new Date(latestShortEntry.evaluated_at) > new Date(latestLongEntry.evaluated_at)) {
            if (latestShortEntry.details?.indicatorDetails && Array.isArray(latestShortEntry.details.indicatorDetails)) {
              indicators = latestShortEntry.details.indicatorDetails.map((ind: any) => ({
                type: ind.type || 'unknown',
                value: ind.value || 0,
                comparisonOperator: ind.comparison?.operator || 'none',
                comparisonValue: ind.comparison?.value || ind.comparison?.target || 0,
                signal: ind.signal || false,
                // DMI 상세 정보 추가 - ind 객체에서 직접 가져오거나 config에서 가져오기
                ...(ind.type === 'dmi' ? {
                  adx: ind.adx || ind.details?.adx || ind.value || 0,
                  plusDI: ind.plusDI || ind.details?.plusDI || 0,
                  minusDI: ind.minusDI || ind.details?.minusDI || 0,
                  diComparison: ind.diComparison || ind.details?.diComparison || ind.config?.diComparison,
                  adxThreshold: ind.adxThreshold || ind.details?.adxThreshold || ind.config?.adx?.value || 25,
                  adxComparator: ind.config?.adx?.comparator || 'over',
                  adxVsDi: ind.config?.adxVsDi || null
                } : {})
              }));
            }
          }

          if (shortEntrySignal) {
            if (!lastSignalTime || new Date(latestShortEntry.evaluated_at) > lastSignalTime) {
              lastSignalTime = new Date(latestShortEntry.evaluated_at);
            }
            entrySignal = true; // 숏 신호가 있으면 일반 진입 신호도 true
          }
        }

        // 레거시 ENTRY 평가 처리 (이전 버전 호환)
        if (!latestLongEntry && !latestShortEntry && latestEntry) {
          entrySignal = latestEntry.evaluation_result || false;

          // indicatorDetails 디버그 로그
          console.log('Latest Entry evaluation for', symbol, ':', {
            hasDetails: !!latestEntry.details,
            hasIndicatorDetails: !!latestEntry.details?.indicatorDetails,
            indicatorDetailsType: Array.isArray(latestEntry.details?.indicatorDetails) ? 'array' : typeof latestEntry.details?.indicatorDetails,
            indicatorDetailsLength: latestEntry.details?.indicatorDetails?.length,
            indicatorDetails: latestEntry.details?.indicatorDetails,
            rawDetails: latestEntry.details
          });

          if (latestEntry.details?.indicatorDetails && Array.isArray(latestEntry.details.indicatorDetails)) {
            indicators = latestEntry.details.indicatorDetails.map((ind: any) => {
              // DMI 데이터 디버그
              if (ind.type === 'dmi') {
                console.log('[DMI UI Debug] Raw indicator data:', {
                  type: ind.type,
                  value: ind.value,
                  details: ind.details,
                  config: ind.config,
                  adx: ind.adx,
                  plusDI: ind.plusDI,
                  minusDI: ind.minusDI
                });
              }

              const mappedIndicator = {
                type: ind.type || 'unknown',
                value: ind.value || 0,
                comparisonOperator: ind.comparison?.operator || 'none',
                comparisonValue: ind.comparison?.value || ind.comparison?.target || 0,
                signal: ind.signal || false,
                // DMI 상세 정보 추가 (details 객체에서 가져오거나 ind 객체에서 직접 가져오기)
                ...(ind.type === 'dmi' ? {
                  adx: ind.details?.adx || ind.adx || ind.value || 0,
                  plusDI: ind.details?.plusDI || ind.plusDI || 0,
                  minusDI: ind.details?.minusDI || ind.minusDI || 0,
                  diComparison: ind.details?.diComparison || ind.diComparison || ind.config?.diComparison,
                  adxThreshold: ind.details?.adxThreshold || ind.config?.adx?.value || 25,
                  adxComparator: ind.details?.adxComparator || ind.config?.adx?.comparator || 'over',
                  adxVsDi: ind.details?.adxVsDi || ind.config?.adxVsDi || null
                } : {})
              };

              if (ind.type === 'dmi') {
                console.log('[DMI UI Debug] Mapped indicator:', JSON.stringify(mappedIndicator, null, 2));
              }

              return mappedIndicator;
            });
          }

          if (entrySignal) {
            lastSignalTime = new Date(latestEntry.evaluated_at);
          }
        }

        // 평가 데이터가 없어도 전략 설정에서 조건 정보를 가져오기
        if (indicators.length === 0 && activeStrategy) {
          // 진입 조건 설정 확인
          const entryConditions = activeStrategy.settings?.entry;
          if (entryConditions) {
            const longConditions = entryConditions.long?.conditions || entryConditions.long?.indicators;
            if (longConditions) {
              console.log('Strategy conditions for', symbol, ':', longConditions);

              // 조건이 있지만 평가되지 않은 경우 기본값으로 표시
              const extractIndicators = (conditions: any): IndicatorValue[] => {
                const result: IndicatorValue[] = [];

                const processNode = (node: any) => {
                  if (node?.indicator) {
                    // 지표 노드
                    result.push({
                      type: node.indicator.type || 'unknown',
                      value: 0, // 평가되지 않음
                      comparisonOperator: node.indicator.config?.comparator || 'none',
                      comparisonValue: node.indicator.config?.value || 0,
                      signal: false // 평가되지 않음
                    });
                  } else if (node?.children && Array.isArray(node.children)) {
                    // 그룹 노드
                    node.children.forEach(processNode);
                  }
                };

                if (conditions.root) {
                  processNode(conditions.root);
                } else if (Array.isArray(conditions)) {
                  // 구형 형식 (배열)
                  conditions.forEach((cond: any) => {
                    if (cond.type && cond.config) {
                      result.push({
                        type: cond.type,
                        value: 0,
                        comparisonOperator: cond.config?.comparator || 'none',
                        comparisonValue: cond.config?.value || 0,
                        signal: false
                      });
                    }
                  });
                }

                return result;
              };

              const strategyIndicators = extractIndicators(longConditions);
              if (strategyIndicators.length > 0) {
                indicators = strategyIndicators;
                console.log('Using strategy indicators for', symbol, ':', indicators);
              }
            }
          }
        }

        // 포지션 존재 여부
        const hasOpenPosition = !!position;

        // EXIT 평가가 있고 포지션이 있을 때만 신호 업데이트
        // 포지션이 없으면 이전 평가 결과가 있어도 무시
        if (latestExit && hasOpenPosition) {
          exitSignal = latestExit.evaluation_result || false;

          // EXIT 지표 처리
          if (latestExit.details?.indicatorDetails && Array.isArray(latestExit.details.indicatorDetails)) {
            exitIndicators = latestExit.details.indicatorDetails.map((ind: any) => ({
              type: ind.type || 'unknown',
              value: ind.value || 0,
              comparisonOperator: ind.comparison?.operator || 'none',
              comparisonValue: ind.comparison?.value || ind.comparison?.target || 0,
              signal: ind.signal || false,
              // DMI 상세 정보 추가 (details 객체에서 가져오거나 value에서 추출)
              ...(ind.type === 'dmi' ? {
                adx: ind.details?.adx || ind.value || 0,
                plusDI: ind.details?.plusDI || ind.plusDI || 0,
                minusDI: ind.details?.minusDI || ind.minusDI || 0,
                diComparison: ind.details?.diComparison || ind.diComparison || ind.config?.diComparison,
                adxThreshold: ind.details?.adxThreshold || ind.config?.adx?.value || 25,
                adxComparator: ind.details?.adxComparator || ind.config?.adx?.comparator || 'over',
                adxVsDi: ind.details?.adxVsDi || ind.config?.adxVsDi || null
              } : {})
            }));
          }

          if (exitSignal && (!lastSignalTime || new Date(latestExit.evaluated_at) > lastSignalTime)) {
            lastSignalTime = new Date(latestExit.evaluated_at);
          }
        }

        // EXIT 조건도 전략 설정에서 가져오기
        if (exitIndicators.length === 0 && activeStrategy) {
          const exitConditions = activeStrategy.settings?.exit;
          if (exitConditions) {
            const longExitConditions = exitConditions.long?.conditions || exitConditions.long?.indicators;
            if (longExitConditions) {
              const extractIndicators = (conditions: any): IndicatorValue[] => {
                const result: IndicatorValue[] = [];
                const processNode = (node: any) => {
                  if (node?.indicator) {
                    result.push({
                      type: node.indicator.type || 'unknown',
                      value: 0,
                      comparisonOperator: node.indicator.config?.comparator || 'none',
                      comparisonValue: node.indicator.config?.value || 0,
                      signal: false
                    });
                  } else if (node?.children && Array.isArray(node.children)) {
                    node.children.forEach(processNode);
                  }
                };
                if (conditions.root) {
                  processNode(conditions.root);
                }
                return result;
              };
              exitIndicators = extractIndicators(longExitConditions);
            }
          }
        }

        // 기술적 지표 계산 (indicators에서 추출)
        const technicalIndicators: TechnicalIndicators = {};

        // DMI 지표 찾기
        const dmiIndicator = indicators.find(ind => ind.type === 'dmi');
        if (dmiIndicator) {
          // DMI 값이 불완전한 경우를 위한 보정
          let adxValue = dmiIndicator.adx || dmiIndicator.value || 0;
          let plusDIValue = dmiIndicator.plusDI || 0;
          let minusDIValue = dmiIndicator.minusDI || 0;

          // DI 값이 없고 ADX만 있는 경우, 실시간으로 계산
          if (adxValue > 0 && plusDIValue === 0 && minusDIValue === 0) {
            try {
              // 전략에서 interval 가져오기
              const interval = activeStrategy?.settings?.interval || '15m';

              // 실시간 DMI 계산 API 호출
              const dmiRes = await fetch(`/api/indicators/dmi?symbol=${symbol}&interval=${interval}`);
              if (dmiRes.ok) {
                const realtimeDmi = await dmiRes.json();
                adxValue = realtimeDmi.adx || adxValue;
                plusDIValue = realtimeDmi.plusDI || 0;
                minusDIValue = realtimeDmi.minusDI || 0;

                // indicators 배열 업데이트
                const dmiIndex = indicators.findIndex(ind => ind.type === 'dmi');
                if (dmiIndex >= 0) {
                  indicators[dmiIndex] = {
                    ...indicators[dmiIndex],
                    adx: adxValue,
                    plusDI: plusDIValue,
                    minusDI: minusDIValue
                  };
                }

                console.log(`[DMI Real-time] ${symbol}: ADX=${adxValue.toFixed(2)}, DI+=${plusDIValue.toFixed(2)}, DI-=${minusDIValue.toFixed(2)}`);
              }
            } catch (error) {
              console.error('Failed to fetch realtime DMI:', error);
            }
          }

          technicalIndicators.dmi = {
            adx: adxValue,
            plusDI: plusDIValue,
            minusDI: minusDIValue,
            trend: adxValue > 25 ? 'strong' : 'weak'
          };
        }

        // RSI 지표 찾기
        const rsiIndicator = indicators.find(ind => ind.type === 'rsi');
        if (rsiIndicator) {
          technicalIndicators.rsi = {
            value: rsiIndicator.value,
            overbought: rsiIndicator.value > 70,
            oversold: rsiIndicator.value < 30
          };
        }

        // 볼륨 정보 추가
        technicalIndicators.volume = {
          current: marketData.volume24h,
          avg: marketData.volume24h, // 평균 계산 필요
          ratio: 1 // 비율 계산 필요
        };

        // 신호 강도 계산 (충족된 지표 비율)
        const signalStrength = indicators.length > 0
          ? (indicators.filter(ind => ind.signal).length / indicators.length) * 100
          : 0;

        // 24시간 통계
        const last24h = evaluations.evaluations?.filter((e: any) =>
          new Date(e.evaluated_at || e.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
        );
        const successCount = last24h?.filter((e: any) => e.evaluation_result).length || 0;
        const totalCount = last24h?.length || 0;

        // 주문 금액 설정 (capital settings에서 가져오기)
        const capitalSettings = activeStrategy?.settings?.capital;
        const estimatedBalance = capitalSettings?.estimatedBalance || 1000;
        const maxMarginPercentage = capitalSettings?.maxMargin?.percentage || 10;
        const initialMarginMode = capitalSettings?.initialMargin?.mode || 'usdt';
        const initialMarginAmount = capitalSettings?.initialMargin?.amount || 100;

        // 초기 주문 금액 계산
        const initialOrderAmount = initialMarginMode === 'usdt'
          ? initialMarginAmount
          : (estimatedBalance * (initialMarginAmount / 100));

        // 최대 마진 금액 계산
        const maxOrderAmount = capitalSettings?.maxMargin?.basis === 'balance'
          ? (estimatedBalance * (maxMarginPercentage / 100))
          : (estimatedBalance * (maxMarginPercentage / 100));

        // 추가 매수 금액 (scale-in)
        const scaleInBudget = capitalSettings?.scaleInBudget;
        const additionalOrderAmount = scaleInBudget?.mode === 'usdt'
          ? (scaleInBudget?.amount || 50)
          : initialOrderAmount * 0.5; // 초기 금액의 50%로 기본 설정

        // 거래 내역 통계 계산
        const tradesRes = await fetch(`/api/monitoring/trades?symbol=${symbol}&limit=100`);
        const tradesData = await tradesRes.json();
        const trades = tradesData.trades || [];

        const trades24h = trades.filter((t: any) =>
          new Date(t.closed_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
        );

        const winTrades = trades24h.filter((t: any) => t.profit > 0);
        const lossTrades = trades24h.filter((t: any) => t.profit <= 0);

        const avgProfit = winTrades.length > 0
          ? winTrades.reduce((sum: number, t: any) => sum + t.profit, 0) / winTrades.length
          : 0;

        const avgLoss = lossTrades.length > 0
          ? Math.abs(lossTrades.reduce((sum: number, t: any) => sum + t.profit, 0) / lossTrades.length)
          : 0;

        const tradeHistory: TradeHistory = {
          lastTradeTime: trades[0] ? new Date(trades[0].closed_at) : undefined,
          totalTrades24h: trades24h.length,
          winRate24h: trades24h.length > 0 ? (winTrades.length / trades24h.length) * 100 : 0,
          avgProfit,
          avgLoss,
          profitFactor: avgLoss > 0 ? avgProfit / avgLoss : avgProfit > 0 ? 999 : 0,
          maxDrawdown: 0 // 계산 필요
        };

        // 리스크 점수 계산 (0-100)
        let riskScore = 0;

        // 포지션 리스크
        if (hasOpenPosition) {
          riskScore += 20;
          if (positionDetails.profitRate && positionDetails.profitRate < -5) riskScore += 20;
          if (positionDetails.profitRate && positionDetails.profitRate < -10) riskScore += 30;
        }

        // 변동성 리스크
        const volatility = Math.abs(priceChangePercent);
        if (volatility > 10) riskScore += 20;
        if (volatility > 20) riskScore += 20;

        // 레버리지 리스크
        if (positionDetails.leverage) {
          if (positionDetails.leverage > 10) riskScore += 15;
          if (positionDetails.leverage > 20) riskScore += 15;
        }

        riskScore = Math.min(100, riskScore);

        // 추천 액션 결정
        let recommendedAction: 'buy' | 'sell' | 'hold' | 'close' | undefined;
        if (hasOpenPosition) {
          if (exitSignal) recommendedAction = 'close';
          else if (positionDetails.profitRate && positionDetails.profitRate > 5) recommendedAction = 'sell';
          else recommendedAction = 'hold';
        } else {
          if (entrySignal && riskScore < 50) recommendedAction = 'buy';
          else recommendedAction = 'hold';
        }

        return {
          symbol,
          currentPrice,
          priceChange24h: priceChangePercent,

          // 시장 데이터
          marketData,

          // 기술적 지표
          technicalIndicators,

          // 포지션 정보
          position: position ? position.direction : 'none',
          hasOpenPosition,
          positionDetails,

          // 지표 정보
          indicators,
          exitIndicators, // EXIT 지표 추가
          entrySignal,
          longEntrySignal, // 롱 진입 신호
          shortEntrySignal, // 숏 진입 신호
          exitSignal,
          signalStrength,

          // 주문 금액 설정
          initialOrderAmount,
          additionalOrderAmount,
          maxOrderAmount,
          currentInvestment: position?.investment || 0,

          // 평가 정보
          lastEvaluationTime: latestEval ? new Date(latestEval.evaluated_at || latestEval.created_at) : new Date(),
          lastSignalTime,
          evaluationCount24h: totalCount,
          successRate24h: totalCount > 0 ? (successCount / totalCount) * 100 : 0,

          // 거래 내역
          tradeHistory,

          // 위험 관리
          riskScore,
          recommendedAction
        };
      } catch (error) {
        console.error(`Failed to fetch data for ${symbol}:`, error);
        // Return default data for failed symbols
        return {
          symbol,
          currentPrice: 0,
          priceChange24h: 0,
          marketData: {
            volume24h: 0, high24h: 0, low24h: 0, quoteVolume24h: 0,
            openPrice24h: 0, prevClosePrice: 0, bidPrice: 0, bidQty: 0,
            askPrice: 0, askQty: 0, weightedAvgPrice: 0
          },
          technicalIndicators: {},
          position: 'none' as const,
          hasOpenPosition: false,
          positionDetails: {},
          indicators: [],
          exitIndicators: [],
          entrySignal: false,
          longEntrySignal: false,
          shortEntrySignal: false,
          exitSignal: false,
          signalStrength: 0,
          initialOrderAmount: 0,
          additionalOrderAmount: 0,
          maxOrderAmount: 0,
          currentInvestment: 0,
          lastEvaluationTime: new Date(),
          lastSignalTime: undefined,
          evaluationCount24h: 0,
          successRate24h: 0,
          tradeHistory: {
            lastTradeTime: undefined,
            totalTrades24h: 0,
            winRate24h: 0,
            avgProfit: 0,
            avgLoss: 0,
            profitFactor: 0,
            maxDrawdown: 0
          },
          riskScore: 0,
          recommendedAction: 'hold' as const
        };
      }
    });

      const symbolData = await Promise.all(symbolDataPromises);
      setSymbols(symbolData);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData();
    const interval = setInterval(fetchMonitoringData, 5000); // 5초마다 업데이트
    return () => clearInterval(interval);
  }, []);

  const toggleExpanded = (symbol: string) => {
    setExpandedSymbol(expandedSymbol === symbol ? null : symbol);
  };

  if (isLoading) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-800 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-12 bg-zinc-800 rounded"></div>
            <div className="h-12 bg-zinc-800 rounded"></div>
            <div className="h-12 bg-zinc-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (symbols.length === 0) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6">
        <div className="text-center text-zinc-500 py-8">
          활성화된 전략이 없거나 모니터링 중인 종목이 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-400" />
          종목 모니터링 현황
        </h2>
        <div className="text-sm text-zinc-400">
          {symbols.length}개 종목 모니터링 중
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">종목</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-zinc-400">현재가</th>
              <th className="text-center py-3 px-4 text-sm font-medium text-zinc-400">포지션</th>
              <th className="text-center py-3 px-4 text-sm font-medium text-zinc-400">진입신호</th>
              <th className="text-center py-3 px-4 text-sm font-medium text-zinc-400">청산신호</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-zinc-400">투자금액</th>
              <th className="text-center py-3 px-4 text-sm font-medium text-zinc-400">24h 성공률</th>
              <th className="text-center py-3 px-4 text-sm font-medium text-zinc-400">상세</th>
            </tr>
          </thead>
          <tbody>
            {symbols.map((data) => (
              <React.Fragment key={data.symbol}>
                <tr
                  className="border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors cursor-pointer"
                  onClick={() => toggleExpanded(data.symbol)}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-100">{data.symbol}</span>
                      {data.priceChange24h > 0 ? (
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="text-zinc-100 font-mono">
                      ${data.currentPrice.toLocaleString()}
                    </div>
                    <div className={`text-xs ${data.priceChange24h > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {data.priceChange24h > 0 ? '+' : ''}{data.priceChange24h.toFixed(2)}%
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {data.hasOpenPosition ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                        data.position === 'long'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}>
                        {data.position === 'long' ? '롱' : '숏'}
                      </span>
                    ) : (
                      <span className="text-zinc-500 text-sm">대기</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {data.longEntrySignal || data.shortEntrySignal ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        data.longEntrySignal
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}>
                        {data.longEntrySignal ? '롱 진입' : '숏 진입'}
                      </span>
                    ) : (
                      <span className="text-zinc-500 text-xs">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      data.exitSignal ? 'bg-red-400 animate-pulse' : 'bg-zinc-600'
                    }`} />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="text-sm">
                      {data.currentInvestment > 0 ? (
                        <>
                          <div className="text-zinc-100 font-mono">
                            ${data.currentInvestment.toFixed(2)}
                          </div>
                          <div className="text-xs text-zinc-400">
                            / ${data.maxOrderAmount}
                          </div>
                        </>
                      ) : (
                        <span className="text-zinc-500">-</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="text-sm">
                      <div className={`font-medium ${
                        data.successRate24h > 50 ? 'text-emerald-400' : 'text-zinc-400'
                      }`}>
                        {data.successRate24h.toFixed(1)}%
                      </div>
                      <div className="text-xs text-zinc-500">
                        ({data.evaluationCount24h})
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {expandedSymbol === data.symbol ? (
                      <ChevronUp className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-400" />
                    )}
                  </td>
                </tr>

                {/* 확장된 상세 정보 - 모든 정보 표시 */}
                {expandedSymbol === data.symbol && (
                  <tr>
                    <td colSpan={8} className="p-0">
                      <div className="bg-zinc-900/50 border-t border-b border-zinc-800 p-6">
                        {/* 상단 요약 정보 */}
                        <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-zinc-800/50 rounded-lg">
                          {/* 신호 강도 */}
                          <div>
                            <div className="text-xs text-zinc-500 mb-1">신호 강도</div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-zinc-700 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    data.signalStrength > 70 ? 'bg-emerald-500' :
                                    data.signalStrength > 40 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${data.signalStrength}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono text-zinc-300">
                                {data.signalStrength.toFixed(0)}%
                              </span>
                            </div>
                          </div>

                          {/* 리스크 점수 */}
                          <div>
                            <div className="text-xs text-zinc-500 mb-1">리스크 점수</div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-zinc-700 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    data.riskScore < 30 ? 'bg-emerald-500' :
                                    data.riskScore < 70 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${data.riskScore}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono text-zinc-300">
                                {data.riskScore}/100
                              </span>
                            </div>
                          </div>

                          {/* 추천 액션 */}
                          <div>
                            <div className="text-xs text-zinc-500 mb-1">추천 액션</div>
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              data.recommendedAction === 'buy' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                              data.recommendedAction === 'sell' || data.recommendedAction === 'close' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                              'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}>
                              {data.recommendedAction === 'buy' ? '매수' :
                               data.recommendedAction === 'sell' ? '매도' :
                               data.recommendedAction === 'close' ? '청산' : '관망'}
                            </span>
                          </div>

                          {/* 마지막 신호 시간 */}
                          <div>
                            <div className="text-xs text-zinc-500 mb-1">마지막 신호</div>
                            <div className="text-xs text-zinc-300">
                              {data.lastSignalTime
                                ? new Date(data.lastSignalTime).toLocaleTimeString('ko-KR')
                                : '신호 없음'}
                            </div>
                          </div>
                        </div>

                        {/* 메인 정보 그리드 */}
                        <div className="grid grid-cols-4 gap-6">

                          {/* 시장 데이터 */}
                          <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                              <BarChart3 className="w-4 h-4 text-blue-400" />
                              시장 데이터
                            </h3>
                            <div className="space-y-2 bg-zinc-800/30 rounded p-3">
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-zinc-500">24h 거래량</span>
                                  <div className="text-zinc-100 font-mono">
                                    {(data.marketData.volume24h / 1000000).toFixed(2)}M
                                  </div>
                                </div>
                                <div>
                                  <span className="text-zinc-500">24h 거래대금</span>
                                  <div className="text-zinc-100 font-mono">
                                    ${(data.marketData.quoteVolume24h / 1000000).toFixed(2)}M
                                  </div>
                                </div>
                                <div>
                                  <span className="text-zinc-500">24h 최고가</span>
                                  <div className="text-emerald-400 font-mono">
                                    ${data.marketData.high24h.toLocaleString()}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-zinc-500">24h 최저가</span>
                                  <div className="text-red-400 font-mono">
                                    ${data.marketData.low24h.toLocaleString()}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-zinc-500">매수호가</span>
                                  <div className="text-emerald-300 font-mono">
                                    ${data.marketData.bidPrice.toFixed(2)}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-zinc-500">매도호가</span>
                                  <div className="text-red-300 font-mono">
                                    ${data.marketData.askPrice.toFixed(2)}
                                  </div>
                                </div>
                              </div>
                              <div className="pt-2 border-t border-zinc-700">
                                <div className="flex justify-between text-xs">
                                  <span className="text-zinc-500">가중평균가</span>
                                  <span className="text-blue-300 font-mono">
                                    ${data.marketData.weightedAvgPrice.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 기술적 지표 */}
                          <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-zinc-300 mb-3">기술적 지표</h3>
                            <div className="space-y-2 bg-zinc-800/30 rounded p-3">
                              {/* RSI */}
                              {data.technicalIndicators.rsi && (
                                <div className="pb-2 border-b border-zinc-700">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-zinc-400">RSI(14)</span>
                                    <span className={`font-mono ${
                                      data.technicalIndicators.rsi.overbought ? 'text-red-400' :
                                      data.technicalIndicators.rsi.oversold ? 'text-emerald-400' :
                                      'text-zinc-300'
                                    }`}>
                                      {data.technicalIndicators.rsi.value.toFixed(2)}
                                      {data.technicalIndicators.rsi.overbought && ' (과매수)'}
                                      {data.technicalIndicators.rsi.oversold && ' (과매도)'}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* DMI */}
                              {data.technicalIndicators.dmi && (
                                <div className="pb-2 border-b border-zinc-700">
                                  <div className="text-xs">
                                    <div className="flex justify-between mb-1">
                                      <span className="text-zinc-400">ADX</span>
                                      <span className={`font-mono ${
                                        data.technicalIndicators.dmi.trend === 'strong' ? 'text-emerald-400' : 'text-yellow-400'
                                      }`}>
                                        {data.technicalIndicators.dmi.adx.toFixed(2)}
                                        <span className="text-zinc-500 ml-1">
                                          ({data.technicalIndicators.dmi.trend === 'strong' ? '강한추세' : '약한추세'})
                                        </span>
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* 볼륨 */}
                              {data.technicalIndicators.volume && (
                                <div>
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-zinc-400">거래량 비율</span>
                                    <span className={`font-mono ${
                                      data.technicalIndicators.volume.ratio > 1.5 ? 'text-emerald-400' :
                                      data.technicalIndicators.volume.ratio > 1 ? 'text-yellow-400' :
                                      'text-zinc-400'
                                    }`}>
                                      {data.technicalIndicators.volume.ratio.toFixed(2)}x
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 포지션 상세 */}
                          <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-zinc-300 mb-3">포지션 상세</h3>
                            <div className="space-y-2 bg-zinc-800/30 rounded p-3">
                              {data.hasOpenPosition && data.positionDetails ? (
                                <>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-zinc-500">진입가격</span>
                                    <span className="text-zinc-100 font-mono">
                                      ${data.positionDetails.entryPrice?.toFixed(2) || '-'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-zinc-500">현재가격</span>
                                    <span className="text-zinc-100 font-mono">
                                      ${data.positionDetails.currentPrice?.toFixed(2) || '-'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-zinc-500">수량</span>
                                    <span className="text-zinc-100 font-mono">
                                      {data.positionDetails.quantity?.toFixed(4) || '-'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-zinc-500">레버리지</span>
                                    <span className="text-yellow-400 font-mono">
                                      {data.positionDetails.leverage || 1}x
                                    </span>
                                  </div>
                                  <div className="pt-2 border-t border-zinc-700">
                                    <div className="flex justify-between text-xs">
                                      <span className="text-zinc-500">미실현 손익</span>
                                      <span className={`font-mono font-medium ${
                                        (data.positionDetails.unrealizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                                      }`}>
                                        ${data.positionDetails.unrealizedPnl?.toFixed(2) || '0.00'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-xs mt-1">
                                      <span className="text-zinc-500">수익률</span>
                                      <span className={`font-mono font-medium ${
                                        (data.positionDetails.profitRate || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                                      }`}>
                                        {data.positionDetails.profitRate?.toFixed(2) || '0.00'}%
                                      </span>
                                    </div>
                                  </div>
                                  <div className="pt-2 border-t border-zinc-700">
                                    <div className="flex justify-between text-xs">
                                      <span className="text-zinc-500">진입시간</span>
                                      <span className="text-zinc-400">
                                        {data.positionDetails.entryTime
                                          ? new Date(data.positionDetails.entryTime).toLocaleTimeString('ko-KR')
                                          : '-'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-xs mt-1">
                                      <span className="text-zinc-500">보유시간</span>
                                      <span className="text-zinc-400">
                                        {data.positionDetails.holdingTime || '-'}
                                      </span>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="text-xs text-zinc-500 text-center py-4">
                                  오픈 포지션 없음
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 거래 통계 */}
                          <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-zinc-300 mb-3">거래 통계 (24h)</h3>
                            <div className="space-y-2 bg-zinc-800/30 rounded p-3">
                              <div className="flex justify-between text-xs">
                                <span className="text-zinc-500">총 거래</span>
                                <span className="text-zinc-100">{data.tradeHistory.totalTrades24h}회</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-zinc-500">승률</span>
                                <span className={`font-medium ${
                                  data.tradeHistory.winRate24h > 50 ? 'text-emerald-400' : 'text-red-400'
                                }`}>
                                  {data.tradeHistory.winRate24h.toFixed(1)}%
                                </span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-zinc-500">평균 수익</span>
                                <span className="text-emerald-400 font-mono">
                                  ${data.tradeHistory.avgProfit.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-zinc-500">평균 손실</span>
                                <span className="text-red-400 font-mono">
                                  ${data.tradeHistory.avgLoss.toFixed(2)}
                                </span>
                              </div>
                              <div className="pt-2 border-t border-zinc-700">
                                <div className="flex justify-between text-xs">
                                  <span className="text-zinc-500">손익비율</span>
                                  <span className={`font-mono font-medium ${
                                    data.tradeHistory.profitFactor > 1 ? 'text-emerald-400' : 'text-red-400'
                                  }`}>
                                    {data.tradeHistory.profitFactor > 100 ? '∞' : data.tradeHistory.profitFactor.toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex justify-between text-xs mt-1">
                                  <span className="text-zinc-500">최대 손실</span>
                                  <span className="text-red-400 font-mono">
                                    ${data.tradeHistory.maxDrawdown.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                              {data.tradeHistory.lastTradeTime && (
                                <div className="pt-2 border-t border-zinc-700">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-zinc-500">마지막 거래</span>
                                    <span className="text-zinc-400">
                                      {new Date(data.tradeHistory.lastTradeTime).toLocaleTimeString('ko-KR')}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 조건 평가 상세 */}
                        <div className="mt-6">
                          <h3 className="text-sm font-semibold text-zinc-300 mb-3">조건 평가 상세</h3>

                          {/* 진입/청산 조건 탭 스타일 표시 */}
                          <div className="grid grid-cols-2 gap-4">
                            {/* 진입 조건 (ENTRY) */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-medium text-emerald-400">
                                  진입 조건 {data.longEntrySignal ? '(롱)' : data.shortEntrySignal ? '(숏)' : ''}
                                </span>
                                {(data.longEntrySignal || data.shortEntrySignal) && (
                                  <span className={`text-xs px-2 py-0.5 rounded ${
                                    data.longEntrySignal
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-red-500/20 text-red-300 border border-red-500/30'
                                  }`}>
                                    {data.longEntrySignal ? '롱 신호' : '숏 신호'}
                                  </span>
                                )}
                              </div>
                              {data.indicators.length > 0 ? (
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                  {data.indicators.map((indicator, idx) => {
                                    const isEvaluated = indicator.value !== 0;
                                    return (
                                      <div key={`entry-${idx}`} className="bg-zinc-800 rounded p-3">
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium text-blue-400">
                                              {indicator.type.toUpperCase()}
                                            </span>
                                            {!isEvaluated && (
                                              <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">
                                                평가 대기
                                              </span>
                                            )}
                                          </div>
                                          <span className={`text-xs px-2 py-0.5 rounded ${
                                            !isEvaluated
                                              ? 'bg-zinc-700 text-zinc-400 border border-zinc-600'
                                              : indicator.signal
                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                : 'bg-red-500/20 text-red-300 border border-red-500/30'
                                          }`}>
                                            {!isEvaluated ? '미평가' : indicator.signal ? '충족' : '미충족'}
                                          </span>
                                        </div>
                                        {indicator.type === 'dmi' && indicator.adx !== undefined ? (
                                          // DMI 상세 정보 표시
                                          <div className="space-y-2">
                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                              <div>
                                                <span className="text-zinc-600">ADX:</span>
                                                <div className={`font-mono ${
                                                  indicator.adx > (indicator.adxThreshold || 25)
                                                    ? 'text-emerald-300'
                                                    : 'text-red-300'
                                                }`}>
                                                  {indicator.adx.toFixed(2)}
                                                </div>
                                              </div>
                                              <div>
                                                <span className="text-zinc-600">DI+:</span>
                                                <div className={`font-mono ${
                                                  indicator.plusDI && indicator.minusDI && indicator.plusDI > indicator.minusDI
                                                    ? 'text-emerald-300 font-bold'
                                                    : indicator.plusDI ? 'text-cyan-300' : 'text-zinc-500'
                                                }`}>
                                                  {indicator.plusDI ? indicator.plusDI.toFixed(2) : '계산중'}
                                                </div>
                                              </div>
                                              <div>
                                                <span className="text-zinc-600">DI-:</span>
                                                <div className={`font-mono ${
                                                  indicator.plusDI && indicator.minusDI && indicator.minusDI > indicator.plusDI
                                                    ? 'text-red-300 font-bold'
                                                    : indicator.minusDI ? 'text-cyan-300' : 'text-zinc-500'
                                                }`}>
                                                  {indicator.minusDI ? indicator.minusDI.toFixed(2) : '계산중'}
                                                </div>
                                              </div>
                                            </div>
                                            <div className="text-xs space-y-1 pt-1 border-t border-zinc-700">
                                              <div className="flex justify-between">
                                                <span className="text-zinc-600">ADX 조건:</span>
                                                <span className={`font-mono ${
                                                  indicator.adx > (indicator.adxThreshold || 25)
                                                    ? 'text-emerald-300'
                                                    : 'text-red-300'
                                                }`}>
                                                  ADX {indicator.adxThreshold ? indicator.adxComparator || '>' : '>'} {indicator.adxThreshold || 25}
                                                  {indicator.adx > (indicator.adxThreshold || 25) ? ' ✓' : ' ✗'}
                                                </span>
                                              </div>
                                              {/* DI 비교 - 롱/숏 조건을 모두 표시 */}
                                              <div className="flex flex-col gap-1">
                                                <div className="flex justify-between">
                                                  <span className="text-zinc-600">롱 조건:</span>
                                                  <span className={`font-mono ${
                                                    indicator.plusDI > indicator.minusDI
                                                      ? 'text-emerald-300'
                                                      : 'text-zinc-500'
                                                  }`}>
                                                    DI+ ({indicator.plusDI?.toFixed(1)}) {indicator.plusDI > indicator.minusDI ? '>' : '<'} DI- ({indicator.minusDI?.toFixed(1)})
                                                    {indicator.plusDI > indicator.minusDI ? ' ✓' : ' ✗'}
                                                  </span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span className="text-zinc-600">숏 조건:</span>
                                                  <span className={`font-mono ${
                                                    indicator.minusDI > indicator.plusDI
                                                      ? 'text-red-300'
                                                      : 'text-zinc-500'
                                                  }`}>
                                                    DI- ({indicator.minusDI?.toFixed(1)}) {indicator.minusDI > indicator.plusDI ? '>' : '<'} DI+ ({indicator.plusDI?.toFixed(1)})
                                                    {indicator.minusDI > indicator.plusDI ? ' ✓' : ' ✗'}
                                                  </span>
                                                </div>
                                              </div>
                                              {/* ADX vs DI 조건 */}
                                              {indicator.adxVsDi && indicator.adxVsDi !== 'none' && (
                                                <div className="mt-2 pt-2 border-t border-zinc-700">
                                                  <div className="flex justify-between">
                                                    <span className="text-zinc-600">ADX vs DI:</span>
                                                    <span className={`font-mono text-xs ${
                                                      (indicator.adxVsDi === 'adx_gt_di_plus' && indicator.adx > indicator.plusDI) ||
                                                      (indicator.adxVsDi === 'adx_lt_di_plus' && indicator.plusDI > indicator.adx) ||
                                                      (indicator.adxVsDi === 'adx_gt_di_minus' && indicator.adx > indicator.minusDI) ||
                                                      (indicator.adxVsDi === 'adx_lt_di_minus' && indicator.minusDI > indicator.adx)
                                                        ? 'text-emerald-300'
                                                        : 'text-zinc-500'
                                                    }`}>
                                                      {indicator.adxVsDi === 'adx_gt_di_plus' ? `ADX (${indicator.adx?.toFixed(1)}) ${indicator.adx > indicator.plusDI ? '>' : '<'} DI+ (${indicator.plusDI?.toFixed(1)})` :
                                                       indicator.adxVsDi === 'adx_lt_di_plus' ? `DI+ (${indicator.plusDI?.toFixed(1)}) ${indicator.plusDI > indicator.adx ? '>' : '<'} ADX (${indicator.adx?.toFixed(1)})` :
                                                       indicator.adxVsDi === 'adx_gt_di_minus' ? `ADX (${indicator.adx?.toFixed(1)}) ${indicator.adx > indicator.minusDI ? '>' : '<'} DI- (${indicator.minusDI?.toFixed(1)})` :
                                                       indicator.adxVsDi === 'adx_lt_di_minus' ? `DI- (${indicator.minusDI?.toFixed(1)}) ${indicator.minusDI > indicator.adx ? '>' : '<'} ADX (${indicator.adx?.toFixed(1)})` :
                                                       'none'
                                                      }
                                                      {((indicator.adxVsDi === 'adx_gt_di_plus' && indicator.adx > indicator.plusDI) ||
                                                        (indicator.adxVsDi === 'adx_lt_di_plus' && indicator.plusDI > indicator.adx) ||
                                                        (indicator.adxVsDi === 'adx_gt_di_minus' && indicator.adx > indicator.minusDI) ||
                                                        (indicator.adxVsDi === 'adx_lt_di_minus' && indicator.minusDI > indicator.adx))
                                                        ? ' ✓' : ' ✗'}
                                                    </span>
                                                  </div>
                                                </div>
                                              )}
                                              {/* DMI 진입 조건 종합 판단 */}
                                              <div className="mt-2 pt-2 border-t border-zinc-700 flex flex-col gap-1">
                                                <div className="flex justify-between">
                                                  <span className="text-zinc-600 font-medium">롱 진입:</span>
                                                  <span className={`font-mono text-xs font-bold ${
                                                    (() => {
                                                      const adxOk = indicator.adx > (indicator.adxThreshold || 25);
                                                      const diOk = indicator.plusDI > indicator.minusDI;
                                                      const adxVsDiOk = !indicator.adxVsDi || indicator.adxVsDi === 'none' ||
                                                        (indicator.adxVsDi === 'adx_lt_di_plus' && indicator.plusDI > indicator.adx) ||
                                                        (indicator.adxVsDi === 'adx_gt_di_plus' && indicator.adx > indicator.plusDI);
                                                      return adxOk && diOk && adxVsDiOk ? 'text-emerald-400' : 'text-zinc-500';
                                                    })()
                                                  }`}>
                                                    {(() => {
                                                      const adxOk = indicator.adx > (indicator.adxThreshold || 25);
                                                      const diOk = indicator.plusDI > indicator.minusDI;
                                                      const adxVsDiOk = !indicator.adxVsDi || indicator.adxVsDi === 'none' ||
                                                        (indicator.adxVsDi === 'adx_lt_di_plus' && indicator.plusDI > indicator.adx) ||
                                                        (indicator.adxVsDi === 'adx_gt_di_plus' && indicator.adx > indicator.plusDI);
                                                      return adxOk && diOk && adxVsDiOk ? '✓ 충족' : '✗ 미충족';
                                                    })()}
                                                  </span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span className="text-zinc-600 font-medium">숏 진입:</span>
                                                  <span className={`font-mono text-xs font-bold ${
                                                    (() => {
                                                      const adxOk = indicator.adx > (indicator.adxThreshold || 25);
                                                      const diOk = indicator.minusDI > indicator.plusDI;
                                                      const adxVsDiOk = !indicator.adxVsDi || indicator.adxVsDi === 'none' ||
                                                        (indicator.adxVsDi === 'adx_lt_di_minus' && indicator.minusDI > indicator.adx) ||
                                                        (indicator.adxVsDi === 'adx_gt_di_minus' && indicator.adx > indicator.minusDI);
                                                      return adxOk && diOk && adxVsDiOk ? 'text-red-400' : 'text-zinc-500';
                                                    })()
                                                  }`}>
                                                    {(() => {
                                                      const adxOk = indicator.adx > (indicator.adxThreshold || 25);
                                                      const diOk = indicator.minusDI > indicator.plusDI;
                                                      const adxVsDiOk = !indicator.adxVsDi || indicator.adxVsDi === 'none' ||
                                                        (indicator.adxVsDi === 'adx_lt_di_minus' && indicator.minusDI > indicator.adx) ||
                                                        (indicator.adxVsDi === 'adx_gt_di_minus' && indicator.adx > indicator.minusDI);
                                                      return adxOk && diOk && adxVsDiOk ? '✓ 충족' : '✗ 미충족';
                                                    })()}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ) : (
                                          // 기타 지표 정보 표시
                                          <div className="grid grid-cols-3 gap-2 text-xs">
                                            <div>
                                              <span className="text-zinc-600">계산값:</span>
                                              <div className={`font-mono ${isEvaluated ? 'text-cyan-300' : 'text-zinc-500'}`}>
                                                {isEvaluated ? indicator.value.toFixed(4) : '-'}
                                              </div>
                                            </div>
                                            <div>
                                              <span className="text-zinc-600">연산자:</span>
                                              <div className="font-mono text-yellow-300">
                                                {indicator.comparisonOperator || 'none'}
                                              </div>
                                            </div>
                                            <div>
                                              <span className="text-zinc-600">비교값:</span>
                                              <div className="font-mono text-purple-300">
                                                {indicator.comparisonValue || '-'}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-xs text-zinc-500 text-center py-4 bg-zinc-800/30 rounded">
                                  <div className="mb-1">📊 진입 조건 없음</div>
                                  <div className="text-zinc-600 text-xs">전략 설정에서 추가</div>
                                </div>
                              )}
                            </div>

                            {/* 청산 조건 (EXIT) */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-medium text-red-400">청산 조건 (EXIT)</span>
                                {data.exitSignal && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                                    신호 활성
                                  </span>
                                )}
                              </div>
                              {data.exitIndicators && data.exitIndicators.length > 0 ? (
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                  {data.exitIndicators.map((indicator, idx) => {
                                    const isEvaluated = indicator.value !== 0;
                                    return (
                                      <div key={`exit-${idx}`} className="bg-zinc-800 rounded p-3">
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium text-blue-400">
                                              {indicator.type.toUpperCase()}
                                            </span>
                                            {!isEvaluated && (
                                              <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">
                                                평가 대기
                                              </span>
                                            )}
                                          </div>
                                          <span className={`text-xs px-2 py-0.5 rounded ${
                                            !isEvaluated
                                              ? 'bg-zinc-700 text-zinc-400 border border-zinc-600'
                                              : indicator.signal
                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                : 'bg-red-500/20 text-red-300 border border-red-500/30'
                                          }`}>
                                            {!isEvaluated ? '미평가' : indicator.signal ? '충족' : '미충족'}
                                          </span>
                                        </div>
                                        {indicator.type === 'dmi' && indicator.adx !== undefined ? (
                                          // DMI 상세 정보 표시
                                          <div className="space-y-2">
                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                              <div>
                                                <span className="text-zinc-600">ADX:</span>
                                                <div className={`font-mono ${
                                                  indicator.adx > (indicator.adxThreshold || 25)
                                                    ? 'text-emerald-300'
                                                    : 'text-red-300'
                                                }`}>
                                                  {indicator.adx.toFixed(2)}
                                                </div>
                                              </div>
                                              <div>
                                                <span className="text-zinc-600">DI+:</span>
                                                <div className={`font-mono ${
                                                  indicator.plusDI && indicator.minusDI && indicator.plusDI > indicator.minusDI
                                                    ? 'text-emerald-300 font-bold'
                                                    : indicator.plusDI ? 'text-cyan-300' : 'text-zinc-500'
                                                }`}>
                                                  {indicator.plusDI ? indicator.plusDI.toFixed(2) : '계산중'}
                                                </div>
                                              </div>
                                              <div>
                                                <span className="text-zinc-600">DI-:</span>
                                                <div className={`font-mono ${
                                                  indicator.plusDI && indicator.minusDI && indicator.minusDI > indicator.plusDI
                                                    ? 'text-red-300 font-bold'
                                                    : indicator.minusDI ? 'text-cyan-300' : 'text-zinc-500'
                                                }`}>
                                                  {indicator.minusDI ? indicator.minusDI.toFixed(2) : '계산중'}
                                                </div>
                                              </div>
                                            </div>
                                            <div className="text-xs space-y-1 pt-1 border-t border-zinc-700">
                                              <div className="flex justify-between">
                                                <span className="text-zinc-600">ADX 조건:</span>
                                                <span className={`font-mono ${
                                                  indicator.adx > (indicator.adxThreshold || 25)
                                                    ? 'text-emerald-300'
                                                    : 'text-red-300'
                                                }`}>
                                                  ADX {indicator.adxThreshold ? indicator.adxComparator || '>' : '>'} {indicator.adxThreshold || 25}
                                                  {indicator.adx > (indicator.adxThreshold || 25) ? ' ✓' : ' ✗'}
                                                </span>
                                              </div>
                                              {/* DI 비교 - 롱/숏 조건을 모두 표시 */}
                                              <div className="flex flex-col gap-1">
                                                <div className="flex justify-between">
                                                  <span className="text-zinc-600">롱 조건:</span>
                                                  <span className={`font-mono ${
                                                    indicator.plusDI > indicator.minusDI
                                                      ? 'text-emerald-300'
                                                      : 'text-zinc-500'
                                                  }`}>
                                                    DI+ ({indicator.plusDI?.toFixed(1)}) {indicator.plusDI > indicator.minusDI ? '>' : '<'} DI- ({indicator.minusDI?.toFixed(1)})
                                                    {indicator.plusDI > indicator.minusDI ? ' ✓' : ' ✗'}
                                                  </span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span className="text-zinc-600">숏 조건:</span>
                                                  <span className={`font-mono ${
                                                    indicator.minusDI > indicator.plusDI
                                                      ? 'text-red-300'
                                                      : 'text-zinc-500'
                                                  }`}>
                                                    DI- ({indicator.minusDI?.toFixed(1)}) {indicator.minusDI > indicator.plusDI ? '>' : '<'} DI+ ({indicator.plusDI?.toFixed(1)})
                                                    {indicator.minusDI > indicator.plusDI ? ' ✓' : ' ✗'}
                                                  </span>
                                                </div>
                                              </div>
                                              {/* ADX vs DI 조건 */}
                                              {indicator.adxVsDi && indicator.adxVsDi !== 'none' && (
                                                <div className="mt-2 pt-2 border-t border-zinc-700">
                                                  <div className="flex justify-between">
                                                    <span className="text-zinc-600">ADX vs DI:</span>
                                                    <span className={`font-mono text-xs ${
                                                      (indicator.adxVsDi === 'adx_gt_di_plus' && indicator.adx > indicator.plusDI) ||
                                                      (indicator.adxVsDi === 'adx_lt_di_plus' && indicator.plusDI > indicator.adx) ||
                                                      (indicator.adxVsDi === 'adx_gt_di_minus' && indicator.adx > indicator.minusDI) ||
                                                      (indicator.adxVsDi === 'adx_lt_di_minus' && indicator.minusDI > indicator.adx)
                                                        ? 'text-emerald-300'
                                                        : 'text-zinc-500'
                                                    }`}>
                                                      {indicator.adxVsDi === 'adx_gt_di_plus' ? `ADX (${indicator.adx?.toFixed(1)}) ${indicator.adx > indicator.plusDI ? '>' : '<'} DI+ (${indicator.plusDI?.toFixed(1)})` :
                                                       indicator.adxVsDi === 'adx_lt_di_plus' ? `DI+ (${indicator.plusDI?.toFixed(1)}) ${indicator.plusDI > indicator.adx ? '>' : '<'} ADX (${indicator.adx?.toFixed(1)})` :
                                                       indicator.adxVsDi === 'adx_gt_di_minus' ? `ADX (${indicator.adx?.toFixed(1)}) ${indicator.adx > indicator.minusDI ? '>' : '<'} DI- (${indicator.minusDI?.toFixed(1)})` :
                                                       indicator.adxVsDi === 'adx_lt_di_minus' ? `DI- (${indicator.minusDI?.toFixed(1)}) ${indicator.minusDI > indicator.adx ? '>' : '<'} ADX (${indicator.adx?.toFixed(1)})` :
                                                       'none'
                                                      }
                                                      {((indicator.adxVsDi === 'adx_gt_di_plus' && indicator.adx > indicator.plusDI) ||
                                                        (indicator.adxVsDi === 'adx_lt_di_plus' && indicator.plusDI > indicator.adx) ||
                                                        (indicator.adxVsDi === 'adx_gt_di_minus' && indicator.adx > indicator.minusDI) ||
                                                        (indicator.adxVsDi === 'adx_lt_di_minus' && indicator.minusDI > indicator.adx))
                                                        ? ' ✓' : ' ✗'}
                                                    </span>
                                                  </div>
                                                </div>
                                              )}
                                              {/* DMI 진입 조건 종합 판단 */}
                                              <div className="mt-2 pt-2 border-t border-zinc-700 flex flex-col gap-1">
                                                <div className="flex justify-between">
                                                  <span className="text-zinc-600 font-medium">롱 진입:</span>
                                                  <span className={`font-mono text-xs font-bold ${
                                                    (() => {
                                                      const adxOk = indicator.adx > (indicator.adxThreshold || 25);
                                                      const diOk = indicator.plusDI > indicator.minusDI;
                                                      const adxVsDiOk = !indicator.adxVsDi || indicator.adxVsDi === 'none' ||
                                                        (indicator.adxVsDi === 'adx_lt_di_plus' && indicator.plusDI > indicator.adx) ||
                                                        (indicator.adxVsDi === 'adx_gt_di_plus' && indicator.adx > indicator.plusDI);
                                                      return adxOk && diOk && adxVsDiOk ? 'text-emerald-400' : 'text-zinc-500';
                                                    })()
                                                  }`}>
                                                    {(() => {
                                                      const adxOk = indicator.adx > (indicator.adxThreshold || 25);
                                                      const diOk = indicator.plusDI > indicator.minusDI;
                                                      const adxVsDiOk = !indicator.adxVsDi || indicator.adxVsDi === 'none' ||
                                                        (indicator.adxVsDi === 'adx_lt_di_plus' && indicator.plusDI > indicator.adx) ||
                                                        (indicator.adxVsDi === 'adx_gt_di_plus' && indicator.adx > indicator.plusDI);
                                                      return adxOk && diOk && adxVsDiOk ? '✓ 충족' : '✗ 미충족';
                                                    })()}
                                                  </span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span className="text-zinc-600 font-medium">숏 진입:</span>
                                                  <span className={`font-mono text-xs font-bold ${
                                                    (() => {
                                                      const adxOk = indicator.adx > (indicator.adxThreshold || 25);
                                                      const diOk = indicator.minusDI > indicator.plusDI;
                                                      const adxVsDiOk = !indicator.adxVsDi || indicator.adxVsDi === 'none' ||
                                                        (indicator.adxVsDi === 'adx_lt_di_minus' && indicator.minusDI > indicator.adx) ||
                                                        (indicator.adxVsDi === 'adx_gt_di_minus' && indicator.adx > indicator.minusDI);
                                                      return adxOk && diOk && adxVsDiOk ? 'text-red-400' : 'text-zinc-500';
                                                    })()
                                                  }`}>
                                                    {(() => {
                                                      const adxOk = indicator.adx > (indicator.adxThreshold || 25);
                                                      const diOk = indicator.minusDI > indicator.plusDI;
                                                      const adxVsDiOk = !indicator.adxVsDi || indicator.adxVsDi === 'none' ||
                                                        (indicator.adxVsDi === 'adx_lt_di_minus' && indicator.minusDI > indicator.adx) ||
                                                        (indicator.adxVsDi === 'adx_gt_di_minus' && indicator.adx > indicator.minusDI);
                                                      return adxOk && diOk && adxVsDiOk ? '✓ 충족' : '✗ 미충족';
                                                    })()}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ) : (
                                          // 기타 지표 정보 표시
                                          <div className="grid grid-cols-3 gap-2 text-xs">
                                            <div>
                                              <span className="text-zinc-600">계산값:</span>
                                              <div className={`font-mono ${isEvaluated ? 'text-cyan-300' : 'text-zinc-500'}`}>
                                                {isEvaluated ? indicator.value.toFixed(4) : '-'}
                                              </div>
                                            </div>
                                            <div>
                                              <span className="text-zinc-600">연산자:</span>
                                              <div className="font-mono text-yellow-300">
                                                {indicator.comparisonOperator || 'none'}
                                              </div>
                                            </div>
                                            <div>
                                              <span className="text-zinc-600">비교값:</span>
                                              <div className="font-mono text-purple-300">
                                                {indicator.comparisonValue || '-'}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-xs text-zinc-500 text-center py-4 bg-zinc-800/30 rounded">
                                  <div className="mb-1">📊 청산 조건 없음</div>
                                  <div className="text-zinc-600 text-xs">전략 설정에서 추가</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 주문 금액 설정 및 신호 - 별도 섹션 */}
                        <div className="mt-6">
                          <h3 className="text-sm font-semibold text-zinc-300 mb-3">주문 설정 및 신호</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-3">
                              {/* 금액 설정 */}
                              <div className="bg-zinc-800/30 rounded p-3 space-y-2">
                                <div className="flex justify-between text-xs">
                                  <span className="text-zinc-400">최초 매수</span>
                                  <span className="text-zinc-100 font-mono">${data.initialOrderAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-zinc-400">추가 매수</span>
                                  <span className="text-zinc-100 font-mono">${data.additionalOrderAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-zinc-400">매수 한도</span>
                                  <span className="text-zinc-100 font-mono">${data.maxOrderAmount.toFixed(2)}</span>
                                </div>
                                <div className="pt-2 border-t border-zinc-700">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-zinc-400">현재 투자</span>
                                    <span className="text-yellow-400 font-mono">${data.currentInvestment.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-xs mt-1">
                                    <span className="text-zinc-400">잔여 한도</span>
                                    <span className="text-blue-400 font-mono">
                                      ${(data.maxOrderAmount - data.currentInvestment).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* 신호 상태 */}
                              <div className="grid grid-cols-2 gap-2">
                                <div className={`text-center py-3 px-3 rounded ${
                                  data.longEntrySignal || data.shortEntrySignal
                                    ? data.longEntrySignal
                                      ? 'bg-emerald-500/20 border border-emerald-500/30'
                                      : 'bg-red-500/20 border border-red-500/30'
                                    : 'bg-zinc-800 border border-zinc-700'
                                }`}>
                                  <div className="text-xs text-zinc-400 mb-1">진입신호</div>
                                  <div className={`text-lg font-bold ${
                                    data.longEntrySignal ? 'text-emerald-300' :
                                    data.shortEntrySignal ? 'text-red-300' : 'text-zinc-500'
                                  }`}>
                                    {data.longEntrySignal ? '✓ 롱' :
                                     data.shortEntrySignal ? '✓ 숏' : '× OFF'}
                                  </div>
                                </div>
                                <div className={`text-center py-3 px-3 rounded ${
                                  data.exitSignal
                                    ? 'bg-red-500/20 border border-red-500/30'
                                    : 'bg-zinc-800 border border-zinc-700'
                                }`}>
                                  <div className="text-xs text-zinc-400 mb-1">청산신호</div>
                                  <div className={`text-lg font-bold ${
                                    data.exitSignal ? 'text-red-300' : 'text-zinc-500'
                                  }`}>
                                      {data.exitSignal ? '✓ ON' : '× OFF'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* 범례 */}
      <div className="mt-4 flex items-center gap-6 text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>진입/청산 신호 활성</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-zinc-600"></span>
          <span>신호 비활성</span>
        </div>
        <div className="flex items-center gap-2">
          <Info className="w-3 h-3" />
          <span>행을 클릭하면 상세 정보를 확인할 수 있습니다</span>
        </div>
      </div>
    </div>
  );
}