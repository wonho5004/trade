/**
 * Trading Engine Control API
 *
 * GET /api/trading/engine - Get engine status
 * POST /api/trading/engine - Control engine (start/stop)
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

/**
 * GET /api/trading/engine
 * Returns execution engine status
 */
export async function GET() {
  try {
    const { token } = await readAuthCookies();
    if (!token) return errorJson(401, 'UNAUTHORIZED', '로그인이 필요합니다.');

    const supabase = createSupabaseServerClient('service');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return errorJson(401, 'UNAUTHORIZED', '인증이 유효하지 않습니다.');
    }

    // Get actual engine status
    const engine = getExecutionEngine();
    engine.setUserId(userData.user.id);
    const status = await engine.getStatus();

    return NextResponse.json({
      success: true,
      status
    });
  } catch (e) {
    console.error('Unexpected error in GET /api/trading/engine:', e);
    return errorJson(500, 'INTERNAL', '서버 오류가 발생했습니다.');
  }
}

/**
 * POST /api/trading/engine
 * Start or stop the execution engine
 */
export async function POST(request: Request) {
  try {
    const { token } = await readAuthCookies();
    if (!token) return errorJson(401, 'UNAUTHORIZED', '로그인이 필요합니다.');

    const supabase = createSupabaseServerClient('service');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return errorJson(401, 'UNAUTHORIZED', '인증이 유효하지 않습니다.');
    }

    // Check user role - only admin and sys_admin can control the engine
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single();

    const role = profile?.role || 'user';
    if (role !== 'admin' && role !== 'sys_admin') {
      return errorJson(403, 'FORBIDDEN', '권한이 없습니다. 관리자만 엔진을 제어할 수 있습니다.');
    }

    // Parse request body
    const body = await request.json();
    const action = body.action; // 'start', 'stop', 'enable-trading', or 'force-evaluation'
    const mode = body.mode as 'monitoring' | 'simulation' | 'trading' | undefined; // for 'start' action
    const simulationCapital = body.simulationCapital as number | undefined; // for simulation mode
    const durationHours = body.durationHours as number | undefined; // for simulation mode

    if (!action || !['start', 'stop', 'enable-trading', 'force-evaluation'].includes(action)) {
      return errorJson(400, 'INVALID_ACTION', 'action은 "start", "stop", "enable-trading", 또는 "force-evaluation"이어야 합니다.');
    }

    console.log(`[Engine API] Action requested: ${action} by user ${userData.user.email}`);

    // Get engine instance
    const engine = getExecutionEngine();

    // Set user ID for database operations
    engine.setUserId(userData.user.id);
    console.log(`[Engine API] Setting user ID: ${userData.user.id} for action: ${action}`);

    if (action === 'start') {
      // Validate mode parameter
      const startMode = mode || 'monitoring'; // Default to monitoring mode
      if (startMode !== 'monitoring' && startMode !== 'simulation' && startMode !== 'trading') {
        return errorJson(400, 'INVALID_MODE', 'mode는 "monitoring", "simulation", 또는 "trading"이어야 합니다.');
      }

      // Validate simulation capital if simulation mode
      if (startMode === 'simulation' && (!simulationCapital || simulationCapital <= 0)) {
        return errorJson(400, 'INVALID_CAPITAL', '시뮬레이션 모드는 초기 자본금이 필요합니다.');
      }

      console.log(`[Engine API] Starting execution engine in ${startMode} mode...`);
      await engine.start(startMode, simulationCapital, durationHours);
      const status = await engine.getStatus();

      const modeText = startMode === 'monitoring' ? '모니터링 모드' : startMode === 'simulation' ? '시뮬레이션 모드' : '실시간 거래 모드';

      return NextResponse.json({
        success: true,
        message: `실행 엔진이 시작되었습니다 (${modeText}).`,
        status
      });
    } else if (action === 'enable-trading') {
      console.log('[Engine API] Enabling trading mode...');
      await engine.enableTrading();
      const status = await engine.getStatus();

      return NextResponse.json({
        success: true,
        message: '실시간 거래 모드가 활성화되었습니다.',
        status
      });
    } else if (action === 'force-evaluation') {
      console.log('[Engine API] Forcing evaluation...');
      const result = await engine.forceEvaluation();
      const status = await engine.getStatus();

      return NextResponse.json({
        success: result.success,
        message: result.message,
        evaluatedSymbols: result.evaluatedSymbols,
        status
      });
    } else {
      console.log('[Engine API] Stopping execution engine...');
      await engine.stop();
      const status = await engine.getStatus();

      return NextResponse.json({
        success: true,
        message: '실행 엔진이 중지되었습니다.',
        status
      });
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    const errorStack = e instanceof Error ? e.stack : undefined;
    console.error('[Engine API] Unexpected error:', errorMessage);
    console.error('[Engine API] Stack trace:', errorStack);
    return errorJson(500, 'INTERNAL', `서버 오류: ${errorMessage}`);
  }
}
