/**
 * Position Close API
 * POST /api/monitoring/positions/[id]/close - Close a position
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient, readAuthCookies } from '@/lib/supabase/server';

function errorJson(status: number, code: string, message: string) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { token } = await readAuthCookies();
    if (!token) return errorJson(401, 'UNAUTHORIZED', '로그인이 필요합니다.');

    const supabase = createSupabaseServerClient('service');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return errorJson(401, 'UNAUTHORIZED', '인증이 유효하지 않습니다.');
    }

    const userId = userData.user.id;
    const positionId = params.id;

    // Check if position exists and belongs to user
    const { data: position } = await supabase
      .from('positions')
      .select('id, status')
      .eq('id', positionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!position) {
      return errorJson(404, 'NOT_FOUND', '포지션을 찾을 수 없습니다.');
    }

    if (position.status === 'CLOSED') {
      return errorJson(400, 'ALREADY_CLOSED', '이미 청산된 포지션입니다.');
    }

    // Update position to closed
    // TODO: Integrate with actual order execution
    const { error: updateError } = await supabase
      .from('positions')
      .update({
        status: 'CLOSED',
        closed_at: new Date().toISOString()
      })
      .eq('id', positionId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Failed to close position:', updateError);
      return errorJson(500, 'DATABASE_ERROR', '포지션 청산에 실패했습니다.');
    }

    return NextResponse.json({
      success: true,
      message: '포지션이 청산되었습니다.'
    });
  } catch (e) {
    console.error('Unexpected error in POST /api/monitoring/positions/[id]/close:', e);
    return errorJson(500, 'INTERNAL', '서버 오류가 발생했습니다.');
  }
}
