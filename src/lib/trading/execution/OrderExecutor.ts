/**
 * Order Executor
 *
 * Binance Futures API를 통해 실제 주문을 실행합니다.
 */

import { createBinanceFuturesClient } from '@/lib/trading/exchange';
import type { PositionDirection } from '@/types/trading/auto-trading';
import type { StrategySettings } from '@/types/trading/strategy';

export interface OrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  price?: number; // LIMIT 주문 시 필요
  reduceOnly?: boolean; // 포지션 청산 시 true
  positionSide?: 'LONG' | 'SHORT' | 'BOTH'; // Hedge mode
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  symbol: string;
  side: string;
  price: number;
  quantity: number;
  error?: string;
}

export interface PositionInfo {
  symbol: string;
  side: 'LONG' | 'SHORT';
  positionAmt: number;
  entryPrice: number;
  leverage: number;
  unrealizedProfit: number;
  liquidationPrice: number;
  marginType: 'cross' | 'isolated';
}

export class OrderExecutor {
  /**
   * 진입 주문 실행
   */
  async executeEntry(
    symbol: string,
    direction: PositionDirection,
    settings: StrategySettings,
    currentPrice: number,
    credentials: { apiKey: string; apiSecret: string }
  ): Promise<OrderResult> {
    try {
      console.log(`\n💼 Executing ENTRY order for ${symbol} (${direction})`);

      // 1. 주문 수량 계산
      const quantity = await this.calculateOrderQuantity(
        symbol,
        settings,
        currentPrice,
        credentials
      );

      if (quantity === 0) {
        return {
          success: false,
          symbol,
          side: direction === 'long' ? 'BUY' : 'SELL',
          price: currentPrice,
          quantity: 0,
          error: '주문 수량 계산 실패 (잔고 부족 또는 최소 주문 수량 미달)'
        };
      }

      // 2. 레버리지 설정
      await this.setLeverage(symbol, settings.leverage, credentials);

      // 3. 포지션 모드에 따라 주문 파라미터 설정
      const orderParams: OrderParams = {
        symbol,
        side: direction === 'long' ? 'BUY' : 'SELL',
        type: 'MARKET', // TODO: settings에 따라 LIMIT 주문도 지원
        quantity,
        positionSide: settings.positionMode === 'hedge'
          ? (direction === 'long' ? 'LONG' : 'SHORT')
          : 'BOTH'
      };

      // 4. 주문 실행
      const result = await this.placeOrder(orderParams, credentials);

      console.log(`✅ Entry order executed:`, result);

      return result;
    } catch (error) {
      console.error(`Failed to execute entry order:`, error);
      return {
        success: false,
        symbol,
        side: direction === 'long' ? 'BUY' : 'SELL',
        price: currentPrice,
        quantity: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 청산 주문 실행
   */
  async executeExit(
    symbol: string,
    direction: PositionDirection,
    settings: StrategySettings,
    credentials: { apiKey: string; apiSecret: string }
  ): Promise<OrderResult> {
    try {
      console.log(`\n💼 Executing EXIT order for ${symbol} (${direction})`);

      // 1. 현재 포지션 조회
      const position = await this.getPosition(symbol, direction, credentials);

      if (!position || position.positionAmt === 0) {
        return {
          success: false,
          symbol,
          side: direction === 'long' ? 'SELL' : 'BUY',
          price: 0,
          quantity: 0,
          error: '청산할 포지션이 없습니다'
        };
      }

      // 2. 청산 주문 파라미터 설정
      const orderParams: OrderParams = {
        symbol,
        side: direction === 'long' ? 'SELL' : 'BUY', // 포지션과 반대 방향
        type: 'MARKET',
        quantity: Math.abs(position.positionAmt),
        reduceOnly: true, // 포지션 청산만 (신규 포지션 진입 방지)
        positionSide: settings.positionMode === 'hedge'
          ? (direction === 'long' ? 'LONG' : 'SHORT')
          : 'BOTH'
      };

      // 3. 주문 실행
      const result = await this.placeOrder(orderParams, credentials);

      console.log(`✅ Exit order executed:`, result);

      return result;
    } catch (error) {
      console.error(`Failed to execute exit order:`, error);
      return {
        success: false,
        symbol,
        side: direction === 'long' ? 'SELL' : 'BUY',
        price: 0,
        quantity: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 주문 수량 계산
   */
  private async calculateOrderQuantity(
    symbol: string,
    settings: StrategySettings,
    currentPrice: number,
    credentials: { apiKey: string; apiSecret: string }
  ): Promise<number> {
    try {
      const client = createBinanceFuturesClient(credentials.apiKey, credentials.apiSecret);

      // 1. 계좌 잔고 조회
      const account = await client.futuresAccount();
      const usdtBalance = parseFloat(
        account.assets.find((a: any) => a.asset === 'USDT')?.availableBalance || '0'
      );

      console.log(`  Available USDT balance: ${usdtBalance.toFixed(2)}`);

      // 2. 초기 마진 계산
      let initialMargin = 0;

      if (settings.initialMarginMode === 'usdt_amount') {
        initialMargin = settings.initialMarginValue || 0;
      } else if (settings.initialMarginMode === 'per_symbol_percentage') {
        initialMargin = usdtBalance * (settings.initialMarginValue || 0) / 100;
      } else if (settings.initialMarginMode === 'all_symbols_percentage') {
        // 전체 심볼에 분산 투자
        const symbolCount = Array.isArray(settings.symbols) ? Math.max(settings.symbols.length, 1) : 1;
        initialMargin = usdtBalance * (settings.initialMarginValue || 0) / 100 / symbolCount;
      }

      console.log(`  Initial margin: ${initialMargin.toFixed(2)} USDT`);

      // 3. 레버리지 적용한 포지션 크기 계산
      const leverage = settings.leverage.mode === 'uniform'
        ? settings.leverage.value
        : (settings.leverage.custom?.[symbol] || settings.leverage.value);

      const notional = initialMargin * leverage;

      console.log(`  Leverage: ${leverage}x, Notional: ${notional.toFixed(2)} USDT`);

      // 4. 수량 계산 (가격으로 나누기)
      let quantity = notional / currentPrice;

      // 5. 심볼 정보 조회 (최소/최대 수량, 소수점 제한)
      const exchangeInfo = await client.futuresExchangeInfo();
      const symbolInfo = exchangeInfo.symbols.find((s: any) => s.symbol === symbol);

      if (!symbolInfo) {
        throw new Error(`Symbol ${symbol} not found in exchange info`);
      }

      // LOT_SIZE 필터에서 최소/최대/step size 가져오기
      const lotSizeFilter = symbolInfo.filters.find((f: any) => f.filterType === 'LOT_SIZE');
      const minQty = parseFloat(lotSizeFilter?.minQty || '0');
      const maxQty = parseFloat(lotSizeFilter?.maxQty || '1000000');
      const stepSize = parseFloat(lotSizeFilter?.stepSize || '1');

      // Step size에 맞춰 반올림
      quantity = Math.floor(quantity / stepSize) * stepSize;

      // 최소/최대 범위 체크
      if (quantity < minQty) {
        console.warn(`  Quantity ${quantity} is below minimum ${minQty}`);
        return 0;
      }

      if (quantity > maxQty) {
        console.warn(`  Quantity ${quantity} exceeds maximum ${maxQty}, using max`);
        quantity = maxQty;
      }

      console.log(`  Final quantity: ${quantity} ${symbol.replace('USDT', '')}`);

      return quantity;
    } catch (error) {
      console.error('Failed to calculate order quantity:', error);
      return 0;
    }
  }

  /**
   * 레버리지 설정
   */
  private async setLeverage(
    symbol: string,
    leverageSettings: StrategySettings['leverage'],
    credentials: { apiKey: string; apiSecret: string }
  ): Promise<void> {
    try {
      const client = createBinanceFuturesClient(credentials.apiKey, credentials.apiSecret);

      const leverage = leverageSettings.mode === 'uniform'
        ? leverageSettings.value
        : (leverageSettings.custom?.[symbol] || leverageSettings.value);

      await client.futuresLeverage(symbol, leverage);

      console.log(`  ✅ Leverage set to ${leverage}x for ${symbol}`);
    } catch (error) {
      // 레버리지 설정 실패해도 계속 진행 (이미 설정되어 있을 수 있음)
      console.warn(`  ⚠️ Failed to set leverage:`, error);
    }
  }

  /**
   * 주문 실행
   */
  private async placeOrder(
    params: OrderParams,
    credentials: { apiKey: string; apiSecret: string }
  ): Promise<OrderResult> {
    try {
      const client = createBinanceFuturesClient(credentials.apiKey, credentials.apiSecret);

      const orderRequest: any = {
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        quantity: params.quantity
      };

      if (params.type === 'LIMIT' && params.price) {
        orderRequest.price = params.price;
        orderRequest.timeInForce = 'GTC'; // Good Till Cancel
      }

      if (params.reduceOnly) {
        orderRequest.reduceOnly = true;
      }

      if (params.positionSide) {
        orderRequest.positionSide = params.positionSide;
      }

      console.log(`  📤 Placing order:`, orderRequest);

      const order = await client.futuresOrder(orderRequest);

      console.log(`  ✅ Order placed:`, order);

      return {
        success: true,
        orderId: order.orderId.toString(),
        symbol: order.symbol,
        side: order.side,
        price: parseFloat(order.avgPrice || order.price || '0'),
        quantity: parseFloat(order.executedQty || order.origQty || '0')
      };
    } catch (error) {
      console.error('Failed to place order:', error);
      throw error;
    }
  }

  /**
   * 포지션 조회
   */
  private async getPosition(
    symbol: string,
    direction: PositionDirection,
    credentials: { apiKey: string; apiSecret: string }
  ): Promise<PositionInfo | null> {
    try {
      const client = createBinanceFuturesClient(credentials.apiKey, credentials.apiSecret);

      const positions = await client.futuresPositionRisk({ symbol });

      // Hedge mode인 경우 direction에 맞는 포지션 찾기
      const position = positions.find((p: any) => {
        if (p.symbol !== symbol) return false;

        // One-way mode
        if (p.positionSide === 'BOTH') {
          return true;
        }

        // Hedge mode
        return p.positionSide === direction.toUpperCase();
      });

      if (!position) return null;

      return {
        symbol: position.symbol,
        side: position.positionSide === 'LONG' ? 'LONG' : 'SHORT',
        positionAmt: Math.abs(parseFloat(position.positionAmt)),
        entryPrice: parseFloat(position.entryPrice),
        leverage: parseInt(position.leverage),
        unrealizedProfit: parseFloat(position.unRealizedProfit),
        liquidationPrice: parseFloat(position.liquidationPrice),
        marginType: position.marginType.toLowerCase() as 'cross' | 'isolated'
      };
    } catch (error) {
      console.error('Failed to get position:', error);
      return null;
    }
  }

  /**
   * 모든 포지션 조회
   */
  async getAllPositions(
    credentials: { apiKey: string; apiSecret: string }
  ): Promise<PositionInfo[]> {
    try {
      const client = createBinanceFuturesClient(credentials.apiKey, credentials.apiSecret);

      const positions = await client.futuresPositionRisk();

      return positions
        .filter((p: any) => Math.abs(parseFloat(p.positionAmt)) > 0)
        .map((p: any) => ({
          symbol: p.symbol,
          side: parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT',
          positionAmt: Math.abs(parseFloat(p.positionAmt)),
          entryPrice: parseFloat(p.entryPrice),
          leverage: parseInt(p.leverage),
          unrealizedProfit: parseFloat(p.unRealizedProfit),
          liquidationPrice: parseFloat(p.liquidationPrice),
          marginType: p.marginType.toLowerCase() as 'cross' | 'isolated'
        }));
    } catch (error) {
      console.error('Failed to get all positions:', error);
      return [];
    }
  }
}

// Singleton instance
let executorInstance: OrderExecutor | null = null;

export function getOrderExecutor(): OrderExecutor {
  if (!executorInstance) {
    executorInstance = new OrderExecutor();
  }
  return executorInstance;
}
