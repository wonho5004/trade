'use client';

import React, { useState } from 'react';
import Link from 'next/link';

type HelpSection = 'getting-started' | 'basic-concepts' | 'strategy-setup' | 'indicators' | 'faq';

interface HelpArticle {
  id: string;
  title: string;
  content: string;
  section: HelpSection;
}

/**
 * 도움말 센터 페이지
 */
export default function HelpPage() {
  const [selectedSection, setSelectedSection] = useState<HelpSection>('getting-started');
  const [searchQuery, setSearchQuery] = useState('');

  const sections: Array<{ id: HelpSection; title: string; icon: string }> = [
    { id: 'getting-started', title: '시작하기', icon: '🚀' },
    { id: 'basic-concepts', title: '기본 개념', icon: '📚' },
    { id: 'strategy-setup', title: '전략 설정', icon: '⚙️' },
    { id: 'indicators', title: '지표 가이드', icon: '📊' },
    { id: 'faq', title: 'FAQ', icon: '❓' }
  ];

  const articles: HelpArticle[] = [
    // 시작하기
    {
      id: 'account-setup',
      title: '계정 설정',
      section: 'getting-started',
      content: `
### Binance 계정 준비

1. **Binance 가입**: [Binance 공식 사이트](https://www.binance.com)에서 계정을 생성하세요
2. **KYC 인증**: 본인 인증을 완료하세요 (선물 거래 필수)
3. **2FA 설정**: 보안을 위해 2단계 인증(Google Authenticator)을 활성화하세요

### 주의사항
- 선물 거래는 현물 거래와 별도의 지갑을 사용합니다
- 초기에는 소액으로 시작하여 거래 방식에 익숙해지세요
      `
    },
    {
      id: 'api-key',
      title: 'API 키 등록',
      section: 'getting-started',
      content: `
### API 키 발급 방법

1. Binance 로그인 후 **프로필 > API Management** 이동
2. **Create API** 클릭
3. API 이름 입력 (예: "AutoTrading Bot")
4. 2FA 코드 입력 후 생성
5. **API Key**와 **Secret Key** 복사 (Secret은 한 번만 표시됩니다!)

### 권한 설정
선물 거래를 위해 다음 권한 활성화:
- ✅ Enable Reading (필수)
- ✅ Enable Futures (필수)
- ❌ Enable Withdrawals (보안상 비활성화 권장)

### 본 대시보드에 등록
1. 마이페이지로 이동
2. "Binance API 설정" 섹션에서 API Key/Secret 입력
3. 저장 후 연결 테스트

⚠️ **주의**: API Secret은 절대 공유하지 마세요!
      `
    },
    {
      id: 'first-strategy',
      title: '첫 전략 만들기',
      section: 'getting-started',
      content: `
### 간단한 첫 전략 예시

**목표**: BTC가 이동평균선 위에 있을 때 롱 진입, 5% 수익 시 익절

#### 1단계: 기본 설정
- 종목: BTCUSDT
- 레버리지: 5배 (초보자 권장)
- 매수 금액: 지갑의 10%

#### 2단계: 진입 조건
- 조건 그룹 1 (AND):
  - 종가 > MA(20)
  - RSI < 70 (과매수 회피)

#### 3단계: 청산 조건
- 익절: 수익률 > 5%
- 손절: 수익률 < -3%

#### 4단계: 백테스팅 (준비 중)
실전 투입 전 과거 데이터로 성과를 시뮬레이션하세요.

💡 **팁**: 처음에는 위저드를 사용하여 추천 설정을 받아보세요!
      `
    },

    // 기본 개념
    {
      id: 'leverage',
      title: '레버리지',
      section: 'basic-concepts',
      content: `
### 레버리지란?

적은 자금으로 큰 포지션을 거래할 수 있는 **배율**입니다.

#### 예시
- 10배 레버리지로 $100 투자
- → $1,000 규모의 포지션 거래 가능

#### 수익/손실 증폭
- **수익**: 1% 상승 시 → 10% 수익
- **손실**: 1% 하락 시 → 10% 손실

#### 레버리지 선택 가이드
- **초보자**: 3~5배 (안전)
- **중급자**: 5~10배 (균형)
- **고급자**: 10~20배 (공격)

⚠️ **경고**: 높은 레버리지는 청산 위험을 크게 증가시킵니다!
      `
    },
    {
      id: 'margin',
      title: '마진',
      section: 'basic-concepts',
      content: `
### 마진이란?

포지션을 유지하기 위해 **담보로 예치하는 금액**입니다.

#### 초기 마진 (Initial Margin)
포지션 진입 시 필요한 금액
- 계산: 포지션 크기 ÷ 레버리지
- 예: $1,000 포지션, 10배 레버리지 → $100 초기 마진

#### 유지 마진 (Maintenance Margin)
포지션을 유지하기 위한 최소 금액
- 유지 마진율 미달 시 청산됩니다
- Binance 기본: 0.4% ~ 5% (종목별 상이)

#### 마진 추가
손실이 발생하면 마진이 감소합니다.
- 추가 입금으로 마진 보충 가능
- 자동 추가 매수 기능 활용 가능
      `
    },
    {
      id: 'long-short',
      title: '롱/숏 포지션',
      section: 'basic-concepts',
      content: `
### 롱 (Long) 포지션

**"가격이 오를 것"**에 베팅
1. 낮은 가격에 매수
2. 높은 가격에 매도
3. 차익 실현

#### 예시
- $30,000에 BTC 롱 진입
- $31,000에 청산
- → $1,000 수익

### 숏 (Short) 포지션

**"가격이 내릴 것"**에 베팅
1. 높은 가격에 (빌려서) 매도
2. 낮은 가격에 매수
3. 차익 실현

#### 예시
- $30,000에 BTC 숏 진입
- $29,000에 청산
- → $1,000 수익

💡 **팁**: 상승장에는 롱, 하락장에는 숏, 변동성 장에는 헤지(양방향)을 고려하세요.
      `
    },
    {
      id: 'funding-rate',
      title: '펀딩비',
      section: 'basic-concepts',
      content: `
### 펀딩비(Funding Rate)란?

선물 가격과 현물 가격의 **균형을 유지하기 위한 수수료**입니다.

#### 작동 방식
- **양수(+)**: 롱 포지션이 숏 포지션에게 지급
  - 롱이 많을 때 (강세장)
- **음수(-)**: 숏 포지션이 롱 포지션에게 지급
  - 숏이 많을 때 (약세장)

#### 지급 시간
Binance: 8시간마다 (00:00, 08:00, 16:00 UTC)

#### 예시
- 펀딩비: +0.01%
- 포지션 크기: $10,000
- → 8시간마다 $1 지급 (롱 → 숏)

💡 **전략**: 펀딩비가 높을 때 반대 포지션을 취하여 수익을 얻을 수 있습니다.
      `
    },

    // 전략 설정
    {
      id: 'entry-conditions',
      title: '진입 조건',
      section: 'strategy-setup',
      content: `
### 진입 조건 설정

포지션을 **언제 시작할지** 정의합니다.

#### 조건 타입
1. **지표 조건**: MA, RSI, 볼린저밴드 등
2. **현재 상태 조건**: 수익률, 잔고, 포지션 크기 등

#### 조건 그룹
- **AND**: 모든 조건 만족 시 진입
  - 예: RSI > 70 **AND** 종가 > MA(20)
- **OR**: 하나 이상 만족 시 진입
  - 예: RSI > 70 **OR** 볼린저밴드 상단 돌파

#### 추천 패턴
**보수적 진입** (AND 활용):
- 종가 > MA(20)
- RSI < 70
- 볼린저밴드 중심선 위

**공격적 진입** (OR 활용):
- RSI > 70 OR
- 거래량 급증 OR
- 가격 급등
      `
    },
    {
      id: 'scale-in',
      title: '추가매수 (물타기)',
      section: 'strategy-setup',
      content: `
### 추가매수란?

포지션 진입 후 가격이 **불리하게 움직일 때** 추가로 매수하여 평균 단가를 낮추는 전략입니다.

#### 장점
- 평균 단가 하락
- 반등 시 더 빠른 손익분기

#### 위험
- 손실 확대 가능
- 청산 위험 증가

#### 안전한 추가매수 설정
1. **횟수 제한**: 최대 2~3회
2. **조건 설정**:
   - 현재 수익률 < -3%
   - AND 매수 횟수 < 3회
3. **청산 기준 명확히**:
   - 총 손실 -10% 시 강제 청산

⚠️ **주의**: 무분별한 물타기는 손실을 확대시킬 수 있습니다. 항상 손절 기준을 설정하세요.
      `
    },
    {
      id: 'stop-loss-take-profit',
      title: '손절/익절',
      section: 'strategy-setup',
      content: `
### 손절 (Stop Loss)

**손실을 제한**하는 가장 중요한 리스크 관리 도구입니다.

#### 손절 기준 설정
- **고정 비율**: 수익률 < -5%
- **ATR 기반**: 변동성 고려
- **시간 기반**: 진입 후 24시간 경과 AND 손실

#### 초보자 권장
- 레버리지 5배: -3% 손절
- 레버리지 10배: -2% 손절
- 레버리지 20배: -1% 손절

### 익절 (Take Profit)

**수익을 확정**하는 전략입니다.

#### 익절 전략
1. **고정 익절**: 수익률 > 5%
2. **부분 익절**:
   - 3% 달성 시 50% 청산
   - 5% 달성 시 나머지 청산
3. **트레일링 스톱**: 최고점 대비 -2% 하락 시 청산

💡 **팁**: "손절은 빠르게, 익절은 천천히"
      `
    },
    {
      id: 'hedge-mode',
      title: '헤지 모드',
      section: 'strategy-setup',
      content: `
### 헤지란?

**양방향 포지션**을 동시에 보유하여 리스크를 헤지하는 전략입니다.

#### 사용 시나리오

**1. 롱 포지션 보호**
- 롱 포지션 보유 중
- 단기 하락 예상
- → 숏 포지션으로 헤지

**2. 마진 증가 시 반대 포지션**
- 초기 마진 비율 > 150%
- → 수익의 일부를 반대 포지션으로 헤지

#### 설정 예시
진입 조건:
- 롱 포지션: 종가 > MA(20)
- 숏 포지션: 종가 < MA(20)

헤지 조건:
- 롱 보유 중 AND RSI > 80
- → 숏 포지션 진입 (롱은 유지)

⚠️ **주의**:
- 헤지는 고급 전략입니다
- 펀딩비가 양쪽에서 발생할 수 있습니다
- Binance는 Hedge Mode 활성화 필요
      `
    },

    // 지표 가이드
    {
      id: 'indicator-ma',
      title: '이동평균선 (MA)',
      section: 'indicators',
      content: `
### 이동평균선(Moving Average)이란?

일정 기간의 **평균 가격**을 선으로 연결한 지표입니다.

#### 종류
- **SMA** (Simple MA): 단순 평균
- **EMA** (Exponential MA): 최근 가격에 가중치 (더 민감)

#### 주요 기간
- **MA(20)**: 단기 추세
- **MA(50)**: 중기 추세
- **MA(200)**: 장기 추세

#### 활용법

**1. 추세 확인**
- 가격 > MA → 상승 추세
- 가격 < MA → 하락 추세

**2. 골든크로스 / 데드크로스**
- MA(20) > MA(50) 돌파 → 매수 신호
- MA(20) < MA(50) 돌파 → 매도 신호

**3. 지지/저항선**
- MA 근처에서 반등 또는 반락

#### 전략 예시
```
진입 (롱):
- 종가 > MA(20)
- MA(20) > MA(50)

청산:
- 종가 < MA(20)
```
      `
    },
    {
      id: 'indicator-rsi',
      title: 'RSI (상대강도지수)',
      section: 'indicators',
      content: `
### RSI(Relative Strength Index)란?

가격의 **과매수/과매도** 상태를 나타내는 모멘텀 지표입니다.

#### 값의 의미
- **0~100** 사이 값
- **70 이상**: 과매수 (가격 고점, 조정 가능성)
- **30 이하**: 과매도 (가격 저점, 반등 가능성)
- **50 근처**: 중립

#### 기간 설정
- **RSI(14)**: 가장 일반적 (14일/14캔들)
- **RSI(7)**: 단기 (더 민감)
- **RSI(21)**: 장기 (더 완만)

#### 활용법

**1. 과매수/과매도 판단**
```
숏 진입:
- RSI > 70 (과매수)

롱 진입:
- RSI < 30 (과매도)
```

**2. 다이버전스**
- 가격은 상승하는데 RSI는 하락 → 약세 신호
- 가격은 하락하는데 RSI는 상승 → 강세 신호

**3. 중심선 돌파**
- RSI > 50 → 강세 전환
- RSI < 50 → 약세 전환

⚠️ **주의**: RSI만으로 판단하지 말고 다른 지표와 조합하세요.
      `
    },
    {
      id: 'indicator-bb',
      title: '볼린저밴드',
      section: 'indicators',
      content: `
### 볼린저밴드(Bollinger Bands)란?

가격의 **변동성**을 표시하는 밴드 지표입니다.

#### 구성 요소
- **중심선**: MA(20)
- **상단밴드**: MA(20) + 2 × 표준편차
- **하단밴드**: MA(20) - 2 × 표준편차

#### 값의 의미
- **밴드 폭 확대**: 변동성 증가
- **밴드 폭 축소**: 변동성 감소 (큰 움직임 임박)
- **가격이 밴드 터치**: 과매수/과매도

#### 활용법

**1. 밴드 돌파 전략**
```
롱 진입:
- 가격 < 볼린저밴드 하단 (과매도)

숏 진입:
- 가격 > 볼린저밴드 상단 (과매수)
```

**2. 밴드 스퀴즈**
- 밴드 폭이 좁아짐 → 큰 움직임 임박
- 돌파 방향으로 진입

**3. 평균 회귀**
- 상단 터치 시 중심선으로 회귀 예상
- 하단 터치 시 중심선으로 회귀 예상

💡 **팁**: RSI와 조합하면 더 정확한 신호를 얻을 수 있습니다.
      `
    },
    {
      id: 'indicator-macd',
      title: 'MACD',
      section: 'indicators',
      content: `
### MACD(Moving Average Convergence Divergence)란?

두 이동평균선의 **차이를 이용한 추세 추종 지표**입니다.

#### 구성 요소
- **MACD선**: EMA(12) - EMA(26)
- **시그널선**: MACD의 EMA(9)
- **히스토그램**: MACD - 시그널

#### 값의 의미
- **MACD > 0**: 단기 평균 > 장기 평균 (강세)
- **MACD < 0**: 단기 평균 < 장기 평균 (약세)

#### 활용법

**1. 골든크로스 / 데드크로스**
```
롱 진입:
- MACD선 > 시그널선 돌파

숏 진입:
- MACD선 < 시그널선 돌파
```

**2. 제로라인 크로스**
- MACD > 0 돌파 → 강세 전환
- MACD < 0 돌파 → 약세 전환

**3. 다이버전스**
- 가격 신고점 but MACD 하락 → 약세 다이버전스
- 가격 신저점 but MACD 상승 → 강세 다이버전스

**4. 히스토그램**
- 히스토그램 증가 → 추세 강화
- 히스토그램 감소 → 추세 약화

💡 **팁**: MACD는 추세 추종 지표로, 횡보장에서는 잘못된 신호가 많습니다.
      `
    },

    // FAQ
    {
      id: 'faq-common',
      title: '자주 묻는 질문',
      section: 'faq',
      content: `
### Q1. 얼마의 자금으로 시작해야 하나요?
**A**: 최소 $100~$500을 권장합니다. 처음에는 손실을 학습 비용으로 생각하고 소액으로 시작하세요.

### Q2. 레버리지는 얼마가 적당한가요?
**A**:
- 초보자: 3~5배
- 중급자: 5~10배
- 고급자: 10~20배 이하

높은 레버리지는 높은 리스크를 의미합니다.

### Q3. 자동매매가 안전한가요?
**A**: 자동매매는 도구일 뿐입니다.
- ✅ 장점: 감정 배제, 24시간 감시
- ❌ 단점: 예상 못한 시장 변동, 설정 오류

반드시 백테스팅과 소액 테스트를 거쳐야 합니다.

### Q4. 펀딩비가 너무 높아요. 어떻게 하나요?
**A**:
1. 펀딩비 지급 시간 전에 포지션 청산
2. 반대 포지션으로 전환
3. 다른 종목 선택

펀딩비는 시장 상황에 따라 변동됩니다.

### Q5. 청산당했어요. 왜 그런가요?
**A**: 청산은 마진이 유지 마진율 이하로 떨어질 때 발생합니다.
- 높은 레버리지 사용 시 청산 가격이 진입가에 가까워집니다
- 손절 설정으로 청산 전 포지션 정리를 권장합니다
      `
    },
    {
      id: 'faq-errors',
      title: '오류 해결',
      section: 'faq',
      content: `
### "API Key/Secret이 잘못되었습니다"
**해결**:
1. API 키 재확인 (복사 시 공백 포함 여부)
2. Binance에서 Futures 권한 활성화 확인
3. IP 제한이 있다면 현재 IP 추가
4. API 키 재발급

### "주문 실패: Insufficient balance"
**해결**:
1. 선물 지갑에 충분한 잔고 확인
2. 현물 지갑 → 선물 지갑으로 자금 이동
3. 레버리지를 낮추거나 매수 금액 감소

### "Position mode must be HEDGE"
**해결**:
Binance에서 Hedge Mode 활성화:
1. Binance 선물 거래 화면
2. 우측 상단 설정
3. "Hedge Mode" 선택

### "주문이 체결되지 않습니다"
**가능한 원인**:
1. 유동성 부족 (마켓 오더로 변경 고려)
2. 가격 제한에 걸림 (limit 주문 가격 확인)
3. 종목 거래 정지 (Binance 공지 확인)

### "백테스팅이 작동하지 않습니다"
**A**: 백테스팅 기능은 현재 개발 중입니다. Phase 4에서 출시 예정입니다.
      `
    },
    {
      id: 'faq-glossary',
      title: '용어 사전',
      section: 'faq',
      content: `
### 선물 거래 용어

**레버리지 (Leverage)**: 적은 자금으로 큰 포지션을 거래할 수 있는 배율

**마진 (Margin)**: 포지션을 유지하기 위해 예치하는 담보 금액

**롱 (Long)**: 가격 상승에 베팅하는 매수 포지션

**숏 (Short)**: 가격 하락에 베팅하는 매도 포지션

**청산 (Liquidation)**: 마진 부족으로 강제 포지션 청산

**펀딩비 (Funding Rate)**: 선물-현물 가격 균형을 위한 주기적 수수료

**미실현 손익 (Unrealized PnL)**: 현재 포지션의 평가 손익 (청산 전)

**실현 손익 (Realized PnL)**: 청산 완료된 포지션의 확정 손익

---

### 기술적 분석 용어

**이동평균선 (MA)**: 일정 기간 평균 가격을 선으로 연결한 지표

**RSI**: 과매수/과매도 상태를 나타내는 모멘텀 지표 (0~100)

**볼린저밴드**: 가격 변동성을 밴드로 표시한 지표

**MACD**: 두 이동평균선의 차이를 이용한 추세 지표

**골든크로스**: 단기 MA가 장기 MA를 상향 돌파 (매수 신호)

**데드크로스**: 단기 MA가 장기 MA를 하향 돌파 (매도 신호)

**다이버전스**: 가격과 지표의 움직임이 반대 (추세 전환 신호)

---

### 주문 용어

**시장가 주문 (Market Order)**: 현재 시장 가격에 즉시 체결

**지정가 주문 (Limit Order)**: 지정한 가격에 도달 시 체결

**손절 주문 (Stop Loss)**: 손실 제한을 위한 자동 청산 주문

**익절 주문 (Take Profit)**: 수익 실현을 위한 자동 청산 주문

**물타기 (Scale-in)**: 불리한 가격에 추가 매수하여 평단가 낮추기
      `
    }
  ];

  const filteredArticles = articles.filter(
    (article) =>
      article.section === selectedSection &&
      (searchQuery === '' ||
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* 헤더 */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-zinc-400 hover:text-zinc-300 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold text-zinc-100">도움말 센터</h1>
            </div>
            {/* 검색 */}
            <div className="relative w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="검색..."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 pl-10 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 사이드바 */}
          <aside className="lg:col-span-1">
            <nav className="space-y-2 sticky top-24">
              {sections.map((section) => {
                const count = articles.filter((a) => a.section === section.id).length;
                return (
                  <button
                    key={section.id}
                    onClick={() => {
                      setSelectedSection(section.id);
                      setSearchQuery('');
                    }}
                    className={`
                      w-full text-left rounded-lg px-4 py-3 transition-colors
                      ${selectedSection === section.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{section.icon}</span>
                        <span className="font-medium">{section.title}</span>
                      </div>
                      <span className={`text-xs ${selectedSection === section.id ? 'text-blue-200' : 'text-zinc-500'}`}>
                        {count}
                      </span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* 컨텐츠 */}
          <main className="lg:col-span-3">
            <div className="space-y-6">
              {filteredArticles.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-zinc-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-zinc-400">검색 결과가 없습니다</p>
                </div>
              ) : (
                filteredArticles.map((article) => (
                  <article key={article.id} className="rounded-lg border border-zinc-700 bg-zinc-800/30 p-6">
                    <h2 className="text-xl font-bold text-zinc-100 mb-4">{article.title}</h2>
                    <div className="prose prose-invert prose-sm max-w-none">
                      {article.content.split('\n').map((line, idx) => {
                        // 마크다운 간단 파싱
                        if (line.startsWith('### ')) {
                          return (
                            <h3 key={idx} className="text-lg font-semibold text-zinc-200 mt-6 mb-3">
                              {line.substring(4)}
                            </h3>
                          );
                        }
                        if (line.startsWith('#### ')) {
                          return (
                            <h4 key={idx} className="text-base font-semibold text-zinc-300 mt-4 mb-2">
                              {line.substring(5)}
                            </h4>
                          );
                        }
                        if (line.startsWith('- ')) {
                          return (
                            <li key={idx} className="text-sm text-zinc-400 ml-4">
                              {line.substring(2)}
                            </li>
                          );
                        }
                        if (line.startsWith('**') && line.endsWith('**')) {
                          return (
                            <p key={idx} className="text-sm font-semibold text-zinc-300 mt-2">
                              {line.substring(2, line.length - 2)}
                            </p>
                          );
                        }
                        if (line.startsWith('```')) {
                          return null; // 코드 블록은 간단히 무시
                        }
                        if (line.trim() === '') {
                          return <div key={idx} className="h-2" />;
                        }
                        return (
                          <p key={idx} className="text-sm text-zinc-400 leading-relaxed">
                            {line}
                          </p>
                        );
                      })}
                    </div>
                  </article>
                ))
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
