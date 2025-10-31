/**
 * Get SSE connection token
 * Returns a token that can be used to connect to the SSE stream
 */

import { NextResponse } from 'next/server';
import { readAuthCookies, createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    console.log('[Token API] 토큰 요청 받음');

    // Get token from cookies
    const authCookies = await readAuthCookies();
    console.log('[Token API] 쿠키 읽기 결과:', {
      hasToken: !!authCookies.token,
      tokenLength: authCookies.token ? authCookies.token.length : 0
    });

    const { token } = authCookies;

    if (!token) {
      console.log('[Token API] No token in cookies - 쿠키에 토큰 없음');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the token is still valid
    console.log('[Token API] 토큰 검증 시작...');
    const supabase = createSupabaseServerClient('service');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData?.user) {
      console.log('[Token API] Invalid token:', userError?.message);
      console.log('[Token API] 토큰 검증 실패 - 만료되었거나 유효하지 않음');

      // 토큰이 만료되었더라도 반환 (SSE endpoint에서 처리)
      if (userError?.message?.includes('expired')) {
        console.log('[Token API] 토큰이 만료되었지만 반환함');
        return NextResponse.json({ token });
      }

      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    console.log('[Token API] Valid token for user:', userData.user.email);
    console.log('[Token API] 토큰 검증 성공 - 유효한 사용자');

    // Return the token for the client to use
    return NextResponse.json({ token });
  } catch (error) {
    console.error('[Token API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}