#!/bin/bash

# Supabase 마이그레이션 실행 스크립트
#
# 사용법:
# 1. Supabase 프로젝트의 DATABASE_URL을 설정
# 2. chmod +x supabase/run-migrations.sh
# 3. ./supabase/run-migrations.sh

set -e  # 에러 발생 시 중단

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Supabase 마이그레이션 실행${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# DATABASE_URL 확인
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}ERROR: DATABASE_URL 환경 변수가 설정되지 않았습니다.${NC}"
  echo ""
  echo "Supabase 프로젝트 설정에서 DATABASE_URL을 찾으려면:"
  echo "1. https://app.supabase.com 에서 프로젝트 선택"
  echo "2. Settings > Database > Connection string"
  echo "3. 'Use connection pooling' 체크 해제"
  echo "4. Password를 실제 비밀번호로 교체"
  echo ""
  echo "그 다음 다음과 같이 실행:"
  echo 'export DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres"'
  echo "./supabase/run-migrations.sh"
  echo ""
  echo -e "${BLUE}또는 Supabase Dashboard의 SQL Editor에서 수동으로 실행하세요.${NC}"
  exit 1
fi

# psql 설치 확인
if ! command -v psql &> /dev/null; then
  echo -e "${RED}ERROR: psql이 설치되지 않았습니다.${NC}"
  echo ""
  echo "macOS: brew install postgresql"
  echo "Ubuntu: sudo apt-get install postgresql-client"
  echo ""
  exit 1
fi

# 마이그레이션 파일 목록
MIGRATIONS=(
  "supabase/migrations/20241025_create_strategies_table.sql"
  "supabase/migrations/20241025_create_monitoring_tables.sql"
)

# 각 마이그레이션 실행
for migration in "${MIGRATIONS[@]}"; do
  if [ ! -f "$migration" ]; then
    echo -e "${RED}ERROR: $migration 파일을 찾을 수 없습니다.${NC}"
    exit 1
  fi

  echo -e "${BLUE}실행 중: $migration${NC}"

  if psql "$DATABASE_URL" -f "$migration" -q; then
    echo -e "${GREEN}✓ 완료: $migration${NC}"
  else
    echo -e "${RED}✗ 실패: $migration${NC}"
    exit 1
  fi

  echo ""
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}모든 마이그레이션이 성공적으로 완료되었습니다!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 테이블 확인
echo -e "${BLUE}생성된 테이블 확인:${NC}"
psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('strategies', 'trading_logs', 'positions', 'condition_evaluations') ORDER BY table_name;" -q

echo ""
echo -e "${GREEN}마이그레이션 완료!${NC}"
