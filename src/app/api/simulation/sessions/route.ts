/**
 * Simulation Sessions API
 *
 * GET /api/simulation/sessions - 시뮬레이션 세션 목록 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, readAuthCookies } from '@/lib/supabase/server';

function errorJson(status: number, code: string, message: string) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}

/**
 * GET /api/simulation/sessions
 * 시뮬레이션 세션 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 인증 확인
    const { token } = await readAuthCookies();
    if (!token) return errorJson(401, 'UNAUTHORIZED', '로그인이 필요합니다.');

    const supabase = createSupabaseServerClient('service');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return errorJson(401, 'UNAUTHORIZED', '인증이 유효하지 않습니다.');
    }

    // 2. 쿼리 파라미터
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'RUNNING', 'COMPLETED', 'STOPPED'
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 3. 세션 목록 조회
    let query = supabase
      .from('simulation_sessions')
      .select(`
        id,
        user_id,
        strategy_id,
        name,
        description,
        initial_capital,
        current_capital,
        duration_hours,
        status,
        mode,
        total_pnl,
        total_trades,
        winning_trades,
        losing_trades,
        win_rate,
        roi,
        max_drawdown,
        sharpe_ratio,
        daily_avg_roi,
        started_at,
        completed_at,
        created_at,
        strategies:strategy_id (
          name
        )
      `)
      .eq('user_id', userData.user.id)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: sessions, error: sessionsError } = await query;

    if (sessionsError) {
      console.error('Failed to fetch simulation sessions:', sessionsError);
      return errorJson(500, 'FETCH_ERROR', '시뮬레이션 세션 조회 실패');
    }

    // 4. 응답 포맷팅
    const formattedSessions = sessions?.map(session => {
      const durationMs = session.completed_at
        ? new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()
        : Date.now() - new Date(session.started_at).getTime();
      const durationHours = Math.floor(durationMs / (1000 * 60 * 60));

      return {
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
        planDurationHours: session.duration_hours
      };
    });

    return NextResponse.json({
      success: true,
      sessions: formattedSessions,
      total: formattedSessions?.length || 0
    });

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error('[Simulation Sessions API] Unexpected error:', errorMessage);
    return errorJson(500, 'INTERNAL', `서버 오류: ${errorMessage}`);
  }
}
