# Engine State Table 설정 가이드

엔진 시작 버튼 상태가 유지되도록 `engine_state` 테이블을 생성해야 합니다.

## 방법 1: Supabase SQL Editor 사용 (권장)

1. **Supabase Dashboard** 접속
   - https://supabase.com/dashboard

2. **SQL Editor** 메뉴로 이동

3. **New query** 클릭

4. 아래 SQL을 붙여넣고 **Run** 클릭:

```sql
-- Create engine_state table
CREATE TABLE IF NOT EXISTS engine_state (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  is_running BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default record
INSERT INTO engine_state (id, is_running)
VALUES ('singleton', false)
ON CONFLICT (id) DO NOTHING;

-- Verify
SELECT * FROM engine_state;
```

5. **결과 확인**:
   ```
   id         | is_running | started_at | stopped_at | updated_at
   -----------|------------|------------|------------|-----------
   singleton  | false      | null       | null       | 2025-10-25...
   ```

## 방법 2: 마이그레이션 파일 실행

```bash
# Supabase CLI 설치 (없는 경우)
npm install -g supabase

# 마이그레이션 실행
supabase db push supabase/migrations/20250125_create_engine_state_table.sql
```

## 테이블 생성 후

브라우저에서 모니터링 페이지를 새로고침하면:
- ✅ "엔진 시작" 버튼 클릭 시 상태가 DB에 저장됨
- ✅ 페이지 새로고침 후에도 상태 유지
- ✅ "엔진 시작" 버튼이 다시 활성화되지 않음

## ⚠️ 중요 사항

**서버리스 환경 제약**:
- 엔진 상태는 DB에 저장되지만, 실제 평가 루프는 실행되지 않습니다
- API 요청이 끝나면 `setInterval`이 중단됩니다
- **Production 배포 시 별도 워커 프로세스 필요**

## Production 배포 옵션

1. **별도 Node.js 서버** (Railway, Render, etc.)
   - PM2로 프로세스 관리
   - 24/7 실행

2. **Scheduled Jobs** (Vercel Cron, AWS Lambda + EventBridge)
   - 1분마다 평가 실행
   - 비용 효율적

3. **WebSocket 서버**
   - Socket.io 등 사용
   - 실시간 양방향 통신

현재는 **UI 상태 관리만 작동**합니다.
