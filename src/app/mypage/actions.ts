'use server';

import { revalidatePath } from 'next/cache';

import type { FormState } from '@/app/mypage/form-state';
import type { Database } from '@/types/supabase';
import { createSupabaseServerClient, readAuthCookies } from '@/lib/supabase/server';
import { recordUserActivity } from '@/lib/logs/audit';

type ProfilesTable = Database['public']['Tables']['profiles'];

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (!value || typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

async function getAuthenticatedContext() {
  const { token } = readAuthCookies();
  if (!token) {
    throw new Error('세션이 만료되었습니다. 다시 로그인해 주세요.');
  }

  const supabaseService = createSupabaseServerClient('service');
  const { data, error } = await supabaseService.auth.getUser(token);
  if (error || !data?.user) {
    throw new Error('세션이 만료되었습니다. 다시 로그인해 주세요.');
  }

  const supabaseAnon = createSupabaseServerClient('anon');

  return {
    supabaseAnon,
    supabaseService,
    user: data.user
  };
}

export async function updateProfileAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  try {
    const fullNameInput = readString(formData, 'fullName');
    const nicknameInput = readString(formData, 'nickname');
    const phoneInput = readString(formData, 'phone');
    const currentPassword = readString(formData, 'currentPassword');
    const binanceApiKeyInput = readString(formData, 'binanceApiKey');
    const binanceApiSecretInput = readString(formData, 'binanceApiSecret');

    if (!currentPassword) {
      return { status: 'error', message: '변경사항을 저장하려면 현재 비밀번호를 입력해 주세요.' };
    }

    const { supabaseAnon, supabaseService, user } = await getAuthenticatedContext();
    const emailAddress = user.email ?? '';

    const { error: verifyError } = await supabaseAnon.auth.signInWithPassword({
      email: emailAddress,
      password: currentPassword
    });

    if (verifyError) {
      return { status: 'error', message: '현재 비밀번호가 일치하지 않습니다.' };
    }

    const normalizedFullName = fullNameInput.trim() || null;
    const fallbackNicknameSource = normalizedFullName ?? emailAddress.split('@')[0] ?? '';
    const normalizedNickname = nicknameInput.trim()
      ? nicknameInput.trim()
      : fallbackNicknameSource
          .trim()
          .slice(0, 30); // limit length

    if (!normalizedNickname) {
      return { status: 'error', message: '닉네임을 입력하거나 기본값을 확인해 주세요.' };
    }

    const RESERVED_NICKNAMES = [
      'admin',
      'administrator',
      'manager',
      '관리자',
      'system',
      'sysadmin',
      'systemadmin',
      '시스템관리자',
      'master',
      'superuser',
      'moderator',
      '운영자'
    ];
    const lowerNickname = normalizedNickname.toLowerCase();
    if (RESERVED_NICKNAMES.some((reserved) => lowerNickname.includes(reserved))) {
      return { status: 'error', message: '사용할 수 없는 닉네임입니다. 다른 이름을 선택해 주세요.' };
    }

    const { data: userList } = await supabaseService.auth.admin.listUsers({ perPage: 1000 });
    const nicknameTaken = userList?.users?.some((item) => {
      if (item.id === user.id) {
        return false;
      }
      const meta = (item.user_metadata ?? {}) as Record<string, unknown>;
      const candidates = [meta.nickname, meta.display_name, meta.full_name, meta.name];
      return candidates.some((value) => typeof value === 'string' && value.toLowerCase() === lowerNickname);
    });
    if (nicknameTaken) {
      return { status: 'error', message: '이미 사용 중인 닉네임입니다. 다른 이름을 입력해 주세요.' };
    }

    const normalizedPhone = phoneInput.trim() || null;
    const sanitizedApiKey = binanceApiKeyInput.trim() ? binanceApiKeyInput.trim() : null;
    const sanitizedApiSecret = binanceApiSecretInput.trim() ? binanceApiSecretInput.trim() : null;
    const displayNameForProfile =
      normalizedFullName ?? normalizedNickname ?? (emailAddress ? emailAddress.split('@')[0] : null);

    const { data: existing } = await supabaseService.from('profiles').select('id, role').eq('id', user.id).maybeSingle();

    const now = new Date().toISOString();

    const OPTIONAL_COLUMNS = [
      'display_name',
      'role',
      'created_at',
      'updated_at'
    ];

    const detectMissingColumn = (message: string | null | undefined) => {
      if (!message) {
        return null;
      }
      const lower = message.toLowerCase();
      return OPTIONAL_COLUMNS.find((column) => lower.includes(`'${column}'`) || lower.includes(column)) ?? null;
    };

    const filterUndefined = (payload: Record<string, unknown>) => {
      const filtered: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(payload)) {
        if (value !== undefined) {
          filtered[key] = value;
        }
      }
      return filtered;
    };

    const executeUpdateWithFallback = async (updatePayload: Record<string, unknown>) => {
      let attempt = filterUndefined(updatePayload);
      if (Object.keys(attempt).length === 0) {
        return null;
      }

      while (Object.keys(attempt).length > 0) {
        const { error } = await supabaseService
          .from('profiles')
          .update(attempt as ProfilesTable['Update'])
          .eq('id', user.id);

        if (!error) {
          return null;
        }

        const missingColumn = detectMissingColumn(error.message);
        if (missingColumn && missingColumn in attempt) {
          delete attempt[missingColumn];
          continue;
        }

        return error;
      }

      return null;
    };

    const executeInsertWithFallback = async (insertPayload: Record<string, unknown>) => {
      let attempt = filterUndefined(insertPayload);
      if (!('id' in attempt)) {
        attempt.id = user.id;
      }
      if (!('role' in attempt)) {
        attempt.role = 'guest';
      }

      const optionalSet = new Set(OPTIONAL_COLUMNS);

      while (Object.keys(attempt).length > 0) {
        const { error } = await supabaseService
          .from('profiles')
          .insert(attempt as ProfilesTable['Insert']);

        if (!error) {
          return null;
        }

        const missingColumn = detectMissingColumn(error.message);
        if (missingColumn && missingColumn in attempt && optionalSet.has(missingColumn)) {
          delete attempt[missingColumn];
          continue;
        }

        return error;
      }

      return null;
    };

    const updatePayload: Record<string, unknown> = {
      display_name: displayNameForProfile,
      updated_at: now
    };

    const insertPayload: Record<string, unknown> = {
      id: user.id,
      role: 'guest',
      display_name: displayNameForProfile,
      created_at: now,
      updated_at: now
    };

    if (existing) {
      const updateError = await executeUpdateWithFallback(updatePayload);
      if (updateError) {
        return { status: 'error', message: updateError.message ?? '정보 저장에 실패했습니다.' };
      }
    } else {
      const insertError = await executeInsertWithFallback(insertPayload);
      if (insertError) {
        return { status: 'error', message: insertError.message ?? '정보 저장에 실패했습니다.' };
      }
    }

    const metadataPayload: Record<string, unknown> = {
      full_name: normalizedFullName,
      display_name: displayNameForProfile,
      nickname: normalizedNickname,
      phone: normalizedPhone,
      binance_api_key: sanitizedApiKey,
      binance_api_secret: sanitizedApiSecret
    };

    const filteredMetadata: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadataPayload)) {
      if (value !== undefined) {
        filteredMetadata[key] = value;
      }
    }

    const { error: metadataError } = await supabaseService.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata ?? {}),
        ...filteredMetadata
      }
    });

    if (metadataError) {
      console.warn('[mypage] failed to sync user metadata', metadataError);
    }

    void recordUserActivity({
      userId: user.id,
      action: 'profile_update',
      detail: '사용자 정보 저장',
      actorId: user.id,
      actorEmail: user.email ?? emailAddress,
      metadata: {
        full_name: normalizedFullName,
        nickname: normalizedNickname,
        phone: normalizedPhone
      }
    });

    revalidatePath('/dashboard');
    revalidatePath('/mypage');

    return { status: 'success', message: '사용자 정보가 저장되었습니다.' };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    };
  }
}

export async function changePasswordAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  try {
    const currentPassword = readString(formData, 'currentPassword');
    const newPassword = readString(formData, 'newPassword');
    const confirmPassword = readString(formData, 'confirmPassword');

    if (!currentPassword || !newPassword || !confirmPassword) {
      return { status: 'error', message: '모든 비밀번호 입력란을 채워 주세요.' };
    }

    if (newPassword !== confirmPassword) {
      return { status: 'error', message: '새 비밀번호와 확인 값이 일치하지 않습니다.' };
    }

    if (newPassword.length < 8) {
      return { status: 'error', message: '비밀번호는 최소 8자 이상이어야 합니다.' };
    }

    const { supabaseAnon, supabaseService, user } = await getAuthenticatedContext();
    const email = user.email ?? '';

    const { error: verifyError } = await supabaseAnon.auth.signInWithPassword({ email, password: currentPassword });
    if (verifyError) {
      return { status: 'error', message: '현재 비밀번호가 일치하지 않습니다.' };
    }

    const { error: passwordError } = await supabaseService.auth.admin.updateUserById(user.id, {
      password: newPassword
    });
    if (passwordError) {
      return { status: 'error', message: passwordError.message ?? '비밀번호 변경에 실패했습니다.' };
    }

    void recordUserActivity({
      userId: user.id,
      action: 'password_change',
      detail: '비밀번호 변경',
      actorId: user.id,
      actorEmail: user.email ?? email
    });

    revalidatePath('/mypage');

    return { status: 'success', message: '비밀번호가 변경되었습니다.' };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    };
  }
}
