
const guideCards = [
  {
    title: '바이낸스 계정 생성 가이드',
    description: '실제 자동매매를 사용하려면 KYC 완료 계정이 필요합니다. 공식 도움말을 참고해 안전하게 계정을 개설하세요.',
    href: 'https://www.binance.com/ko/support/faq/360027287111',
    bullets: [
      'SMS·Authenticator 2단계 인증을 활성화해 계정을 보호하세요.',
      '서브 계정을 활용하면 전략별로 증거금을 분리할 수 있습니다.'
    ]
  },
  {
    title: '바이낸스 API Key 발급 가이드',
    description: '자동매매 실행을 위해서는 거래 권한이 포함된 API Key가 필요합니다.',
    href: 'https://www.binance.com/ko/support/faq/360002502072',
    bullets: [
      'IP 화이트리스트를 등록해 허용된 서버에서만 주문이 가능하도록 제한하세요.',
      '현물/선물 권한과 출금 권한을 분리해 리스크를 최소화하세요.'
    ]
  }
];

export function AutoTradingGuideMenu() {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-zinc-100">자동 매매 설정 가이드</h2>
        <p className="mt-1 text-sm text-zinc-400">필수 사전 준비 사항을 확인하고 안전하게 자동매매를 시작하세요.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {guideCards.map((card) => (
          <a
            key={card.title}
            href={card.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-emerald-400/60 hover:bg-emerald-500/5"
          >
            <div>
              <p className="text-sm font-semibold text-zinc-100">{card.title}</p>
              <p className="mt-1 text-xs text-zinc-400">{card.description}</p>
            </div>
            <ul className="list-disc space-y-1 pl-4 text-[11px] text-zinc-400">
              {card.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <span className="text-xs font-semibold text-emerald-300 transition group-hover:text-emerald-200">
              공식 가이드 열기 →
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
