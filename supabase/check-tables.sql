-- 현재 테이블 및 컬럼 구조 확인

-- 1. 존재하는 테이블 확인
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('strategies', 'trading_logs', 'positions', 'condition_evaluations')
ORDER BY table_name;

-- 2. trading_logs 테이블 컬럼 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'trading_logs'
ORDER BY ordinal_position;

-- 3. positions 테이블 컬럼 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'positions'
ORDER BY ordinal_position;

-- 4. strategies 테이블 컬럼 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'strategies'
ORDER BY ordinal_position;
