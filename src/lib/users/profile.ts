import { createSupabaseServerClient, readAuthCookies } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';
import type { UserRole } from '@/lib/auth/roles';

type ProfilesTable = Database['public']['Tables']['profiles'];
export type ProfileRow = ProfilesTable['Row'];

const DEFAULT_ROLE: UserRole = 'guest';

export type ProfileDetails = {
  profile: ProfileRow;
  email: string;
  displayFullName: string | null;
  displayNickname: string;
  hasNickname: boolean;
  hasPhone: boolean;
  phone: string | null;
  binanceApiKey: string | null;
  binanceApiSecret: string | null;
};

export type UserSummary = {
  id: string;
  email: string;
  displayName: string | null;
  nickname: string | null;
  phone: string | null;
  role: UserRole;
  createdAt: string | null;
  updatedAt: string | null;
};

function normalize(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function deriveFullName(meta: Record<string, unknown> | null | undefined, email: string): string | null {
  const candidate =
    normalize(meta?.full_name) ??
    normalize(meta?.display_name) ??
    normalize(meta?.name);
  if (candidate) {
    return candidate;
  }
  if (email) {
    const localPart = email.split('@')[0];
    return localPart || null;
  }
  return null;
}

function deriveNickname(
  displayName: string | null,
  meta: Record<string, unknown> | null | undefined,
  email: string
): string {
  return (
    normalize(meta?.nickname) ??
    normalize(meta?.display_name) ??
    displayName ??
    (email ? email.split('@')[0] : null) ??
    '게스트'
  );
}

function buildFallbackDetails(user: { id: string; email: string | null | undefined; user_metadata: Record<string, unknown> | null }): ProfileDetails {
  const email = user.email ?? '';
  const displayFullName = deriveFullName(user.user_metadata, email);
  const nicknameValue = normalize(user.user_metadata?.nickname);
  const displayNickname = deriveNickname(displayFullName, user.user_metadata, email);
  const phone = normalize((user.user_metadata as any)?.phone ?? (user.user_metadata as any)?.phone_number);
  const now = new Date().toISOString();

  const profile: ProfileRow = {
    id: user.id,
    role: DEFAULT_ROLE,
    display_name: displayFullName,
    created_at: now,
    updated_at: now
  };

  return {
    profile,
    email,
    displayFullName,
    displayNickname,
    hasNickname: Boolean(nicknameValue),
    hasPhone: Boolean(phone),
    phone,
    binanceApiKey: normalize(user.user_metadata?.binance_api_key),
    binanceApiSecret: normalize(user.user_metadata?.binance_api_secret)
  };
}

export async function getAuthenticatedProfile(): Promise<ProfileDetails | null> {
  const { token } = await readAuthCookies();
  if (!token) {
    return null;
  }

  let supabase;
  try {
    supabase = createSupabaseServerClient('service');
  } catch (error) {
    console.error('[profile] failed to create supabase client', error);
    return null;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  let user = userData?.user as any;
  if (userError || !user) {
    // 보완: JWT에서 sub 추출 후 Admin API로 조회 (서비스 키 필요)
    try {
      const part = String(token).split('.')[1] || '';
      const json = Buffer.from(part, 'base64').toString('utf8');
      const payload = JSON.parse(json) as Record<string, any>;
      const userId = String(payload?.sub || '');
      if (userId) {
        const { data: byId } = await (supabase as any).auth.admin.getUserById(userId);
        user = byId?.user;
      }
    } catch {}
    if (!user) return null;
  }

  const userObj = user as { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null };
  const email = userObj.email ?? '';
  // email은 위에서 유추된 값 사용

  try {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    const now = new Date().toISOString();
    const displayFullName = deriveFullName(user.user_metadata, email);
    const nicknameValue = normalize(user.user_metadata?.nickname);
    const displayNickname = deriveNickname(displayFullName, user.user_metadata, email);
    const phone = normalize(user.user_metadata?.phone);

    let profileRecord: ProfileRow;

    if (!existingProfile) {
      const insertPayload: ProfilesTable['Insert'] = {
        id: user.id,
        role: DEFAULT_ROLE,
        display_name: displayFullName,
        created_at: now,
        updated_at: now
      };
      const { data: inserted, error: insertError } = await supabase
        .from('profiles')
        .insert(insertPayload)
        .select('*')
        .maybeSingle();
      if (insertError || !inserted) {
        return buildFallbackDetails({ id: user.id, email: user.email ?? null, user_metadata: (user.user_metadata ?? null) as Record<string, unknown> | null });
      }
      profileRecord = inserted;
    } else {
      profileRecord = existingProfile;
      if (!normalize(profileRecord.display_name) && displayFullName) {
        const { data: updated } = await supabase
          .from('profiles')
          .update({ display_name: displayFullName, updated_at: now })
          .eq('id', user.id)
          .select('*')
          .maybeSingle();
        if (updated) {
          profileRecord = updated;
        }
      }
    }

    const sanitizedProfile: ProfileRow = {
      id: profileRecord.id,
      role: (profileRecord.role ?? DEFAULT_ROLE) as UserRole,
      display_name: normalize(profileRecord.display_name),
      created_at: profileRecord.created_at ?? null,
      updated_at: profileRecord.updated_at ?? null
    };

    return {
      profile: sanitizedProfile,
      email,
      displayFullName: displayFullName ?? sanitizedProfile.display_name,
      displayNickname,
      hasNickname: Boolean(nicknameValue),
      hasPhone: Boolean(((user.user_metadata as any)?.phone ?? (user.user_metadata as any)?.phone_number) ?? phone),
      phone: normalize((user.user_metadata as any)?.phone ?? (user.user_metadata as any)?.phone_number) ?? phone,
      binanceApiKey: normalize(user.user_metadata?.binance_api_key),
      binanceApiSecret: normalize(user.user_metadata?.binance_api_secret)
    };
  } catch (error) {
    console.error('[profile] failed to resolve profile', error);
    return buildFallbackDetails({ id: user.id, email: user.email ?? null, user_metadata: (user.user_metadata ?? null) as Record<string, unknown> | null });
  }
}

export async function listAllProfiles(): Promise<UserSummary[]> {
  const supabase = createSupabaseServerClient('service');

  const profileMap = new Map<string, ProfileRow>();
  const { data: profileData } = await supabase.from('profiles').select('*');
  if (profileData) {
    for (const row of profileData) {
      profileMap.set(row.id, row);
    }
  }

  const summaries: UserSummary[] = [];
  const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });

  if (usersData?.users) {
    for (const user of usersData.users) {
      const profileRow = profileMap.get(user.id);
      const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
      const email = user.email ?? '';
      const displayName = normalize(profileRow?.display_name) ?? deriveFullName(metadata, email);
      const nickname = deriveNickname(displayName, metadata, email);
      const phone = normalize(metadata.phone ?? metadata.phone_number);
      const role = (profileRow?.role as UserRole | undefined) ?? DEFAULT_ROLE;

      summaries.push({
        id: user.id,
        email,
        displayName,
        nickname,
        phone,
        role,
        createdAt: profileRow?.created_at ?? user.created_at ?? null,
        updatedAt: profileRow?.updated_at ?? user.updated_at ?? null
      });
      profileMap.delete(user.id);
    }
  }

  for (const [id, row] of profileMap.entries()) {
    const email = '';
    const displayName = normalize(row.display_name) ?? null;
    const nickname = displayName;
    summaries.push({
      id,
      email,
      displayName,
      nickname,
      phone: null,
      role: (row.role as UserRole | undefined) ?? DEFAULT_ROLE,
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null
    });
  }

  summaries.sort((a, b) => {
    const aName = a.displayName ?? a.nickname ?? a.email;
    const bName = b.displayName ?? b.nickname ?? b.email;
    return aName.localeCompare(bName);
  });

  return summaries;
}

export async function updateProfileById(id: string, payload: ProfilesTable['Update']) {
  const supabase = createSupabaseServerClient('service');
  const { error } = await supabase
    .from('profiles')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id);
  return { error };
}

export async function changeUserRole(id: string, role: UserRole) {
  return updateProfileById(id, { role });
}
