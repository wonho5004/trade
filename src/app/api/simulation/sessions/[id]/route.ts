/**
 * Simulation Session Detail API
 *
 * GET /api/simulation/sessions/[id] - 시뮬레이션 세션 상세 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, readAuthCookies } from '@/lib/supabase/server';

function errorJson(status: number, code: string, message: string) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/simulation/sessions/[id]
 * 시뮬레이션 세션 상세 조회 (거래 내역, 종목별 결과, 에러 로그 포함)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // 1. 인증 확인
    const { token } = await readAuthCookies();
    if (!token) return errorJson(401, 'UNAUTHORIZED', '로그인이 필요합니다.');

    const supabase = createSupabaseServerClient('service');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return errorJson(401, 'UNAUTHORIZED', '인증이 유효하지 않습니다.');
    }

    const sessionId = params.id;

    // 2. 세션 정보 조회
    const { data: session, error: sessionError } = await supabase
      .from('simulation_sessions')
      .select(`
        *,
        strategies:strategy_id (
          name
        )
      `)
      .eq('id', sessionId)
      .eq('user_id', userData.user.id)
      .single();

    if (sessionError || !session) {
      return errorJson(404, 'NOT_FOUND', '시뮬레이션 세션을 찾을 수 없습니다.');
    }

    // 3. 거래 내역 조회
    const { data: trades, error: tradesError } = await supabase
      .from('simulation_trades')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (tradesError) {
      console.error('Failed to fetch trades:', tradesError);
    }

    // 4. 종목별 결과 조회
    const { data: symbolResults, error: symbolError } = await supabase
      .from('simulation_symbol_results')
      .select('*')
      .eq('session_id', sessionId)
      .order('total_pnl', { ascending: false });

    if (symbolError) {
      console.error('Failed to fetch symbol results:', symbolError);
    }

    // 5. 에러 로그 조회
    const { data: errors, error: errorsError } = await supabase
      .from('simulation_errors')
      .select('*')
      .eq('session_id', sessionId)
      .order('occurred_at', { ascending: false });

    if (errorsError) {
      console.error('Failed to fetch errors:', errorsError);
    }

    // 6. 응답 포맷팅
    const durationMs = session.completed_at
      ? new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()
      : Date.now() - new Date(session.started_at).getTime();
    const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
    const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        name: session.name,
        description: session.description,
        strategyName: (session.strategies as any)?.name || 'Unknown',
        initialCapital: session.initial_capital,
        currentCapital: session.current_capital,
        totalPnL: session.total_pnl,
        roi: session.roi,
        totalTrades: session.total_trades,
        winningTrades: session.winning_trades,
        losingTrades: session.losing_trades,
        winRate: session.win_rate,
        dailyAvgRoi: session.daily_avg_roi,
        maxDrawdown: session.max_drawdown,
        sharpeRatio: session.sharpe_ratio,
        status: session.status,
        mode: session.mode,
        startedAt: session.started_at,
        completedAt: session.completed_at,
        durationHours,
        durationMinutes,
        planDurationHours: session.duration_hours
      },
      trades: trades?.map(trade => ({
        id: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        action: trade.action,
        entryPrice: trade.entry_price,
        exitPrice: trade.exit_price,
        quantity: trade.quantity,
        pnl: trade.pnl,
        pnlPercentage: trade.pnl_percentage,
        holdingTimeMinutes: trade.holding_time_minutes,
        entryReason: trade.entry_reason,
        exitReason: trade.exit_reason,
        indicators: trade.indicators,
        entryTime: trade.entry_time,
        exitTime: trade.exit_time,
        createdAt: trade.created_at
      })) || [],
      symbolResults: symbolResults?.map(result => ({
        symbol: result.symbol,
        totalTrades: result.total_trades,
        winningTrades: result.winning_trades,
        losingTrades: result.losing_trades,
        winRate: result.win_rate,
        totalPnL: result.total_pnl,
        roi: result.roi
      })) || [],
      errors: errors?.map(error => ({
        id: error.id,
        errorType: error.error_type,
        errorMessage: error.error_message,
        errorDetails: error.error_details,
        symbol: error.symbol,
        occurredAt: error.occurred_at
      })) || []
    });

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error('[Simulation Session Detail API] Unexpected error:', errorMessage);
    return errorJson(500, 'INTERNAL', `서버 오류: ${errorMessage}`);
  }
}
