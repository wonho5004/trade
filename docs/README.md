# 프로젝트 문서

Binance-Style Cryptocurrency Trading Dashboard 프로젝트의 공식 문서입니다.

## 📚 문서 구조

### 필수 문서

1. **[ROADMAP.md](./ROADMAP.md)** - 프로젝트 로드맵 및 진행 상황
   - 전체 프로젝트 개요 및 목표
   - 완료된 기능 (Phase 1~5)
   - 향후 계획 (Phase 6~8)
   - 기술 부채 및 개선 사항
   - 성능 요구사항 및 보안 체크리스트

2. **[DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)** - 개발 가이드
   - 프로젝트 구조
   - 코딩 컨벤션 (TypeScript, React)
   - 상태 관리 패턴 (Zustand)
   - 인디케이터 개발 가이드
   - 자동매매 개발 가이드
   - 데이터베이스 스키마
   - 테스트 가이드
   - API Routes 개발
   - 보안 체크리스트

### 추가 문서

3. **[../CLAUDE.md](../CLAUDE.md)** - Claude Code를 위한 가이드
   - 프로젝트 아키텍처 상세
   - 개발 명령어
   - 주요 디렉토리 설명
   - 일반적인 작업 가이드
   - 문제 해결

### 보관 문서

4. **[archived/](./archived/)** - 보관된 초기 문서
   - PRD.md (제품 요구사항)
   - POD.md (프로젝트 개요)
   - indicatorctl.md (지표 개발 가이드)
   - auth-roadmap.md (인증 로드맵)

---

## 🚀 시작하기

### 새로운 개발자

1. [ROADMAP.md](./ROADMAP.md)를 먼저 읽어 프로젝트 전체 흐름 파악
2. [../CLAUDE.md](../CLAUDE.md)에서 기술 스택 및 아키텍처 이해
3. [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)로 개발 컨벤션 학습

### 기능 개발

- 새 지표 추가: [DEVELOPMENT_GUIDE.md - 인디케이터 개발](./DEVELOPMENT_GUIDE.md#-인디케이터-개발-가이드)
- 자동매매 조건 추가: [DEVELOPMENT_GUIDE.md - 자동매매 개발](./DEVELOPMENT_GUIDE.md#-자동매매-개발-가이드)
- API 라우트 추가: [DEVELOPMENT_GUIDE.md - API Routes](./DEVELOPMENT_GUIDE.md#-api-routes-개발)

### 현재 진행 상황 확인

[ROADMAP.md](./ROADMAP.md)의 다음 섹션 참조:
- ✅ 완료된 기능 (Phase 1~5)
- 📅 향후 계획 (Phase 6~8)

---

## 📝 문서 업데이트 가이드

### 언제 업데이트하나요?

- **ROADMAP.md**: 주요 기능 완료, Phase 변경, 새로운 계획 추가 시
- **DEVELOPMENT_GUIDE.md**: 새로운 패턴 도입, 컨벤션 변경 시
- **CLAUDE.md**: 아키텍처 변경, 주요 디렉토리 추가 시

### 업데이트 방법

1. 해당 문서 수정
2. 상단의 "최종 업데이트" 날짜 변경
3. 커밋 메시지: `docs: update [문서명] - [변경 내용]`

---

## 🔍 빠른 참조

| 질문 | 참조 문서 | 섹션 |
|------|-----------|------|
| 프로젝트가 뭐하는 거지? | [ROADMAP.md](./ROADMAP.md) | 프로젝트 개요 |
| 어디까지 개발됐지? | [ROADMAP.md](./ROADMAP.md) | 완료된 기능 |
| 다음에 뭘 개발하지? | [ROADMAP.md](./ROADMAP.md) | 진행 중 / 향후 계획 |
| 어떻게 코드 작성하지? | [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) | 코딩 컨벤션 |
| Zustand 어떻게 쓰지? | [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) | 상태 관리 |
| 새 지표 어떻게 추가하지? | [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) | 인디케이터 개발 |
| 폴더 구조가 어떻게 되지? | [../CLAUDE.md](../CLAUDE.md) | Key Directories |
| npm 명령어는 뭐가 있지? | [../CLAUDE.md](../CLAUDE.md) | Development Commands |
| 테스트는 어떻게 작성하지? | [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) | 테스트 가이드 |

---

## 💡 추가 리소스

- [프로젝트 README](../README.md) - 프로젝트 소개 (있는 경우)
- [package.json](../package.json) - 의존성 및 스크립트
- [tsconfig.json](../tsconfig.json) - TypeScript 설정

---

*문서에 대한 피드백이나 개선 사항이 있다면 이슈를 생성하거나 PR을 제출해주세요.*
