-- Create monitoring tables for auto-trading
-- Migration: 20241025_create_monitoring_tables
-- Description: Creates tables for trading logs, positions, and condition evaluations

-- ============================================================================
-- 1. trading_logs table
-- ============================================================================
CREATE TABLE IF NOT EXISTS trading_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  action TEXT NOT NULL, -- 'ENTRY_LONG', 'ENTRY_SHORT', 'EXIT', 'SCALE_IN', 'HEDGE'
  price NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL,
  order_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'FILLED', 'FAILED', 'CANCELLED'
  reason JSONB, -- Condition evaluation results that triggered this trade
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT trading_logs_action_valid CHECK (action IN ('ENTRY_LONG', 'ENTRY_SHORT', 'EXIT', 'SCALE_IN', 'HEDGE')),
  CONSTRAINT trading_logs_status_valid CHECK (status IN ('PENDING', 'FILLED', 'FAILED', 'CANCELLED')),
  CONSTRAINT trading_logs_price_positive CHECK (price > 0),
  CONSTRAINT trading_logs_quantity_positive CHECK (quantity > 0)
);

-- Indexes for trading_logs
CREATE INDEX IF NOT EXISTS idx_trading_logs_user_id ON trading_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_logs_strategy_id ON trading_logs(strategy_id);
CREATE INDEX IF NOT EXISTS idx_trading_logs_symbol ON trading_logs(symbol);
CREATE INDEX IF NOT EXISTS idx_trading_logs_status ON trading_logs(status);
CREATE INDEX IF NOT EXISTS idx_trading_logs_created_at ON trading_logs(created_at DESC);

-- RLS for trading_logs
ALTER TABLE trading_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trading logs"
  ON trading_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert trading logs"
  ON trading_logs FOR INSERT
  WITH CHECK (true); -- Will be restricted by application logic

CREATE POLICY "System can update trading logs"
  ON trading_logs FOR UPDATE
  USING (true); -- Will be restricted by application logic

COMMENT ON TABLE trading_logs IS 'Records all trading actions including orders, fills, and errors';

-- ============================================================================
-- 2. positions table
-- ============================================================================
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL, -- 'LONG', 'SHORT'
  entry_price NUMERIC NOT NULL,
  current_price NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL,
  leverage INTEGER NOT NULL DEFAULT 1,
  unrealized_pnl NUMERIC NOT NULL DEFAULT 0,
  realized_pnl NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'CLOSED'
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT positions_side_valid CHECK (side IN ('LONG', 'SHORT')),
  CONSTRAINT positions_status_valid CHECK (status IN ('OPEN', 'CLOSED')),
  CONSTRAINT positions_entry_price_positive CHECK (entry_price > 0),
  CONSTRAINT positions_current_price_positive CHECK (current_price > 0),
  CONSTRAINT positions_quantity_positive CHECK (quantity > 0),
  CONSTRAINT positions_leverage_positive CHECK (leverage > 0 AND leverage <= 125),
  CONSTRAINT positions_user_symbol_unique UNIQUE (user_id, symbol, status)
);

-- Indexes for positions
CREATE INDEX IF NOT EXISTS idx_positions_user_id ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_strategy_id ON positions(strategy_id);
CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
CREATE INDEX IF NOT EXISTS idx_positions_opened_at ON positions(opened_at DESC);

-- RLS for positions
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own positions"
  ON positions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage positions"
  ON positions FOR ALL
  USING (true); -- Will be restricted by application logic

-- Trigger to auto-update updated_at
CREATE TRIGGER update_positions_updated_at
  BEFORE UPDATE ON positions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE positions IS 'Tracks open and closed positions for each user';

-- ============================================================================
-- 3. condition_evaluations table
-- ============================================================================
CREATE TABLE IF NOT EXISTS condition_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id UUID NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  condition_type TEXT NOT NULL, -- 'ENTRY', 'EXIT', 'SCALE_IN', 'HEDGE'
  evaluation_result BOOLEAN NOT NULL,
  details JSONB, -- Detailed evaluation results for each condition
  evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT condition_evaluations_type_valid CHECK (condition_type IN ('ENTRY', 'EXIT', 'SCALE_IN', 'HEDGE'))
);

-- Indexes for condition_evaluations
CREATE INDEX IF NOT EXISTS idx_condition_evaluations_user_id ON condition_evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_condition_evaluations_strategy_id ON condition_evaluations(strategy_id);
CREATE INDEX IF NOT EXISTS idx_condition_evaluations_symbol ON condition_evaluations(symbol);
CREATE INDEX IF NOT EXISTS idx_condition_evaluations_evaluated_at ON condition_evaluations(evaluated_at DESC);

-- RLS for condition_evaluations
ALTER TABLE condition_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own condition evaluations"
  ON condition_evaluations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert condition evaluations"
  ON condition_evaluations FOR INSERT
  WITH CHECK (true); -- Will be restricted by application logic

COMMENT ON TABLE condition_evaluations IS 'Records condition evaluation results for debugging and monitoring';

-- ============================================================================
-- 4. Helper views
-- ============================================================================

-- View: Recent trading activity
CREATE OR REPLACE VIEW recent_trading_activity AS
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

-- View: Active positions summary
CREATE OR REPLACE VIEW active_positions_summary AS
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

-- Grant access to views
GRANT SELECT ON recent_trading_activity TO authenticated;
GRANT SELECT ON active_positions_summary TO authenticated;

COMMENT ON VIEW recent_trading_activity IS 'Shows recent trading activity with strategy names';
COMMENT ON VIEW active_positions_summary IS 'Shows currently open positions with real-time PnL';
