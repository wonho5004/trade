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

  // Capital exceptions pre-check with live balances (best-effort)
  try {
    const cap: any = settings.capital as any;
    const exc = (cap?.exceptions ?? {}) as any;
    const quote = String(cap?.initialMargin?.asset ?? 'USDT').toUpperCase();
    if (exc && (exc.totalVsWalletEnabled || exc.freeVsWalletEnabled || exc.totalBelowEnabled || exc.freeBelowEnabled)) {
      const sym = quote === 'USDC' ? 'BTCUSDC' : 'BTCUSDT';
      const res = await fetch(`/api/trading/binance/account?symbol=${sym}`, { cache: 'no-store' });
      if (res.ok) {
        const js = await res.json();
        const key = (k: string) => `${k}${quote}`;
        const wallet = Number(js?.account?.[key('wallet')] ?? NaN);
        const total = Number(js?.account?.[key('total')] ?? NaN);
        const free = Number(js?.account?.[key('free')] ?? NaN);
        const triggers: string[] = [];
        if (exc.totalVsWalletEnabled && Number.isFinite(wallet) && Number.isFinite(total)) {
          const pct = Number(exc.totalVsWalletPct ?? 0);
          if (wallet > 0 && (total / wallet) * 100 <= pct) triggers.push(`Total ≤ Wallet의 ${pct}%`);
        }
        if (exc.freeVsWalletEnabled && Number.isFinite(wallet) && Number.isFinite(free)) {
          const pct = Number(exc.freeVsWalletPct ?? 0);
          if (wallet > 0 && (free / wallet) * 100 <= pct) triggers.push(`Free ≤ Wallet의 ${pct}%`);
        }
        if (exc.totalBelowEnabled && Number.isFinite(total)) {
          const amt = Number(exc.totalBelowAmount ?? 0);
          if (total <= amt) triggers.push(`Total ≤ ${amt} ${quote}`);
        }
        if (exc.freeBelowEnabled && Number.isFinite(free)) {
          const amt = Number(exc.freeBelowAmount ?? 0);
          if (free <= amt) triggers.push(`Free ≤ ${amt} ${quote}`);
        }
        if (triggers.length > 0) {
          return { ok: false, message: `매수 예외 조건 충족: ${triggers.join(', ')}\n조건을 완화하거나 잔고를 확인해 주세요.` };
        }
      }
    }
  } catch { /* ignore best-effort */ }

  try {
    const res = await fetch('/api/strategies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: settings.logicName, payload: settings })
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({} as any));
      const msg = (json?.error?.message as string) || (json?.error as string) || '전략 저장에 실패했습니다.';
      const rid = (json?.requestId as string | undefined) ?? '';
      const composed = [msg, rid ? `요청ID: ${rid}` : ''].filter(Boolean).join('\n');
      return { ok: false, message: composed };
    }
  } catch (e) {
    return { ok: false, message: '네트워크 오류로 전략 저장에 실패했습니다.' };
  }

  return { ok: true };
}
