# POD (Project Overview Document)
## Binance-Style Cryptocurrency Trading Dashboard

### 🏗️ 프로젝트 아키텍처

#### 전체 시스템 구조
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   External      │
│   (Next.js)     │◄──►│   (API Routes)  │◄──►│   Services      │
│                 │    │                 │    │                 │
│ - Chart UI      │    │ - Trading Logic │    │ - Binance API   │
│ - Control Panel │    │ - Data Analysis │    │ - WebSocket     │
│ - User Mgmt     │    │ - Auth System   │    │ - Supabase      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

#### 기술 스택 상세

**Frontend Stack**
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: 
  - React Query (서버 상태)
  - Zustand (클라이언트 상태)
- **Chart Library**: [선택 예정 - 고급 드로잉 기능 필수]
- **Real-time**: WebSocket + Server-Sent Events

**Backend Stack**
- **API**: Next.js API Routes
- **Trading**: CCXT (크로스 플랫폼 거래 라이브러리)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime

**Data Analysis Stack**
- **Language**: Python
- **Libraries**: 
  - pandas (데이터 분석)
  - numpy (수치 계산)
  - scipy (통계 분석)
  - matplotlib/plotly (시각화)
- **Integration**: Python subprocess 또는 API 호출

**Infrastructure**
- **Hosting**: Vercel (Frontend + API)
- **Database**: Supabase (무료 플랜)
- **CDN**: Vercel Edge Network
- **Monitoring**: [선택 예정]

### 📁 프로젝트 구조

```
binance-dash/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # 인증 관련 페이지
│   │   ├── dashboard/         # 메인 대시보드
│   │   ├── trading/           # 거래 관련 페이지
│   │   ├── analysis/          # 분석 페이지
│   │   └── api/               # API Routes
│   ├── components/            # 재사용 컴포넌트
│   │   ├── chart/             # 차트 관련 컴포넌트
│   │   ├── trading/           # 거래 관련 컴포넌트
│   │   ├── ui/                # shadcn/ui 컴포넌트
│   │   └── common/            # 공통 컴포넌트
│   ├── lib/                   # 유틸리티 함수
│   │   ├── trading/           # 거래 로직
│   │   ├── analysis/          # 분석 로직
│   │   ├── chart/             # 차트 유틸리티
│   │   └── utils/             # 공통 유틸리티
│   ├── hooks/                 # 커스텀 훅
│   ├── stores/                # Zustand 스토어
│   └── types/                 # TypeScript 타입 정의
├── docs/                      # 문서
├── public/                    # 정적 파일
└── python/                    # Python 데이터 분석 스크립트
    ├── analysis/              # 분석 모듈
    ├── backtesting/           # 백테스팅
    └── indicators/            # 커스텀 지표
```

### 🔄 데이터 플로우

#### 실시간 데이터 플로우
```
Binance WebSocket → Next.js API → Supabase → Frontend
```

#### 거래 플로우
```
Frontend → Next.js API → CCXT → Binance API → Database → Frontend
```

#### 분석 플로우
```
Database → Python Script → Analysis Results → Frontend Visualization
```

### 🗄️ 데이터베이스 설계

#### 주요 테이블
- **users**: 사용자 정보
- **api_keys**: API 키 관리 (암호화)
- **trading_logs**: 거래 기록
- **positions**: 포지션 정보
- **strategies**: 매매 전략
- **backtest_results**: 백테스팅 결과
- **chart_settings**: 차트 설정
- **notifications**: 알림 설정

### 🔐 보안 설계

#### API 키 관리
- 클라이언트 사이드 저장 금지
- 서버 사이드 암호화 저장
- 권한별 API 키 분리

#### 인증 시스템
- Supabase Auth 활용
- JWT 토큰 기반
- 2FA 지원 (향후)

#### 데이터 보호
- HTTPS 통신
- 입력 데이터 검증
- SQL Injection 방지

### 📊 차트 라이브러리 후보

#### 1. TradingView Charting Library
- **장점**: 바이낸스와 동일한 차트, 고급 드로잉 기능
- **단점**: 라이선스 필요 (상업적 사용)
- **드로잉 기능**: ⭐⭐⭐⭐⭐

#### 2. klinecharts
- **장점**: 무료, 금융차트 특화, 오버레이 지원
- **단점**: 드로잉 기능 제한적
- **드로잉 기능**: ⭐⭐⭐

#### 3. Chart.js + Plugins
- **장점**: 무료, 플러그인 생태계
- **단점**: 고급 드로잉 구현 복잡
- **드로잉 기능**: ⭐⭐

#### 4. D3.js + Custom
- **장점**: 완전한 커스터마이징
- **단점**: 개발 시간 오래 걸림
- **드로잉 기능**: ⭐⭐⭐⭐⭐

### 🚀 개발 단계

#### Phase 1: 기반 구축 (1-2주)
- [ ] Next.js 프로젝트 초기화
- [ ] 기본 UI 컴포넌트 구축
- [ ] Supabase 연동
- [ ] 기본 인증 시스템

#### Phase 2: 차트 시스템 (2-3주)
- [ ] 차트 라이브러리 선택 및 구현
- [ ] 기본 캔들스틱 차트
- [ ] 기술적 지표 구현
- [ ] 드로잉 기능 구현

#### Phase 3: 거래 기능 (2-3주)
- [ ] CCXT 연동
- [ ] 수동 거래 기능
- [ ] 포지션 관리
- [ ] 실시간 데이터 연동

#### Phase 4: 자동매매 (3-4주)
- [ ] 전략 엔진 구현
- [ ] 백테스팅 시스템
- [ ] 자동매매 컨트롤 패널
- [ ] Python 분석 연동

#### Phase 5: 고급 기능 (2-3주)
- [ ] 투자 결과 시각화
- [ ] 리포트 시스템
- [ ] 알림 시스템
- [ ] 권한 관리

### ✅ 2024-XX-XX 현재 완료 항목
- 차트 컨트롤 패널 및 지표 설정 UI/상태 관리
- 드로잉(조건 강조) 로직 + Lightweight Charts 마커 표시
- MA/Bollinger/RSI/MACD/DMI 기본 설정 및 리셋/가시성 제어
- Zustand `persist` 기반 로컬 설정 영속화 및 마이그레이션
- 지표별 기본값 리셋 시 다른 지표에 영향 없는 구조 확립

### 📅 향후 상세 개발 계획
| 일정 | 작업 | 비고 |
|------|------|------|
| 2024 Q4 W2 | 드로잉/지표 설정 서버 저장 API 초안, Auth 와이어프레임 작성 | Supabase 연동 사전 조사 |
| 2024 Q4 W3 | 수동 거래 패널 UX, 주문/포지션 데이터 모델 설계, CCXT 모의 호출 | 거래 흐름 POC |
| 2024 Q4 W4 | 실시간 시세(WebSocket) 안정화, 드로잉/알림 포맷 정규화 | reconnect, debounce |
| 2025 Q1 | 인증/사용자별 설정 저장, 백테스트/전략 패널 프로토타입, Python 분석 파이프라인 | 서버-파이썬 연계 |
| 2025 Q1 말 | 포지션/거래 로그 UI, Supabase 스키마 1차 적용, 알림 트리거 설계 | |

### 🔧 개발 환경 설정

#### 필수 도구
- **Node.js**: 20+ LTS
- **Python**: 3.11+
- **Git**: 버전 관리
- **VS Code**: 개발 환경

#### 개발 명령어
```bash
# 개발 서버 시작
npm run dev

# 빌드
npm run build

# Python 분석 스크립트 실행
python python/analysis/main.py
```

### 📋 품질 관리

#### 코드 품질
- **ESLint**: 코드 스타일 검사
- **Prettier**: 코드 포맷팅
- **TypeScript**: 타입 안정성
- **Husky**: Git 훅 관리

#### 테스트
- **Jest**: 단위 테스트
- **React Testing Library**: 컴포넌트 테스트
- **Cypress**: E2E 테스트 (향후)

### 🚨 위험 요소 및 대응

#### 기술적 위험
- **차트 라이브러리**: 고급 드로잉 기능 구현 어려움
- **대응**: 여러 라이브러리 프로토타이핑 후 선택

#### 비즈니스 위험
- **API 제한**: 바이낸스 API 호출 제한
- **대응**: 캐싱 및 요청 최적화

#### 보안 위험
- **API 키 노출**: 클라이언트 사이드 저장
- **대응**: 서버 사이드 암호화 저장

---
*이 문서는 프로젝트의 기술적 설계 기준이 되며, 변경 시 반드시 팀 논의 후 업데이트합니다.*
