# Supabase Migrations

이 폴더에는 데이터베이스 마이그레이션 SQL 파일들이 포함되어 있습니다.

## 마이그레이션 실행 방법

### 방법 1: Supabase Dashboard 사용

1. [Supabase Dashboard](https://app.supabase.com) 접속
2. 프로젝트 선택
3. 왼쪽 메뉴에서 **SQL Editor** 클릭
4. **New query** 클릭
5. 마이그레이션 파일의 내용을 복사하여 붙여넣기
6. **Run** 버튼 클릭

### 방법 2: Supabase CLI 사용 (권장)

```bash
# Supabase CLI 설치 (한 번만 실행)
npm install -g supabase

# 프로젝트 연결
supabase link --project-ref YOUR_PROJECT_REF

# 마이그레이션 실행
supabase db push
```

## 마이그레이션 목록

### 20241025_create_strategies_table.sql

**설명**: 자동매매 전략 저장을 위한 `strategies` 테이블 생성

**포함 내용**:
- `strategies` 테이블 생성
- 인덱스 생성 (user_id, is_active, created_at)
- RLS (Row Level Security) 정책 설정
- `updated_at` 자동 업데이트 트리거

**실행 순서**: 1

**필수 여부**: ✅ 필수 (전략 저장/불러오기 기능에 필요)

---

## 마이그레이션 실행 확인

마이그레이션이 성공적으로 실행되었는지 확인하려면:

```sql
-- strategies 테이블 존재 확인
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'strategies';

-- RLS 정책 확인
SELECT * FROM pg_policies WHERE tablename = 'strategies';
```

## 롤백

마이그레이션을 롤백하려면:

```sql
DROP TABLE IF EXISTS strategies CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
```

⚠️ **주의**: 롤백 시 모든 전략 데이터가 삭제됩니다.

---

## 문제 해결

### 오류: "permission denied"
- Supabase 대시보드에서 실행하거나 올바른 권한이 있는 계정으로 실행하세요.

### 오류: "relation already exists"
- 테이블이 이미 존재합니다. 롤백 후 다시 실행하세요.

### 오류: "function gen_random_uuid() does not exist"
- PostgreSQL 13 이상을 사용 중인지 확인하세요.
- 또는 `uuid_generate_v4()` 함수를 사용하도록 SQL을 수정하세요.
