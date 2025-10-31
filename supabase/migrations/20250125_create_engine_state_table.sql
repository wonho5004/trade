-- Create engine_state table to persist execution engine status
-- This table maintains the running state of the trading engine across serverless function calls
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
