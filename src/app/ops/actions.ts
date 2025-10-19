'use server';

import { revalidatePath } from 'next/cache';

import { createSupabaseServerClient, readAuthCookies } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/auth/roles';
import { changeUserRole } from '@/lib/users/profile';
import type { OpsActionState } from '@/app/ops/form-state';
import { recordUserActivity } from '@/lib/logs/audit';

const ROLE_OPTIONS: UserRole[] = ['guest', 'member', 'admin', 'sys_admin'];

async function requireSystemAdmin() {
  const { token, role } = readAuthCookies();
  if (!token) {
    throw new Error('인증 정보가 없습니다. 다시 로그인해 주세요.');
  }
  if (role !== 'sys_admin') {
    throw new Error('시스템 관리자 권한이 필요합니다.');
  }

  const supabase = createSupabaseServerClient('service');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new Error('사용자 정보를 확인할 수 없습니다.');
  }
  const actor = data.user;
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', actor.id)
    .maybeSingle();
  if (profileError || !profile || profile.role !== 'sys_admin') {
    throw new Error('시스템 관리자 권한이 필요합니다.');
  }
  return { supabase, actor };
}

export async function assignUserRoleAction(_prev: OpsActionState, formData: FormData): Promise<OpsActionState> {
  try {
    const targetId = formData.get('userId');
    const role = formData.get('role');

    if (typeof targetId !== 'string' || !targetId) {
      return { status: 'error', message: '대상 사용자를 선택해 주세요.' };
    }
    if (typeof role !== 'string' || !ROLE_OPTIONS.includes(role as UserRole)) {
      return { status: 'error', message: '올바른 권한 값을 선택해 주세요.' };
    }

    const { actor } = await requireSystemAdmin();

    const { error } = await changeUserRole(targetId, role as UserRole);
    if (error) {
      return { status: 'error', message: error.message ?? '권한 변경에 실패했습니다.' };
    }

    void recordUserActivity({
      userId: targetId,
      action: 'role_change',
      detail: `권한이 ${role} 으로 변경됨`,
      actorId: actor.id,
      actorEmail: actor.email,
      metadata: { role }
    });
    void recordUserActivity({
      userId: actor.id,
      action: 'role_change_performed',
      detail: `${targetId} 권한을 ${role} 으로 변경`,
      actorId: actor.id,
      actorEmail: actor.email,
      metadata: { targetId, role }
    });

    revalidatePath('/ops');

    return { status: 'success', message: '사용자 권한이 변경되었습니다.' };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    };
  }
}

export async function bootstrapAdminAccountAction(
  _prev: OpsActionState,
  _formData: FormData
): Promise<OpsActionState> {
  try {
    const { supabase, actor } = await requireSystemAdmin();

    const adminEmail = 'admin@system.local';
    const adminPassword = 'btc1234';

    const { data: existingUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = existingUsers?.users?.find((item) => item.email === adminEmail) ?? null;

    if (existingUser) {
      const { error: ensureProfileError } = await supabase.from('profiles').upsert({
        id: existingUser.id,
        role: 'sys_admin',
        display_name: '시스템 관리자',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      if (ensureProfileError) {
        return { status: 'error', message: ensureProfileError.message ?? '프로필 갱신에 실패했습니다.' };
      }
      void recordUserActivity({
        userId: existingUser.id,
        action: 'admin_bootstrap_checked',
        detail: '기존 시스템 관리자 계정 확인',
        actorId: actor.id,
        actorEmail: actor.email
      });
      return { status: 'success', message: 'admin 계정이 이미 존재합니다.' };
    }

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        display_name: '시스템 관리자',
        nickname: 'admin'
      }
    });

    if (createError || !created?.user) {
      return { status: 'error', message: createError?.message ?? 'admin 계정 생성에 실패했습니다.' };
    }

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: created.user.id,
      role: 'sys_admin',
      display_name: '시스템 관리자',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    if (upsertError) {
      return { status: 'error', message: upsertError.message ?? '프로필 생성에 실패했습니다.' };
    }

    void recordUserActivity({
      userId: created.user.id,
      action: 'admin_account_created',
      detail: '시스템 관리자 계정 생성',
      actorId: actor.id,
      actorEmail: actor.email
    });

    void recordUserActivity({
      userId: actor.id,
      action: 'admin_account_created_actor',
      detail: `${created.user.id} 시스템 관리자 계정 생성`,
      actorId: actor.id,
      actorEmail: actor.email
    });

    revalidatePath('/ops');
    revalidatePath('/admin');

    return { status: 'success', message: 'admin(btc1234) 시스템 관리자 계정이 생성되었습니다.' };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    };
  }
}

export async function deleteUserAction(_prev: OpsActionState, formData: FormData): Promise<OpsActionState> {
  try {
    const targetId = formData.get('userId');
    if (typeof targetId !== 'string' || !targetId) {
      return { status: 'error', message: '삭제할 사용자를 선택해 주세요.' };
    }

    const { supabase, actor } = await requireSystemAdmin();

    const { error: deleteProfileError } = await supabase.from('profiles').delete().eq('id', targetId);
    if (deleteProfileError) {
      console.warn('[ops] delete profile error', deleteProfileError.message);
    }

    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(targetId);
    if (deleteUserError) {
      return { status: 'error', message: deleteUserError.message ?? '사용자 삭제에 실패했습니다.' };
    }

    void recordUserActivity({
      userId: targetId,
      action: 'user_deleted',
      detail: '사용자 계정 삭제',
      actorId: actor.id,
      actorEmail: actor.email
    });

    void recordUserActivity({
      userId: actor.id,
      action: 'user_delete_performed',
      detail: `${targetId} 사용자 삭제`,
      actorId: actor.id,
      actorEmail: actor.email,
      metadata: { targetId }
    });

    revalidatePath('/ops');
    revalidatePath('/admin');
    revalidatePath('/admin/users');

    return { status: 'success', message: '사용자가 삭제되었습니다.' };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    };
  }
}
