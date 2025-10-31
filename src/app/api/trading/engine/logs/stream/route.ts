/**
 * SSE (Server-Sent Events) 엔드포인트 - 실시간 로그 스트리밍
 */

import { NextRequest } from 'next/server';
import { getExecutionEngine } from '@/lib/trading/execution/ExecutionEngine';
import { readAuthCookies, createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // 인증 확인 - 쿠키 또는 쿼리 파라미터에서 토큰 확인
    let token = null;
    let userId = null;

    console.log('[SSE] 인증 확인 시작...');

    // 먼저 쿠키에서 확인
    const cookieAuth = await readAuthCookies();
    if (cookieAuth.token) {
      console.log('[SSE] 쿠키에서 토큰 발견');
      token = cookieAuth.token;
    } else {
      console.log('[SSE] 쿠키에 토큰 없음');
    }

    // 쿠키에 없으면 쿼리 파라미터에서 확인
    if (!token) {
      const searchParams = request.nextUrl.searchParams;
      const queryToken = searchParams.get('token');
      if (queryToken) {
        // URL 디코딩 (encodeURIComponent로 인코딩된 경우 처리)
        token = decodeURIComponent(queryToken);
        console.log('[SSE] 쿼리 파라미터에서 토큰 발견 (길이:', token.length, ')');
      } else {
        console.log('[SSE] 쿼리 파라미터에도 토큰 없음');
      }
    }

    if (!token) {
      console.log('[SSE] No token provided - 인증 실패');
      return new Response('Unauthorized', { status: 401 });
    }

    // 토큰 검증 - JWT 디코드를 시도 (만료되어도 user ID는 추출 가능)
    console.log('[SSE] JWT 토큰 파싱 시도...');
    try {
      // JWT 토큰 페이로드 추출 (서명 검증 없이)
      const parts = token.split('.');
      console.log('[SSE] JWT 부분 개수:', parts.length);

      if (parts.length === 3) {
        const payloadString = Buffer.from(parts[1], 'base64').toString();
        console.log('[SSE] 페이로드 디코딩 성공');
        const payload = JSON.parse(payloadString);
        userId = payload.sub;
        const userEmail = payload.email;

        console.log('[SSE] 추출된 사용자 정보 - ID:', userId, ', Email:', userEmail);

        // 토큰 만료 확인 (경고만, 차단하지 않음)
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
          const expiredMinutes = Math.floor((now - payload.exp) / 60);
          console.log(`[SSE] Token expired ${expiredMinutes} minutes ago for user ${userEmail}, allowing connection anyway`);
        } else {
          console.log(`[SSE] Valid token for user ${userEmail}`);
        }
      } else {
        console.log('[SSE] JWT 형식이 올바르지 않음 (parts != 3)');
      }
    } catch (e) {
      console.log('[SSE] Failed to parse JWT:', e);
      console.log('[SSE] 토큰 처음 50자:', token.substring(0, 50));
    }

    // userId를 추출할 수 없는 경우에만 차단
    if (!userId) {
      console.log('[SSE] Could not extract user ID from token - 인증 실패');
      return new Response('Invalid token format', { status: 401 });
    }

    console.log(`[SSE] Starting stream for user ${userId}`);

    // SSE 헤더 설정
    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // nginx 버퍼링 비활성화
    });

    // 로거 및 엔진 가져오기
    const { getLogsSince, getAllLogs } = await import('@/lib/trading/execution/logger');
    const engine = getExecutionEngine();

    // 스트림 생성
    const encoder = new TextEncoder();
    const userIdForStream = userId; // 클로저로 사용자 ID 전달
    const stream = new ReadableStream({
      async start(controller) {
        let lastTimestamp = Date.now();

        // 하트비트 (30초마다)
        const heartbeat = setInterval(() => {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        }, 30000);

        // 로그 폴링 (1초마다)
        const logsInterval = setInterval(() => {
          try {
            // 마지막 확인 이후의 새로운 로그만 가져오기
            const newLogs = getLogsSince(lastTimestamp);

            if (newLogs.length > 0) {
              // 마지막 로그의 타임스탬프 업데이트
              lastTimestamp = newLogs[newLogs.length - 1].timestamp;

              // 각 로그를 스트림으로 전송
              newLogs.forEach(log => {
                const data = JSON.stringify({
                  type: 'log',
                  ...log
                });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              });
            }
          } catch (error) {
            console.error('로그 폴링 오류:', error);
          }
        }, 1000); // 1초마다 폴링

        // 통계 업데이트 (5초마다)
        const statsInterval = setInterval(async () => {
          try {
            // 엔진 상태 가져오기
            const engineStatus = await engine.getStatus();

            // DB에서 통계 조회
            const supabase = createSupabaseServerClient('service');

            const { data: evaluations } = await supabase
              .from('condition_evaluations')
              .select('id, result, evaluation_time_ms')
              .eq('user_id', userIdForStream)
              .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
              .order('created_at', { ascending: false })
              .limit(100);

            const { data: trades } = await supabase
              .from('trades')
              .select('id, status')
              .eq('user_id', userIdForStream)
              .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

            const { data: positions } = await supabase
              .from('positions')
              .select('id')
              .eq('user_id', userIdForStream)
              .eq('status', 'open');

            // 통계 계산
            const totalEvaluations = evaluations?.length || 0;
            const successfulEvaluations = evaluations?.filter(e => e.result === true).length || 0;
            const avgEvaluationTime = totalEvaluations > 0
              ? evaluations!.reduce((sum, e) => sum + (e.evaluation_time_ms || 0), 0) / totalEvaluations
              : 0;

            const successfulOrders = trades?.filter(t => t.status === 'filled').length || 0;
            const failedOrders = trades?.filter(t => t.status === 'rejected' || t.status === 'error').length || 0;

            const stats = {
              totalEvaluations,
              successfulEvaluations,
              successfulOrders,
              failedOrders,
              activePositions: positions?.length || 0,
              avgEvaluationTime: Math.round(avgEvaluationTime),
              engineRunning: engineStatus.isRunning,
              engineMode: engineStatus.mode
            };

            const data = JSON.stringify({
              type: 'stats',
              stats
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          } catch (error) {
            console.error('통계 조회 오류:', error);
          }
        }, 5000);

        // 초기 연결 메시지
        const connectMessage = JSON.stringify({
          type: 'connected',
          timestamp: Date.now()
        });
        controller.enqueue(encoder.encode(`data: ${connectMessage}\n\n`));

        // 클린업
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          clearInterval(logsInterval);
          clearInterval(statsInterval);
          controller.close();
        });
      }
    });

    return new Response(stream, { headers });
  } catch (error) {
    console.error('SSE 스트림 오류:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}