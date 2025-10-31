/**
 * Condition Evaluations API
 * GET /api/monitoring/condition-evaluations - Get recent condition evaluations
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
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const symbol = searchParams.get('symbol'); // 심볼 필터 추가

    // Build query
    let query = supabase
      .from('condition_evaluations')
      .select('*')
      .eq('user_id', userId);

    // Apply symbol filter if provided
    if (symbol) {
      query = query.eq('symbol', symbol);
    }

    // Fetch recent condition evaluations with correct field names
    const { data: evaluations, error: dbError } = await query
      .order('evaluated_at', { ascending: false })
      .limit(Math.min(limit, 100));

    if (dbError) {
      console.error('Failed to fetch condition evaluations:', dbError);
      return errorJson(500, 'DATABASE_ERROR', '조건 평가 내역 조회에 실패했습니다.');
    }

    // 디버그: 첫 번째 평가 데이터 로그
    if (evaluations && evaluations.length > 0) {
      console.log('[API DEBUG] First evaluation for', symbol || 'all', ':', {
        symbol: evaluations[0].symbol,
        type: evaluations[0].condition_type,
        result: evaluations[0].evaluation_result,
        hasDetails: !!evaluations[0].details,
        hasIndicatorDetails: !!evaluations[0].details?.indicatorDetails,
        indicatorDetailsLength: evaluations[0].details?.indicatorDetails?.length,
        indicatorDetailsFirst: evaluations[0].details?.indicatorDetails?.[0]
      });
    } else {
      console.log('[API DEBUG] No evaluations found for', symbol || 'all');
    }

    // Get count of active strategies
    const { data: activeStrategies } = await supabase
      .from('strategies')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true);

    return NextResponse.json({
      success: true,
      evaluations: evaluations ?? [],
      activeStrategies: activeStrategies?.length || 0
    });
  } catch (e) {
    console.error('Unexpected error in GET /api/monitoring/condition-evaluations:', e);
    return errorJson(500, 'INTERNAL', '서버 오류가 발생했습니다.');
  }
}
