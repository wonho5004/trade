/**
 * Vercel Cron Job - 주기적 조건 평가
 *
 * 15분마다 자동으로 실행됩니다.
 * vercel.json에서 스케줄이 설정되어 있습니다.
 */

import { NextResponse } from 'next/server';
import { getExecutionEngine } from '@/lib/trading/execution/ExecutionEngine';

export const maxDuration = 60; // 최대 60초 실행 허용
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Vercel Cron 인증 확인
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('[Cron] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron] Starting scheduled evaluation...');
    const startTime = Date.now();

    const engine = getExecutionEngine();
    const result = await engine.forceEvaluation();

    const duration = Date.now() - startTime;
    console.log(`[Cron] Evaluation completed in ${duration}ms`);
    console.log(`[Cron] Result: ${result.message}`);
    console.log(`[Cron] Evaluated symbols: ${result.evaluatedSymbols}`);

    return NextResponse.json({
      success: true,
      message: 'Scheduled evaluation completed',
      duration,
      ...result
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Cron] Error during scheduled evaluation:', errorMessage);

    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}
