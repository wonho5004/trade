/**
 * Individual Strategy API - CRUD operations for specific strategy
 *
 * GET /api/strategies/[id] - Get a specific strategy
 * PUT /api/strategies/[id] - Update a specific strategy
 * DELETE /api/strategies/[id] - Delete a specific strategy
 */

import { NextResponse } from 'next/server';

import { createSupabaseServerClient, readAuthCookies } from '@/lib/supabase/server';
import type { Strategy, UpdateStrategyRequest } from '@/types/trading/strategy';

function errorJson(status: number, code: string, message: string, details?: Record<string, unknown>) {
  const requestId = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return NextResponse.json(
    { success: false, error: { code, message, details }, requestId, ts: new Date().toISOString() },
    { status }
  );
}

/**
 * GET /api/strategies/[id]
 * Returns a specific strategy if it belongs to the authenticated user
 */
export async function GET(
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
    const strategyId = params.id;

    // Fetch the strategy
    const { data: strategy, error: dbError } = await supabase
      .from('strategies')
      .select('*')
      .eq('id', strategyId)
      .eq('user_id', userId)
      .maybeSingle();

    if (dbError) {
      console.error('Failed to fetch strategy:', dbError);
      return errorJson(500, 'DATABASE_ERROR', '전략 조회에 실패했습니다.', { dbError: dbError.message });
    }

    if (!strategy) {
      return errorJson(404, 'NOT_FOUND', '전략을 찾을 수 없습니다.');
    }

    return NextResponse.json({
      success: true,
      strategy: strategy as Strategy
    });
  } catch (e) {
    console.error('Unexpected error in GET /api/strategies/[id]:', e);
    return errorJson(500, 'INTERNAL', '서버 오류가 발생했습니다.');
  }
}

/**
 * PUT /api/strategies/[id]
 * Updates a specific strategy
 */
export async function PUT(
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
    const strategyId = params.id;

    // Check if strategy exists and belongs to user
    const { data: existing } = await supabase
      .from('strategies')
      .select('id')
      .eq('id', strategyId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) {
      return errorJson(404, 'NOT_FOUND', '전략을 찾을 수 없습니다.');
    }

    // Parse request body
    const body = (await request.json()) as UpdateStrategyRequest;
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) {
        return errorJson(400, 'VALIDATION_ERROR', '전략 이름은 필수입니다.');
      }

      // Check for duplicate name (excluding current strategy)
      const { data: duplicate } = await supabase
        .from('strategies')
        .select('id')
        .eq('user_id', userId)
        .eq('name', name)
        .neq('id', strategyId)
        .maybeSingle();

      if (duplicate) {
        return errorJson(409, 'DUPLICATE_NAME', '이미 같은 이름의 전략이 존재합니다.');
      }

      updates.name = name;
    }

    if (body.description !== undefined) {
      updates.description = body.description?.trim() ?? null;
    }

    if (body.settings !== undefined) {
      updates.settings = body.settings;
    }

    if (body.is_active !== undefined) {
      // If setting this as active, deactivate all other strategies
      if (body.is_active) {
        await supabase
          .from('strategies')
          .update({ is_active: false })
          .eq('user_id', userId)
          .eq('is_active', true)
          .neq('id', strategyId);
      }
      updates.is_active = body.is_active;
    }

    // Update the strategy
    const { data: updatedStrategy, error: updateError } = await supabase
      .from('strategies')
      .update(updates)
      .eq('id', strategyId)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError || !updatedStrategy) {
      console.error('Failed to update strategy:', updateError);
      return errorJson(500, 'DATABASE_ERROR', '전략 수정에 실패했습니다.', { dbError: updateError?.message });
    }

    return NextResponse.json({
      success: true,
      strategy: updatedStrategy as Strategy
    });
  } catch (e) {
    console.error('Unexpected error in PUT /api/strategies/[id]:', e);
    return errorJson(500, 'INTERNAL', '서버 오류가 발생했습니다.');
  }
}

/**
 * DELETE /api/strategies/[id]
 * Deletes a specific strategy
 */
export async function DELETE(
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
    const strategyId = params.id;

    // Delete the strategy
    const { error: deleteError } = await supabase
      .from('strategies')
      .delete()
      .eq('id', strategyId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Failed to delete strategy:', deleteError);
      return errorJson(500, 'DATABASE_ERROR', '전략 삭제에 실패했습니다.', { dbError: deleteError.message });
    }

    return NextResponse.json({
      success: true,
      message: '전략이 삭제되었습니다.'
    });
  } catch (e) {
    console.error('Unexpected error in DELETE /api/strategies/[id]:', e);
    return errorJson(500, 'INTERNAL', '서버 오류가 발생했습니다.');
  }
}
