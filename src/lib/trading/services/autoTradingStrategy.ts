import type { AutoTradingSettings } from '@/types/trading/auto-trading';
import { assertAllSectionsReady } from '@/lib/trading/validators/autoTrading';

export async function ensureApiCredentials(): Promise<{ ok: boolean; message?: string }>
{
  try {
    const res = await fetch('/api/profile/credentials', { cache: 'no-store' });
    if (!res.ok) return { ok: false, message: '로그인이 필요합니다.' };
    const json = (await res.json()) as { hasBinanceApiKey: boolean; hasBinanceApiSecret: boolean };
    if (!json.hasBinanceApiKey || !json.hasBinanceApiSecret) {
      return { ok: false, message: '마이페이지에 Binance API Key/Secret을 등록하세요.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: '자격 증명 확인에 실패했습니다.' };
  }
}

export async function generateAutoTradingStrategy(settings: AutoTradingSettings): Promise<{ ok: boolean; message?: string }>
{
  try {
    assertAllSectionsReady(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : '설정 검증 실패';
    return { ok: false, message };
  }

  const creds = await ensureApiCredentials();
  if (!creds.ok) return creds;

  try {
    const res = await fetch('/api/strategies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: settings.logicName, payload: settings })
    });
    if (!res.ok) {
      const msg = (await res.json().catch(() => ({})))?.error ?? '전략 저장에 실패했습니다.';
      return { ok: false, message: msg };
    }
  } catch (e) {
    return { ok: false, message: '네트워크 오류로 전략 저장에 실패했습니다.' };
  }

  return { ok: true };
}
