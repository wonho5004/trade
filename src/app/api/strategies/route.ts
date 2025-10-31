/**
 * Strategies API - Auto-trading strategy management
 *
 * GET /api/strategies - List all strategies for the authenticated user
 * POST /api/strategies - Create a new strategy
 */

import { NextResponse } from 'next/server';

import { createSupabaseServerClient, readAuthCookies } from '@/lib/supabase/server';
import type { CreateStrategyRequest, Strategy } from '@/types/trading/strategy';

function errorJson(status: number, code: string, message: string, details?: Record<string, unknown>) {
  const requestId = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return NextResponse.json(
    { success: false, error: { code, message, details }, requestId, ts: new Date().toISOString() },
    { status }
  );
}

/**
 * GET /api/strategies
 * Returns all strategies for the authenticated user
 */
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
    const activeOnly = searchParams.get('active') === 'true';

    // Fetch strategies for this user
    let query = supabase
      .from('strategies')
      .select('*')
      .eq('user_id', userId);

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: strategies, error: dbError } = await query.order('created_at', { ascending: false });

    if (dbError) {
      console.error('Failed to fetch strategies:', dbError);
      return errorJson(500, 'DATABASE_ERROR', '전략 목록 조회에 실패했습니다.', { dbError: dbError.message });
    }

    return NextResponse.json({
      success: true,
      strategies: strategies ?? [],
      total: strategies?.length ?? 0
    });
  } catch (e) {
    console.error('Unexpected error in GET /api/strategies:', e);
    return errorJson(500, 'INTERNAL', '서버 오류가 발생했습니다.');
  }
}

/**
 * POST /api/strategies
 * Creates a new strategy for the authenticated user
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

    const userId = userData.user.id;

    // Parse request body
    let body: CreateStrategyRequest;
    try {
      body = (await request.json()) as CreateStrategyRequest;
      console.log('[POST /api/strategies] ✅ JSON parsing successful');
    } catch (parseError) {
      console.error('[POST /api/strategies] ❌ JSON parsing failed:', parseError);
      return errorJson(400, 'INVALID_JSON', 'JSON 파싱에 실패했습니다.');
    }

    // Debug logging - detailed inspection
    console.log('[POST /api/strategies] ===== REQUEST DEBUG START =====');
    console.log('[POST /api/strategies] typeof body:', typeof body);
    console.log('[POST /api/strategies] body is null:', body === null);
    console.log('[POST /api/strategies] body is undefined:', body === undefined);
    console.log('[POST /api/strategies] body keys:', body ? Object.keys(body) : 'N/A');
    console.log('[POST /api/strategies] body.name:', body?.name);
    console.log('[POST /api/strategies] body.description:', body?.description);
    console.log('[POST /api/strategies] body.is_active:', body?.is_active);
    console.log('[POST /api/strategies] ---');
    console.log('[POST /api/strategies] body.settings exists:', !!body?.settings);
    console.log('[POST /api/strategies] body.settings type:', typeof body?.settings);
    console.log('[POST /api/strategies] body.settings is null:', body?.settings === null);
    console.log('[POST /api/strategies] body.settings is undefined:', body?.settings === undefined);

    if (body?.settings) {
      console.log('[POST /api/strategies] settings keys:', Object.keys(body.settings));
      console.log('[POST /api/strategies] settings.logicName:', body.settings.logicName);
      console.log('[POST /api/strategies] settings.leverage:', body.settings.leverage);
      console.log('[POST /api/strategies] settings.symbolCount:', body.settings.symbolCount);
    }

    // Try to stringify the full body
    try {
      const bodyStr = JSON.stringify(body);
      console.log('[POST /api/strategies] Full body JSON length:', bodyStr.length);
      console.log('[POST /api/strategies] Full body preview:', bodyStr.substring(0, 500));
    } catch (stringifyError) {
      console.error('[POST /api/strategies] Failed to stringify body:', stringifyError);
    }
    console.log('[POST /api/strategies] ===== REQUEST DEBUG END =====');

    const name = body?.name?.trim();
    const description = body?.description?.trim() ?? null;
    const settings = body?.settings;
    const isActive = body?.is_active ?? false;

    // Validation
    if (!name) {
      console.log('[POST /api/strategies] Validation failed: name is required');
      return errorJson(400, 'VALIDATION_ERROR', '전략 이름은 필수입니다.', {
        fieldErrors: [{ field: 'name', code: 'REQUIRED', message: '전략 이름을 입력하세요.' }]
      });
    }

    if (!settings) {
      console.log('[POST /api/strategies] Validation failed: settings is required');
      console.log('[POST /api/strategies] settings value:', settings);
      return errorJson(400, 'VALIDATION_ERROR', '전략 설정은 필수입니다.', {
        fieldErrors: [{ field: 'settings', code: 'REQUIRED', message: '전략 설정이 필요합니다.' }]
      });
    }

    // Check for duplicate name
    const { data: existing } = await supabase
      .from('strategies')
      .select('id')
      .eq('user_id', userId)
      .eq('name', name)
      .maybeSingle();

    if (existing) {
      return errorJson(409, 'DUPLICATE_NAME', '이미 같은 이름의 전략이 존재합니다.', {
        fieldErrors: [{ field: 'name', code: 'DUPLICATE', message: '다른 이름을 사용하세요.' }]
      });
    }

    // If setting this as active, deactivate all other strategies
    if (isActive) {
      await supabase
        .from('strategies')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true);
    }

    // Insert new strategy
    const { data: newStrategy, error: insertError } = await supabase
      .from('strategies')
      .insert({
        user_id: userId,
        name,
        description,
        settings,
        is_active: isActive
      })
      .select()
      .single();

    if (insertError || !newStrategy) {
      console.error('Failed to create strategy:', insertError);
      return errorJson(500, 'DATABASE_ERROR', '전략 저장에 실패했습니다.', { dbError: insertError?.message });
    }

    return NextResponse.json({
      success: true,
      strategy: newStrategy as Strategy
    }, { status: 201 });
  } catch (e) {
    console.error('Unexpected error in POST /api/strategies:', e);
    return errorJson(500, 'INTERNAL', '서버 오류가 발생했습니다.');
  }
}
