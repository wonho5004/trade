/**
 * PnL Tracking API
 * GET /api/monitoring/pnl - Get total PnL summary
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient, readAuthCookies } from '@/lib/supabase/server';

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

    // Get total unrealized PnL from open positions
    const { data: openPositions } = await supabase
      .from('positions')
      .select('unrealized_pnl')
      .eq('user_id', userId)
      .eq('status', 'OPEN');

    const totalUnrealized = openPositions?.reduce((sum, pos) => sum + (pos.unrealized_pnl || 0), 0) || 0;

    // Get total realized PnL from closed positions
    const { data: closedPositions } = await supabase
      .from('positions')
      .select('realized_pnl')
      .eq('user_id', userId)
      .eq('status', 'CLOSED');

    const totalRealized = closedPositions?.reduce((sum, pos) => sum + (pos.realized_pnl || 0), 0) || 0;

    return NextResponse.json({
      success: true,
      totalUnrealized,
      totalRealized,
      totalPnL: totalUnrealized + totalRealized
    });
  } catch (e) {
    console.error('Unexpected error in GET /api/monitoring/pnl:', e);
    return errorJson(500, 'INTERNAL', '서버 오류가 발생했습니다.');
  }
}
