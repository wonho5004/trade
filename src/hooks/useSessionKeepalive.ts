'use client';

import { useEffect, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Session Keepalive Hook
 *
 * 세션이 만료되지 않도록 주기적으로 토큰을 갱신합니다.
 * 모니터링 페이지처럼 장시간 열려있는 페이지에서 사용하기 위한 훅입니다.
 *
 * @param intervalMinutes - 세션 갱신 체크 주기 (분 단위, 기본값: 5분)
 */
export function useSessionKeepalive(intervalMinutes: number = 5) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const refreshSession = async () => {
      try {
        // 현재 세션 확인
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('[SessionKeepalive] 세션 확인 오류:', sessionError);
          return;
        }

        if (!session) {
          console.warn('[SessionKeepalive] 세션이 없습니다');
          return;
        }

        // 토큰 만료 시간 확인
        const expiresAt = session.expires_at;
        if (!expiresAt) {
          console.warn('[SessionKeepalive] 만료 시간을 확인할 수 없습니다');
          return;
        }

        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = expiresAt - now;
        const minutesUntilExpiry = Math.floor(timeUntilExpiry / 60);

        console.log(`[SessionKeepalive] 세션 만료까지 ${minutesUntilExpiry}분 남음`);

        // 만료 10분 전이거나 이미 만료되었으면 갱신
        if (timeUntilExpiry < 600) {
          console.log('[SessionKeepalive] 세션 갱신 시작...');
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

          if (refreshError) {
            console.error('[SessionKeepalive] 세션 갱신 실패:', refreshError);
          } else if (refreshData?.session) {
            const newExpiresAt = refreshData.session.expires_at;
            if (newExpiresAt) {
              const newMinutesUntilExpiry = Math.floor((newExpiresAt - Math.floor(Date.now() / 1000)) / 60);
              console.log(`[SessionKeepalive] 세션 갱신 성공! 새 만료 시간까지 ${newMinutesUntilExpiry}분`);
            } else {
              console.log('[SessionKeepalive] 세션 갱신 성공!');
            }
          }
        }
      } catch (error) {
        console.error('[SessionKeepalive] 예상치 못한 오류:', error);
      }
    };

    // 즉시 한 번 실행
    refreshSession();

    // 주기적으로 실행
    const intervalMs = intervalMinutes * 60 * 1000;
    intervalRef.current = setInterval(refreshSession, intervalMs);
    console.log(`[SessionKeepalive] ${intervalMinutes}분마다 세션 체크 시작`);

    // 클린업
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        console.log('[SessionKeepalive] 세션 체크 중지');
      }
    };
  }, [intervalMinutes]);
}
