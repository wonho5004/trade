# 인증 및 권한 구조 개발 계획

## 추진 배경
- 대시보드 접근을 로그인 성공 사용자로 제한하고, 추가로 관리자·시스템 관리자 전용 화면을 제공해야 함.
- 현재 애플리케이션은 공개 라우트로 구성돼 있으며 인증/인가 로직이 전무함.

## 요구 사항 정리
- 로그인 페이지(이메일/비밀번호 기반)와 비밀번호 재설정 플로우 제공.
- 인증 성공 시 세션 유지 및 대시보드(`/dashboard`) 접근 허용.
- 관리자 페이지(`/admin`): `admin` 이상 권한만 접근.
- 시스템 관리자 페이지(`/ops` 가칭): `sys_admin` 권한만 접근.
- 미인증 접근 시 로그인 페이지로, 권한 부족 시 403 화면으로 리다이렉트.

## 권한 모델 및 저장 구조
- Supabase Auth 사용자(`auth.users`)를 기본으로 활용.
- 커스텀 프로필 테이블 예시:
  - `profiles(id uuid pk, role text, display_name text, created_at timestamptz)`
  - `role` 값: `user`, `admin`, `sys_admin`.
- 서버 렌더링 시 RLS 적용을 위해 Supabase Row Level Security 활성화 및 정책 수립.

## Supabase 연동 준비
- 새 Supabase 프로젝트 생성 후 서비스 롤 키와 익명 키 확보.
- 환경 변수 추가:  
  - `NEXT_PUBLIC_SUPABASE_URL`  
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
  - `SUPABASE_SERVICE_ROLE_KEY` (서버 전용)
- 서버 컴포넌트/Route Handler에서 사용할 Supabase 클라이언트 래퍼 작성(`src/lib/supabase/server.ts` 가칭).
- 브라우저 클라이언트용 헬퍼(`src/lib/supabase/client.ts`)로 로그인/로그아웃/세션 조회 기능 제공.

## 페이지 및 라우팅 설계
- `src/app/(auth)/login/page.tsx`: 로그인 UI, Supabase Auth signInWithPassword 호출.
- `src/app/(auth)/reset-password` 등 비밀번호 재설정 토큰 처리 라우트.
- 보호 라우트 구성:
  - 미들웨어(`middleware.ts`)에서 Supabase 쿠키 기반 세션 검증 후 역할에 따라 분기.
  - `SupabaseClient.auth.getUser()` 결과로 프로필 테이블 조회, `role`을 `request` 컨텍스트에 주입.
- 역할별 레이아웃:
  - `src/app/dashboard/layout.tsx`: 기본 사용자 이상 허용.
  - `src/app/admin/layout.tsx`: `admin` 이상 권한 검사.
  - `src/app/ops/layout.tsx`: `sys_admin`만 허용.

## 추가 고려 사항
- 로컬 개발 시 `supabase start` 혹은 프로젝트 제공 Docker 스택으로 로컬 스키마 유지.
- 테스팅:  
  - 플레이스홀더 e2e 시나리오(로그인 → 접근 권한 확인) 작성.  
  - 서버 유닛테스트에서 역할 분기 로직 검증.
- 문서화: 새 엔트리 포인트 및 환경 변수는 `docs/` 내 운영 문서와 README에 추후 반영.

## 차후 단계
1. Supabase 프로젝트 및 로컬 환경 변수 세팅.
2. 프로필 테이블 및 RLS 정책 마이그레이션 추가.
3. Supabase 클라이언트 래퍼 및 미들웨어 구현.
4. 로그인 UI/흐름 개발 후 관리자/시스템 관리자 라우트 구축.
5. 테스트 및 배포 파이프라인에서 환경 변수 주입 검증.
