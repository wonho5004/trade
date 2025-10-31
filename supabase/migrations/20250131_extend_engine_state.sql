-- Extend engine_state table to persist full execution engine state
-- This allows the engine to resume after session expiry or restart

ALTER TABLE engine_state
ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS simulation_config JSONB,
ADD COLUMN IF NOT EXISTS virtual_positions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add constraint for mode values
ALTER TABLE engine_state
ADD CONSTRAINT engine_state_mode_check
CHECK (mode IN ('idle', 'monitoring', 'simulation', 'trading'));

-- Add index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_engine_state_user_id ON engine_state(user_id);

COMMENT ON COLUMN engine_state.mode IS 'Current execution mode: idle, monitoring, simulation, or trading';
COMMENT ON COLUMN engine_state.simulation_config IS 'Simulation configuration including capital, PnL, trades count';
COMMENT ON COLUMN engine_state.virtual_positions IS 'Array of virtual positions in simulation mode';
COMMENT ON COLUMN engine_state.user_id IS 'User who started the engine (for multi-user support)';
