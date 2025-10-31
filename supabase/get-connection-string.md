# Supabase Database Connection String 가져오기

## 방법 1: Supabase Dashboard에서 확인

1. https://app.supabase.com 접속
2. 프로젝트 선택 (nraexfuayavekflwbnmk)
3. **Settings** (왼쪽 하단 톱니바퀴 아이콘) 클릭
4. **Database** 메뉴 선택
5. **Connection string** 섹션에서:
   - **Connection pooling** 체크박스 **해제**
   - **URI** 탭 선택
   - 연결 문자열 복사 (예시: `postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@...`)
   - `[YOUR-PASSWORD]`를 실제 비밀번호로 교체: `2!_XVSVxM-2tdES`

## 방법 2: 터미널에서 직접 실행

Connection string을 얻은 후:

```bash
# 1. Connection string을 환경 변수로 설정
export DATABASE_URL="여기에_복사한_connection_string_붙여넣기"

# 2. 마이그레이션 실행
psql "$DATABASE_URL" -f supabase/migrations/fix-migration.sql
```

## 또는 그냥 Dashboard 사용 (더 간단함!)

**추천**: psql보다 Supabase Dashboard의 SQL Editor가 더 간단합니다:

1. https://app.supabase.com → 프로젝트 선택
2. **SQL Editor** 클릭
3. **New query** 클릭
4. `supabase/migrations/fix-migration.sql` 파일 내용 복사
5. 붙여넣기 후 **Run** 클릭

이 방법이 네트워크 문제 없이 가장 확실합니다!
