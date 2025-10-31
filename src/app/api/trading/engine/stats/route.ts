/**
 * 실행 엔진 통계 API
 */

import { NextResponse, NextRequest } from 'next/server';
import { readAuthCookies, createSupabaseServerClient } from '@/lib/supabase/server';
import { getExecutionEngine } from '@/lib/trading/execution/ExecutionEngine';

export async function GET(request: NextRequest) {
  try {
    // 인증 확인 - 쿠키 또는 Authorization 헤더에서 토큰 확인
    let token = null;

    // 먼저 쿠키에서 확인
    const cookieAuth = await readAuthCookies();
    if (cookieAuth.token) {
      token = cookieAuth.token;
    }

    // 쿠키에 없으면 Authorization 헤더에서 확인
    if (!token) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseServerClient('service');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userData?.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const engine = getExecutionEngine();
    const engineStatus = engine.getStatus();

    // DB에서 추가 통계 조회
    const { data: evaluations, error: evalError } = await supabase
      .from('condition_evaluations')
      .select('id, created_at, result, evaluation_time_ms')
      .eq('user_id', userData.user.id)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    const { data: trades, error: tradeError } = await supabase
      .from('trades')
      .select('id, status')
      .eq('user_id', userData.user.id)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const { data: positions } = await supabase
      .from('positions')
      .select('id')
      .eq('user_id', userData.user.id)
      .eq('status', 'open');

    // 통계 계산
    const totalEvaluations = evaluations?.length || 0;
    const successfulEvaluations = evaluations?.filter(e => e.result === true).length || 0;
    const avgEvaluationTime = totalEvaluations > 0
      ? evaluations!.reduce((sum, e) => sum + (e.evaluation_time_ms || 0), 0) / totalEvaluations
      : 0;

    const successfulOrders = trades?.filter(t => t.status === 'filled').length || 0;
    const failedOrders = trades?.filter(t => t.status === 'rejected' || t.status === 'error').length || 0;

    // 엔진 가동 시간 계산
    const engineUptime = engineStatus.isRunning && engineStatus.startTime
      ? Math.floor((Date.now() - engineStatus.startTime) / 1000)
      : 0;

    // 최근 평가 시간
    const lastEvaluation = evaluations && evaluations.length > 0
      ? new Date(evaluations[0].created_at).getTime()
      : null;

    return NextResponse.json({
      totalEvaluations,
      successfulEvaluations,
      successRate: totalEvaluations > 0
        ? (successfulEvaluations / totalEvaluations * 100).toFixed(1)
        : 0,
      avgEvaluationTime: Math.round(avgEvaluationTime),
      successfulOrders,
      failedOrders,
      activePositions: positions?.length || 0,
      lastEvaluation,
      engineUptime,
      engineStatus: {
        isRunning: engineStatus.isRunning,
        mode: engineStatus.mode,
        startTime: engineStatus.startTime
      }
    });
  } catch (error) {
    console.error('통계 조회 오류:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}