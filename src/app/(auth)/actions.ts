'use server';

import { redirect } from 'next/navigation';

import { createSupabaseServerClient, writeAuthCookies, clearAuthCookies } from '@/lib/supabase/server';

type AuthActionState = {
  status: 'idle' | 'error' | 'success';
  message?: string;
};

function sanitizeInput(value: FormDataEntryValue | null): string {
  if (!value || typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

export async function loginAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = sanitizeInput(formData.get('email'));
  const password = sanitizeInput(formData.get('password'));
  const redirectTo = sanitizeInput(formData.get('redirectTo')) || '/dashboard';

  if (!email || !password) {
    return { status: 'error', message: '이메일과 비밀번호를 모두 입력해 주세요.' };
  }

  let supabase;
  try {
    supabase = createSupabaseServerClient('anon');
  } catch (error) {
    return { status: 'error', message: (error as Error).message };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { status: 'error', message: error.message };
  }

  const session = data.session;
  const user = data.user;

  if (!session || !user) {
    return { status: 'error', message: '세션 정보를 가져오지 못했습니다. 관리자에게 문의해 주세요.' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return { status: 'error', message: profileError.message };
  }

  const role = (profile?.role as string | null) ?? 'user';
  writeAuthCookies({ token: session.access_token, role });

  redirect(redirectTo);
}

export async function registerAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = sanitizeInput(formData.get('email'));
  const password = sanitizeInput(formData.get('password'));
  const confirmPassword = sanitizeInput(formData.get('confirmPassword'));
  const displayName = sanitizeInput(formData.get('displayName'));

  if (!email || !password || !confirmPassword) {
    return { status: 'error', message: '필수 입력 항목이 누락되었습니다.' };
  }

  if (password !== confirmPassword) {
    return { status: 'error', message: '비밀번호와 확인 값이 일치하지 않습니다.' };
  }

  let supabase;
  try {
    supabase = createSupabaseServerClient('anon');
  } catch (error) {
    return { status: 'error', message: (error as Error).message };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName
      }
    }
  });

  if (error) {
    return { status: 'error', message: error.message };
  }

  const user = data.user;

  if (!user) {
    return {
      status: 'success',
      message: '회원가입이 완료되었습니다. 이메일 인증 후 로그인해 주세요.'
    };
  }

  if (data.session?.access_token) {
    writeAuthCookies({ token: data.session.access_token, role: 'user' });
    redirect('/dashboard');
  }

  return {
    status: 'success',
    message: '회원가입이 완료되었습니다. 로그인 후 이용해 주세요.'
  };
}

export async function logoutAction() {
  clearAuthCookies();
  redirect('/login');
}
