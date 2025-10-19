'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type ConsentRecord = {
  acknowledgedAt: string;
  skipUntil: string | null;
};

const STORAGE_KEY = 'auto-trading-consent';

const consentClauses = [
  '모든 투자의 책임은 본인에게 있으며, 자동매매 프로그램은 수익을 보장하지 않습니다.',
  '높은 위험 투자로 인해 청산(Margin Call)이 발생하면 투자금을 모두 잃을 수 있습니다.',
  '로직을 생성하기 전에 논리적인 검증을 먼저 계산하신 후, 신중하게 결정하시기 바랍니다.',
  '논리 검증은 프로그램 상에서 제공하지 않으며, 프로그램 오류가 있는지만 확인합니다.',
  '암호화폐 거래는 거래소에서 정한 최소 거래 단위가 존재하며, 주문 설정 금액과 정확히 일치하지 않을 수 있습니다.',
  '프로그램은 바이낸스 거래소와 프로그램 서버 사정에 따라 딜레이가 발생할 수 있으며, 이로 인해 생기는 손실은 제공자가 책임지지 않습니다.',
  '높은 레버리지와 많은 마진을 사용할 경우 청산 가능성이 높아지므로, 안정적인 증거금을 확보하고 거래하시기 바랍니다.',
  '암호화폐는 높은 변동성으로 인해 예상 밖 시나리오가 언제든 발생할 수 있습니다. 투자에 유의해 주시기 바랍니다.',
  '암호화폐 거래에는 거래소 수수료 및 펀딩비가 발생하여 가격 변동 없이도 손실이 발생할 수 있습니다.',
  '위 모든 내용을 이해하고 동의하는 경우에만 "동의함" 버튼을 누르고 시작해 주시기 바랍니다.',
  '위 내용에 하나라도 동의하지 않으시면 "동의하지 않음"을 누르고 페이지를 벗어나 주시기 바랍니다.'
];

const getNextMidnightISOString = () => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.toISOString();
};

export function AutoTradingConsentGate({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [showConsent, setShowConsent] = useState(true);
  const [skipToday, setSkipToday] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const restoreConsent = () => {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setIsReady(true);
        return;
      }
      try {
        const parsed = JSON.parse(raw) as ConsentRecord;
        if (parsed.skipUntil && new Date(parsed.skipUntil).getTime() > Date.now()) {
          setShowConsent(false);
        }
      } catch {
        // 파싱 오류 시 동의 창을 다시 보여줍니다.
      } finally {
        setIsReady(true);
      }
    };
    restoreConsent();
  }, []);

  const persistConsent = (options: { skip: boolean }) => {
    const record: ConsentRecord = {
      acknowledgedAt: new Date().toISOString(),
      skipUntil: options.skip ? getNextMidnightISOString() : null
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  };

  const handleAccept = () => {
    persistConsent({ skip: skipToday });
    setShowConsent(false);
  };

  const handleDecline = () => {
    persistConsent({ skip: false });
    router.replace('/dashboard');
  };

  if (!isReady) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-zinc-400">자동매매 가이드를 불러오는 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {children}
      {showConsent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-zinc-100">자동 매매 로직 생성기 이용 동의</h2>
            <p className="mt-2 text-sm text-zinc-400">
              아래 항목을 충분히 이해하고 동의하는 경우에만 자동매매 설정으로 이동할 수 있습니다.
            </p>
            <ol className="mt-4 space-y-3 text-sm text-zinc-200">
              {consentClauses.map((clause, index) => (
                <li key={clause} className="flex gap-3">
                  <span className="mt-1 text-xs text-emerald-300">{index + 1}.</span>
                  <span>{clause}</span>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={skipToday}
                  onChange={(event) => setSkipToday(event.target.checked)}
                  className="h-4 w-4 rounded border border-zinc-600 bg-zinc-900"
                />
                오늘 하루 다시 보지 않기
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleDecline}
                  className="rounded border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-rose-500/70 hover:text-rose-300"
                >
                  동의하지 않음
                </button>
                <button
                  type="button"
                  onClick={handleAccept}
                  className="rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
                >
                  동의함
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
