/**
 * Positions Monitoring API
 * GET /api/monitoring/positions - Get active positions
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient, readAuthCookies } from '@/lib/supabase/server';
import { getExecutionEngine } from '@/lib/trading/execution/ExecutionEngine';

function errorJson(status: number, code: string, message: string) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}

export async function GET() {
  try {
    const { token } = await readAuthCookies();
    if (!token) return errorJson(401, 'UNAUTHORIZED', '로그인이 필요합니다.');

    const supabase = createSupabaseServerClient('service');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return errorJson(401, 'UNAUTHORIZED', '인증이 유효하지 않습니다.');
    }

    const userId = userData.user.id;

    // Check if engine is running in simulation mode
    const engine = getExecutionEngine();
    const engineStatus = await engine.getStatus();

    if (engineStatus.isRunning && engineStatus.mode === 'simulation') {
      // Return virtual positions from ExecutionEngine
      const virtualPositions = engine.getVirtualPositions().map(pos => ({
        ...pos,
        user_id: userId
      }));

      return NextResponse.json({
        success: true,
        positions: virtualPositions,
        mode: 'simulation'
      });
    }

    // Fetch real positions from database
    const { data: positions, error: dbError } = await supabase
      .from('active_positions_summary')
      .select('*')
      .eq('user_id', userId)
      .order('opened_at', { ascending: false });

    if (dbError) {
      console.error('Failed to fetch positions:', dbError);
      return errorJson(500, 'DATABASE_ERROR', '포지션 조회에 실패했습니다.');
    }

    return NextResponse.json({
      success: true,
      positions: positions ?? [],
      mode: engineStatus.mode
    });
  } catch (e) {
    console.error('Unexpected error in GET /api/monitoring/positions:', e);
    return errorJson(500, 'INTERNAL', '서버 오류가 발생했습니다.');
  }
}
