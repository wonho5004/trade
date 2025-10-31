/**
 * Position Tracker
 *
 * 포지션을 추적하고 데이터베이스에 저장합니다.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Position } from '@/types/trading/monitoring';
import type { PositionDirection } from '@/types/trading/auto-trading';
import type { OrderResult } from './OrderExecutor';

export interface TrackingPosition {
  id: string;
  strategyId: string;
  symbol: string;
  direction: PositionDirection;
  entryPrice: number;
  quantity: number;
  leverage: number;
  entryTime: string;
  entryOrderId?: string;
  exitOrderId?: string;
  exitPrice?: number;
  exitTime?: string;
  unrealizedPnl: number;
  realizedPnl?: number;
  status: 'open' | 'closed';
}

export class PositionTracker {
  /**
   * 진입 포지션 기록
   */
  async trackEntry(
    strategyId: string,
    symbol: string,
    direction: PositionDirection,
    orderResult: OrderResult,
    leverage: number
  ): Promise<TrackingPosition | null> {
    try {
      const supabase = createSupabaseServerClient('service');

      // TODO: user_id를 실제 사용자로부터 가져와야 함
      // 임시로 첫 번째 사용자 사용
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (!userId) {
        console.error('No user ID available for position tracking');
        return null;
      }

      const position = {
        user_id: userId,
        strategy_id: strategyId,
        symbol,
        side: direction.toUpperCase(), // LONG or SHORT
        direction: direction.toLowerCase(), // long or short
        entry_price: orderResult.price,
        current_price: orderResult.price,
        quantity: orderResult.quantity,
        leverage,
        entry_time: new Date().toISOString(),
        entry_order_id: orderResult.orderId,
        unrealized_pnl: 0,
        status: 'OPEN'
      };

      const { data, error } = await supabase
        .from('positions')
        .insert(position)
        .select()
        .single();

      if (error) {
        console.error('Failed to track entry position:', error);
        return null;
      }

      console.log(`✅ Position tracked in DB:`, data.id);

      return {
        id: data.id,
        strategyId: data.strategy_id,
        symbol: data.symbol,
        direction: data.direction,
        entryPrice: data.entry_price,
        quantity: data.quantity,
        leverage: data.leverage,
        entryTime: data.entry_time,
        entryOrderId: data.entry_order_id,
        unrealizedPnl: data.unrealized_pnl || 0,
        status: 'open'
      };
    } catch (error) {
      console.error('Failed to track entry position:', error);
      return null;
    }
  }

  /**
   * 청산 포지션 기록
   */
  async trackExit(
    positionId: string,
    orderResult: OrderResult,
    currentPrice: number
  ): Promise<TrackingPosition | null> {
    try {
      const supabase = createSupabaseServerClient('service');

      // 1. 기존 포지션 조회
      const { data: position, error: fetchError } = await supabase
        .from('positions')
        .select('*')
        .eq('id', positionId)
        .single();

      if (fetchError || !position) {
        console.error('Failed to fetch position for exit:', fetchError);
        return null;
      }

      // 2. 실현 손익 계산
      const entryPrice = position.entry_price;
      const quantity = position.quantity;
      const direction = position.direction;

      const realizedPnl = direction === 'long'
        ? (currentPrice - entryPrice) * quantity
        : (entryPrice - currentPrice) * quantity;

      // 3. 포지션 업데이트
      const { data, error } = await supabase
        .from('positions')
        .update({
          exit_order_id: orderResult.orderId,
          exit_price: orderResult.price,
          exit_time: new Date().toISOString(),
          closed_at: new Date().toISOString(),
          current_price: currentPrice,
          realized_pnl: realizedPnl,
          status: 'CLOSED'
        })
        .eq('id', positionId)
        .select()
        .single();

      if (error) {
        console.error('Failed to track exit position:', error);
        return null;
      }

      console.log(`✅ Position exit tracked in DB:`, data.id, `PnL: ${realizedPnl.toFixed(2)} USDT`);

      return {
        id: data.id,
        strategyId: data.strategy_id,
        symbol: data.symbol,
        direction: data.direction,
        entryPrice: data.entry_price,
        quantity: data.quantity,
        leverage: data.leverage,
        entryTime: data.entry_time,
        entryOrderId: data.entry_order_id,
        exitOrderId: data.exit_order_id,
        exitPrice: data.exit_price,
        exitTime: data.exit_time,
        unrealizedPnl: 0,
        realizedPnl: data.realized_pnl,
        status: 'closed'
      };
    } catch (error) {
      console.error('Failed to track exit position:', error);
      return null;
    }
  }

  /**
   * 미실현 손익 업데이트
   */
  async updateUnrealizedPnl(
    positionId: string,
    currentPrice: number
  ): Promise<void> {
    try {
      const supabase = createSupabaseServerClient('service');

      // 1. 포지션 조회
      const { data: position, error: fetchError } = await supabase
        .from('positions')
        .select('*')
        .eq('id', positionId)
        .eq('status', 'open')
        .single();

      if (fetchError || !position) return;

      // 2. 미실현 손익 계산
      const entryPrice = position.entry_price;
      const quantity = position.quantity;
      const direction = position.direction;

      const unrealizedPnl = direction === 'long'
        ? (currentPrice - entryPrice) * quantity
        : (entryPrice - currentPrice) * quantity;

      // 3. 업데이트
      await supabase
        .from('positions')
        .update({ unrealized_pnl: unrealizedPnl })
        .eq('id', positionId);
    } catch (error) {
      console.error('Failed to update unrealized PnL:', error);
    }
  }

  /**
   * 오픈 포지션 조회
   */
  async getOpenPositions(strategyId?: string): Promise<TrackingPosition[]> {
    try {
      const supabase = createSupabaseServerClient('service');

      let query = supabase
        .from('positions')
        .select('*')
        .eq('status', 'OPEN');

      if (strategyId) {
        query = query.eq('strategy_id', strategyId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to get open positions:', error);
        return [];
      }

      return (data || []).map((p: any) => ({
        id: p.id,
        strategyId: p.strategy_id,
        symbol: p.symbol,
        direction: p.direction || p.side.toLowerCase(),
        entryPrice: p.entry_price,
        quantity: p.quantity,
        leverage: p.leverage,
        entryTime: p.entry_time || p.opened_at,
        entryOrderId: p.entry_order_id,
        unrealizedPnl: p.unrealized_pnl || 0,
        status: 'open'
      }));
    } catch (error) {
      console.error('Failed to get open positions:', error);
      return [];
    }
  }

  /**
   * 심볼별 오픈 포지션 조회
   */
  async getOpenPositionBySymbol(
    symbol: string,
    direction: PositionDirection
  ): Promise<TrackingPosition | null> {
    try {
      const supabase = createSupabaseServerClient('service');

      const { data, error } = await supabase
        .from('positions')
        .select('*')
        .eq('symbol', symbol)
        .eq('direction', direction.toLowerCase())
        .eq('status', 'OPEN')
        .order('entry_time', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return null;

      return {
        id: data.id,
        strategyId: data.strategy_id,
        symbol: data.symbol,
        direction: data.direction || data.side.toLowerCase(),
        entryPrice: data.entry_price,
        quantity: data.quantity,
        leverage: data.leverage,
        entryTime: data.entry_time || data.opened_at,
        entryOrderId: data.entry_order_id,
        unrealizedPnl: data.unrealized_pnl || 0,
        status: 'open'
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * 거래 이력 기록
   */
  async recordTrade(
    strategyId: string,
    positionId: string,
    symbol: string,
    side: 'entry' | 'exit',
    orderResult: OrderResult
  ): Promise<void> {
    try {
      const supabase = createSupabaseServerClient('service');

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (!userId) {
        console.warn('No user ID for trade recording');
        return;
      }

      const action = side === 'entry'
        ? (orderResult.side === 'BUY' ? 'ENTRY_LONG' : 'ENTRY_SHORT')
        : 'EXIT';

      const trade = {
        user_id: userId,
        strategy_id: strategyId,
        symbol,
        action,
        price: orderResult.price,
        quantity: orderResult.quantity,
        order_id: orderResult.orderId,
        status: 'FILLED' // Assuming order was filled successfully
      };

      await supabase.from('trading_logs').insert(trade);

      console.log(`✅ Trade recorded:`, action, symbol);
    } catch (error) {
      console.error('Failed to record trade:', error);
    }
  }

  /**
   * 전략별 통계 조회
   */
  async getStrategyStats(strategyId: string): Promise<{
    totalTrades: number;
    winTrades: number;
    lossTrades: number;
    totalPnl: number;
    winRate: number;
  }> {
    try {
      const supabase = createSupabaseServerClient('service');

      const { data, error } = await supabase
        .from('positions')
        .select('realized_pnl')
        .eq('strategy_id', strategyId)
        .eq('status', 'CLOSED');

      if (error || !data) {
        return {
          totalTrades: 0,
          winTrades: 0,
          lossTrades: 0,
          totalPnl: 0,
          winRate: 0
        };
      }

      const totalTrades = data.length;
      const winTrades = data.filter((p: any) => (p.realized_pnl || 0) > 0).length;
      const lossTrades = data.filter((p: any) => (p.realized_pnl || 0) < 0).length;
      const totalPnl = data.reduce((sum: number, p: any) => sum + (p.realized_pnl || 0), 0);
      const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;

      return {
        totalTrades,
        winTrades,
        lossTrades,
        totalPnl,
        winRate
      };
    } catch (error) {
      console.error('Failed to get strategy stats:', error);
      return {
        totalTrades: 0,
        winTrades: 0,
        lossTrades: 0,
        totalPnl: 0,
        winRate: 0
      };
    }
  }
}

// Singleton instance
let trackerInstance: PositionTracker | null = null;

export function getPositionTracker(): PositionTracker {
  if (!trackerInstance) {
    trackerInstance = new PositionTracker();
  }
  return trackerInstance;
}
