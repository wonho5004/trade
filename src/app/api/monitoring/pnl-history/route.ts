/**
 * PnL History API
 *
 * 시계열 손익 데이터를 제공합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, readAuthCookies } from '@/lib/supabase/server';

function errorJson(status: number, code: string, message: string) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const { token } = await readAuthCookies();
    if (!token) return errorJson(401, 'UNAUTHORIZED', '로그인이 필요합니다.');

    const supabase = createSupabaseServerClient('service');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return errorJson(401, 'UNAUTHORIZED', '인증이 유효하지 않습니다.');
    }

    const user = userData.user;

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '24h'; // 24h, 7d, 30d
    const strategyId = searchParams.get('strategyId');

    // Calculate time range
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Query closed positions for realized PnL
    let query = supabase
      .from('positions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'CLOSED')
      .gte('closed_at', startDate.toISOString())
      .order('closed_at', { ascending: true });

    if (strategyId) {
      query = query.eq('strategy_id', strategyId);
    }

    const { data: closedPositions, error: positionsError } = await query;

    if (positionsError) {
      console.error('Failed to fetch closed positions:', positionsError);
      return errorJson(500, 'DATABASE_ERROR', '포지션 조회에 실패했습니다.');
    }

    // Build cumulative PnL timeline
    const timeline: { time: string; realizedPnl: number; cumulativePnl: number }[] = [];
    let cumulativePnl = 0;

    // Get initial balance (cumulative PnL before start date)
    const { data: previousPositions } = await supabase
      .from('positions')
      .select('realized_pnl')
      .eq('user_id', user.id)
      .eq('status', 'CLOSED')
      .lt('closed_at', startDate.toISOString());

    if (previousPositions) {
      cumulativePnl = previousPositions.reduce((sum, p) => sum + (p.realized_pnl || 0), 0);
    }

    // Add starting point
    timeline.push({
      time: startDate.toISOString(),
      realizedPnl: 0,
      cumulativePnl
    });

    // Add each closed position
    (closedPositions || []).forEach((position: any) => {
      const pnl = position.realized_pnl || 0;
      cumulativePnl += pnl;

      timeline.push({
        time: position.closed_at,
        realizedPnl: pnl,
        cumulativePnl
      });
    });

    // Add current point
    timeline.push({
      time: now.toISOString(),
      realizedPnl: 0,
      cumulativePnl
    });

    // Calculate stats
    const totalTrades = closedPositions?.length || 0;
    const winningTrades = closedPositions?.filter((p: any) => (p.realized_pnl || 0) > 0).length || 0;
    const losingTrades = closedPositions?.filter((p: any) => (p.realized_pnl || 0) < 0).length || 0;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const avgWin = winningTrades > 0
      ? closedPositions!.filter((p: any) => (p.realized_pnl || 0) > 0)
          .reduce((sum, p) => sum + (p.realized_pnl || 0), 0) / winningTrades
      : 0;

    const avgLoss = losingTrades > 0
      ? Math.abs(closedPositions!.filter((p: any) => (p.realized_pnl || 0) < 0)
          .reduce((sum, p) => sum + (p.realized_pnl || 0), 0)) / losingTrades
      : 0;

    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;

    const totalPnl = closedPositions?.reduce((sum, p) => sum + (p.realized_pnl || 0), 0) || 0;

    return NextResponse.json({
      timeline,
      stats: {
        totalTrades,
        winningTrades,
        losingTrades,
        winRate,
        avgWin,
        avgLoss,
        profitFactor,
        totalPnl,
        period
      }
    });
  } catch (error) {
    console.error('PnL history API error:', error);
    return errorJson(500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다.');
  }
}
