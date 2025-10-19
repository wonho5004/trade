import { NextResponse } from 'next/server';

import { getAuthenticatedProfile } from '@/lib/users/profile';

export async function GET() {
  const profile = await getAuthenticatedProfile();
  if (!profile) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({
    hasBinanceApiKey: Boolean(profile.binanceApiKey),
    hasBinanceApiSecret: Boolean(profile.binanceApiSecret)
  });
}

