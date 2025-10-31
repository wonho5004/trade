/**
 * Trade History API
 * GET /api/monitoring/trades - Get trade history
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient, readAuthCookies } from '@/lib/supabase/server';

function errorJson(status: number, code: string, message: string) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}

export async function GET(request: Request) {
  try {
    const { token } = await readAuthCookies();
    if (!token) return errorJson(401, 'UNAUTHORIZED', '로그인이 필요합니다.');

    const supabase = createSupabaseServerClient('service');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return errorJson(401, 'UNAUTHORIZED', '인증이 유효하지 않습니다.');
    }

    const userId = userData.user.id;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Build query
    let query = supabase
      .from('recent_trading_activity')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100));

    if (action && action !== 'ALL') {
      query = query.eq('action', action);
    }

    if (status && status !== 'ALL') {
      query = query.eq('status', status);
    }

    const { data: trades, error: dbError } = await query;

    if (dbError) {
      console.error('Failed to fetch trades:', dbError);
      return errorJson(500, 'DATABASE_ERROR', '거래 내역 조회에 실패했습니다.');
    }

    return NextResponse.json({
      success: true,
      trades: trades ?? []
    });
  } catch (e) {
    console.error('Unexpected error in GET /api/monitoring/trades:', e);
    return errorJson(500, 'INTERNAL', '서버 오류가 발생했습니다.');
  }
}
