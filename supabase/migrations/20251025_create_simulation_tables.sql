-- Create simulation tables for backtesting and paper trading
-- Migration: 20251025_create_simulation_tables
-- Description: Creates tables for simulation sessions, trades, and results

-- ============================================================================
-- 1. simulation_sessions table
-- ============================================================================
CREATE TABLE IF NOT EXISTS simulation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,

  -- Session config
  name TEXT NOT NULL,
  description TEXT,
  initial_capital NUMERIC NOT NULL,
  current_capital NUMERIC NOT NULL,
  duration_hours INTEGER, -- NULL = unlimited (live simulation)
  duration_days INTEGER, -- Alternative to hours

  -- Session status
  status TEXT NOT NULL DEFAULT 'RUNNING', -- 'RUNNING', 'PAUSED', 'COMPLETED', 'STOPPED'
  mode TEXT NOT NULL DEFAULT 'SIMULATION', -- 'SIMULATION', 'BACKTEST'

  -- Results summary
  total_pnl NUMERIC DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  win_rate NUMERIC DEFAULT 0, -- percentage
  roi NUMERIC DEFAULT 0, -- percentage
  max_drawdown NUMERIC DEFAULT 0,
  sharpe_ratio NUMERIC,
  daily_avg_roi NUMERIC, -- 일평균 수익률

  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT simulation_sessions_status_valid CHECK (status IN ('RUNNING', 'PAUSED', 'COMPLETED', 'STOPPED')),
  CONSTRAINT simulation_sessions_mode_valid CHECK (mode IN ('SIMULATION', 'BACKTEST')),
  CONSTRAINT simulation_sessions_initial_capital_positive CHECK (initial_capital > 0),
  CONSTRAINT simulation_sessions_current_capital_positive CHECK (current_capital >= 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_simulation_sessions_user_id ON simulation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_simulation_sessions_strategy_id ON simulation_sessions(strategy_id);
CREATE INDEX IF NOT EXISTS idx_simulation_sessions_status ON simulation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_simulation_sessions_started_at ON simulation_sessions(started_at DESC);

-- RLS
ALTER TABLE simulation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own simulation sessions"
  ON simulation_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own simulation sessions"
  ON simulation_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own simulation sessions"
  ON simulation_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own simulation sessions"
  ON simulation_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger
CREATE TRIGGER update_simulation_sessions_updated_at
  BEFORE UPDATE ON simulation_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE simulation_sessions IS 'Tracks simulation and backtest sessions with results summary';

-- ============================================================================
-- 2. simulation_trades table
-- ============================================================================
CREATE TABLE IF NOT EXISTS simulation_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES simulation_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,

  -- Trade details
  symbol TEXT NOT NULL,
  side TEXT NOT NULL, -- 'LONG', 'SHORT'
  action TEXT NOT NULL, -- 'ENTRY', 'EXIT'
  entry_price NUMERIC,
  exit_price NUMERIC,
  quantity NUMERIC NOT NULL,

  -- Results
  pnl NUMERIC DEFAULT 0,
  pnl_percentage NUMERIC DEFAULT 0,
  holding_time_minutes INTEGER, -- in minutes

  -- Evaluation details
  entry_reason JSONB, -- Entry condition evaluation results
  exit_reason JSONB, -- Exit condition evaluation results
  indicators JSONB, -- Indicator values at time of trade

  -- Timestamps
  entry_time TIMESTAMP WITH TIME ZONE,
  exit_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT simulation_trades_side_valid CHECK (side IN ('LONG', 'SHORT')),
  CONSTRAINT simulation_trades_action_valid CHECK (action IN ('ENTRY', 'EXIT')),
  CONSTRAINT simulation_trades_quantity_positive CHECK (quantity > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_simulation_trades_session_id ON simulation_trades(session_id);
CREATE INDEX IF NOT EXISTS idx_simulation_trades_user_id ON simulation_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_simulation_trades_strategy_id ON simulation_trades(strategy_id);
CREATE INDEX IF NOT EXISTS idx_simulation_trades_symbol ON simulation_trades(symbol);
CREATE INDEX IF NOT EXISTS idx_simulation_trades_created_at ON simulation_trades(created_at DESC);

-- RLS
ALTER TABLE simulation_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own simulation trades"
  ON simulation_trades FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert simulation trades"
  ON simulation_trades FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE simulation_trades IS 'Records all trades during simulation sessions';

-- ============================================================================
-- 3. simulation_symbol_results table (종목별 결과)
-- ============================================================================
CREATE TABLE IF NOT EXISTS simulation_symbol_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES simulation_sessions(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,

  -- Symbol-specific results
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,
  total_pnl NUMERIC DEFAULT 0,
  roi NUMERIC DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT simulation_symbol_results_unique UNIQUE (session_id, symbol)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_simulation_symbol_results_session_id ON simulation_symbol_results(session_id);

-- RLS
ALTER TABLE simulation_symbol_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view simulation symbol results"
  ON simulation_symbol_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM simulation_sessions ss
      WHERE ss.id = session_id AND ss.user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage simulation symbol results"
  ON simulation_symbol_results FOR ALL
  USING (true);

-- Trigger
CREATE TRIGGER update_simulation_symbol_results_updated_at
  BEFORE UPDATE ON simulation_symbol_results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE simulation_symbol_results IS 'Stores per-symbol performance metrics for each simulation session';

-- ============================================================================
-- 4. simulation_errors table (에러 로그)
-- ============================================================================
CREATE TABLE IF NOT EXISTS simulation_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES simulation_sessions(id) ON DELETE CASCADE,

  error_type TEXT NOT NULL, -- 'EVALUATION', 'EXECUTION', 'DATA', 'SYSTEM'
  error_message TEXT NOT NULL,
  error_details JSONB,
  symbol TEXT,

  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT simulation_errors_type_valid CHECK (error_type IN ('EVALUATION', 'EXECUTION', 'DATA', 'SYSTEM'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_simulation_errors_session_id ON simulation_errors(session_id);
CREATE INDEX IF NOT EXISTS idx_simulation_errors_occurred_at ON simulation_errors(occurred_at DESC);

-- RLS
ALTER TABLE simulation_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view simulation errors"
  ON simulation_errors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM simulation_sessions ss
      WHERE ss.id = session_id AND ss.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert simulation errors"
  ON simulation_errors FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE simulation_errors IS 'Tracks errors occurred during simulation sessions';

-- ============================================================================
-- 5. Helper views
-- ============================================================================

-- View: Simulation summary with strategy names
CREATE OR REPLACE VIEW simulation_sessions_summary AS
SELECT
  ss.id,
  ss.user_id,
  ss.strategy_id,
  s.name AS strategy_name,
  ss.name,
  ss.initial_capital,
  ss.current_capital,
  ss.total_pnl,
  ss.roi,
  ss.win_rate,
  ss.total_trades,
  ss.winning_trades,
  ss.losing_trades,
  ss.daily_avg_roi,
  ss.status,
  ss.started_at,
  ss.completed_at,
  EXTRACT(EPOCH FROM (COALESCE(ss.completed_at, NOW()) - ss.started_at)) / 3600 AS duration_hours
FROM simulation_sessions ss
LEFT JOIN strategies s ON ss.strategy_id = s.id
ORDER BY ss.started_at DESC;

-- Grant access
GRANT SELECT ON simulation_sessions_summary TO authenticated;

COMMENT ON VIEW simulation_sessions_summary IS 'Shows simulation sessions with summary statistics and strategy names';
