-- ============================================================================
-- Fix Migration - Drop and Recreate Tables
-- ============================================================================
-- 기존 테이블을 삭제하고 새로 생성합니다.
-- ⚠️ 주의: 기존 데이터가 모두 삭제됩니다!
-- ============================================================================

-- 기존 views 삭제
DROP VIEW IF EXISTS recent_trading_activity;
DROP VIEW IF EXISTS active_positions_summary;

-- 기존 테이블 삭제 (역순으로 - 외래키 때문에)
DROP TABLE IF EXISTS condition_evaluations CASCADE;
DROP TABLE IF EXISTS positions CASCADE;
DROP TABLE IF EXISTS trading_logs CASCADE;
DROP TABLE IF EXISTS strategies CASCADE;

-- Function도 재생성을 위해 삭제
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- ============================================================================
-- 1. strategies 테이블 생성
-- ============================================================================

CREATE TABLE strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  settings JSONB NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT strategies_name_not_empty CHECK (char_length(name) > 0),
  CONSTRAINT strategies_user_name_unique UNIQUE (user_id, name)
);

CREATE INDEX idx_strategies_user_id ON strategies(user_id);
CREATE INDEX idx_strategies_is_active ON strategies(is_active);
CREATE INDEX idx_strategies_created_at ON strategies(created_at DESC);

ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own strategies"
  ON strategies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own strategies"
  ON strategies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own strategies"
  ON strategies FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own strategies"
  ON strategies FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE strategies IS 'Stores user-defined auto-trading strategies with complete settings and metadata';

-- ============================================================================
-- 2. update_updated_at_column 함수 생성
-- ============================================================================

CREATE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_strategies_updated_at
  BEFORE UPDATE ON strategies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. trading_logs 테이블 생성
-- ============================================================================

CREATE TABLE trading_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  action TEXT NOT NULL,
  price NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL,
  order_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  reason JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT trading_logs_action_valid CHECK (action IN ('ENTRY_LONG', 'ENTRY_SHORT', 'EXIT', 'SCALE_IN', 'HEDGE')),
  CONSTRAINT trading_logs_status_valid CHECK (status IN ('PENDING', 'FILLED', 'FAILED', 'CANCELLED')),
  CONSTRAINT trading_logs_price_positive CHECK (price > 0),
  CONSTRAINT trading_logs_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX idx_trading_logs_user_id ON trading_logs(user_id);
CREATE INDEX idx_trading_logs_strategy_id ON trading_logs(strategy_id);
CREATE INDEX idx_trading_logs_symbol ON trading_logs(symbol);
CREATE INDEX idx_trading_logs_status ON trading_logs(status);
CREATE INDEX idx_trading_logs_created_at ON trading_logs(created_at DESC);

ALTER TABLE trading_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trading logs"
  ON trading_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert trading logs"
  ON trading_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update trading logs"
  ON trading_logs FOR UPDATE
  USING (true);

COMMENT ON TABLE trading_logs IS 'Records all trading actions including orders, fills, and errors';

-- ============================================================================
-- 4. positions 테이블 생성
-- ============================================================================

CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  entry_price NUMERIC NOT NULL,
  current_price NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL,
  leverage INTEGER NOT NULL DEFAULT 1,
  unrealized_pnl NUMERIC NOT NULL DEFAULT 0,
  realized_pnl NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'OPEN',
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT positions_side_valid CHECK (side IN ('LONG', 'SHORT')),
  CONSTRAINT positions_status_valid CHECK (status IN ('OPEN', 'CLOSED')),
  CONSTRAINT positions_entry_price_positive CHECK (entry_price > 0),
  CONSTRAINT positions_current_price_positive CHECK (current_price > 0),
  CONSTRAINT positions_quantity_positive CHECK (quantity > 0),
  CONSTRAINT positions_leverage_positive CHECK (leverage > 0 AND leverage <= 125),
  CONSTRAINT positions_user_symbol_unique UNIQUE (user_id, symbol, status)
);

CREATE INDEX idx_positions_user_id ON positions(user_id);
CREATE INDEX idx_positions_strategy_id ON positions(strategy_id);
CREATE INDEX idx_positions_symbol ON positions(symbol);
CREATE INDEX idx_positions_status ON positions(status);
CREATE INDEX idx_positions_opened_at ON positions(opened_at DESC);

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own positions"
  ON positions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage positions"
  ON positions FOR ALL
  USING (true);

CREATE TRIGGER update_positions_updated_at
  BEFORE UPDATE ON positions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE positions IS 'Tracks open and closed positions for each user';

-- ============================================================================
-- 5. condition_evaluations 테이블 생성
-- ============================================================================

CREATE TABLE condition_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id UUID NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  condition_type TEXT NOT NULL,
  evaluation_result BOOLEAN NOT NULL,
  details JSONB,
  evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT condition_evaluations_type_valid CHECK (condition_type IN ('ENTRY', 'EXIT', 'SCALE_IN', 'HEDGE'))
);

CREATE INDEX idx_condition_evaluations_user_id ON condition_evaluations(user_id);
CREATE INDEX idx_condition_evaluations_strategy_id ON condition_evaluations(strategy_id);
CREATE INDEX idx_condition_evaluations_symbol ON condition_evaluations(symbol);
CREATE INDEX idx_condition_evaluations_evaluated_at ON condition_evaluations(evaluated_at DESC);

ALTER TABLE condition_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own condition evaluations"
  ON condition_evaluations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert condition evaluations"
  ON condition_evaluations FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE condition_evaluations IS 'Records condition evaluation results for debugging and monitoring';

-- ============================================================================
-- 6. Views 생성
-- ============================================================================

CREATE VIEW recent_trading_activity AS
SELECT
  tl.id,
  tl.user_id,
  tl.strategy_id,
  s.name AS strategy_name,
  tl.symbol,
  tl.action,
  tl.price,
  tl.quantity,
  tl.status,
  tl.created_at
FROM trading_logs tl
LEFT JOIN strategies s ON tl.strategy_id = s.id
ORDER BY tl.created_at DESC;

CREATE VIEW active_positions_summary AS
SELECT
  p.user_id,
  p.strategy_id,
  s.name AS strategy_name,
  p.symbol,
  p.side,
  p.entry_price,
  p.current_price,
  p.quantity,
  p.leverage,
  p.unrealized_pnl,
  p.opened_at,
  p.updated_at
FROM positions p
LEFT JOIN strategies s ON p.strategy_id = s.id
WHERE p.status = 'OPEN'
ORDER BY p.opened_at DESC;

GRANT SELECT ON recent_trading_activity TO authenticated;
GRANT SELECT ON active_positions_summary TO authenticated;

-- ============================================================================
-- 완료 확인
-- ============================================================================

SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND t.table_name = columns.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('strategies', 'trading_logs', 'positions', 'condition_evaluations')
ORDER BY table_name;
