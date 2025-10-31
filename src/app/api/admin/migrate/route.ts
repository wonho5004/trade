/**
 * Database Migration API
 *
 * POST /api/admin/migrate - Run pending migrations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, readAuthCookies } from '@/lib/supabase/server';
import { readFileSync } from 'fs';
import { join } from 'path';

function errorJson(status: number, code: string, message: string) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}

/**
 * POST /api/admin/migrate
 * Run database migrations
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 인증 확인
    const { token } = await readAuthCookies();
    if (!token) return errorJson(401, 'UNAUTHORIZED', '로그인이 필요합니다.');

    const supabase = createSupabaseServerClient('service');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return errorJson(401, 'UNAUTHORIZED', '인증이 유효하지 않습니다.');
    }

    // 2. 관리자 권한 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single();

    const role = profile?.role || 'user';
    if (role !== 'admin' && role !== 'sys_admin') {
      return errorJson(403, 'FORBIDDEN', '권한이 없습니다. 관리자만 마이그레이션을 실행할 수 있습니다.');
    }

    // 3. 마이그레이션 파일 읽기
    const migrationPath = join(process.cwd(), 'supabase/migrations/20251025_create_simulation_tables.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // 4. SQL 실행 (Supabase의 rpc를 사용하여 SQL 실행)
    // Note: Supabase는 직접 SQL 실행을 지원하지 않으므로, 수동으로 Supabase Dashboard에서 실행해야 합니다.
    console.log('[Migration API] Migration SQL loaded, but needs to be executed manually in Supabase Dashboard');

    return NextResponse.json({
      success: true,
      message: '마이그레이션 파일을 읽었습니다. Supabase Dashboard에서 SQL을 실행해주세요.',
      sql: migrationSQL,
      instructions: [
        '1. Supabase Dashboard > SQL Editor로 이동',
        '2. 아래 SQL을 복사하여 붙여넣기',
        '3. RUN 버튼 클릭'
      ]
    });

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error('[Migration API] Unexpected error:', errorMessage);
    return errorJson(500, 'INTERNAL', `서버 오류: ${errorMessage}`);
  }
}
