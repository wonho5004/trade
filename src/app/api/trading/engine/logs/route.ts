/**
 * Engine Logs API
 *
 * ExecutionEngine의 실시간 로그를 조회합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, readAuthCookies } from '@/lib/supabase/server';
import { getAllLogs, getLogsSince, clearLogs, getLogStats } from '@/lib/trading/execution/logger';
import type { EngineLog } from '@/lib/trading/execution/logger';

/**
 * GET /api/trading/engine/logs
 *
 * 엔진 로그 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 인증 확인
    const { token } = await readAuthCookies();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseServerClient('service');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. 쿼리 파라미터 추출
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since'); // 타임스탬프 이후의 로그만 가져오기
    const limit = parseInt(searchParams.get('limit') || '100');
    const level = searchParams.get('level'); // 'all', 'debug', 'info', 'warning', 'error'

    // 3. 로그 조회 및 필터링
    let logs: EngineLog[];

    if (since) {
      const sinceTimestamp = parseInt(since);
      logs = getLogsSince(sinceTimestamp);
    } else {
      logs = getAllLogs();
    }

    if (level && level !== 'all') {
      logs = logs.filter(log => log.level === level);
    }

    // 4. 최신 로그부터 반환 (최대 limit개)
    const logsToReturn = logs.slice(-limit);
    const stats = getLogStats();

    return NextResponse.json({
      logs: logsToReturn,
      total: stats.total,
      filtered: logs.length,
      stats
    });

  } catch (error) {
    console.error('Failed to fetch engine logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch engine logs' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/trading/engine/logs
 *
 * 모든 로그 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. 인증 확인
    const { token } = await readAuthCookies();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseServerClient('service');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. 로그 초기화
    clearLogs();

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Failed to clear engine logs:', error);
    return NextResponse.json(
      { error: 'Failed to clear engine logs' },
      { status: 500 }
    );
  }
}
