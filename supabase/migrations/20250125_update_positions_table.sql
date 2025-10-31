-- Update positions table for execution engine compatibility
-- Migration: 20250125_update_positions_table
-- Description: Adds columns needed by PositionTracker

-- Add missing columns
ALTER TABLE positions
  ADD COLUMN IF NOT EXISTS direction TEXT,
  ADD COLUMN IF NOT EXISTS entry_time TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS entry_order_id TEXT,
  ADD COLUMN IF NOT EXISTS exit_price NUMERIC,
  ADD COLUMN IF NOT EXISTS exit_time TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS exit_order_id TEXT;

-- Update direction from side for existing records
UPDATE positions SET direction = LOWER(side) WHERE direction IS NULL;

-- Update entry_time from opened_at for existing records
UPDATE positions SET entry_time = opened_at WHERE entry_time IS NULL;

-- Add check constraint for direction
ALTER TABLE positions
  ADD CONSTRAINT positions_direction_valid CHECK (direction IN ('long', 'short'));

-- Drop the old unique constraint
ALTER TABLE positions DROP CONSTRAINT IF EXISTS positions_user_symbol_unique;

-- Add new unique constraint that allows multiple closed positions
CREATE UNIQUE INDEX IF NOT EXISTS positions_user_symbol_direction_open_unique
  ON positions(user_id, symbol, direction)
  WHERE status = 'OPEN';

COMMENT ON COLUMN positions.direction IS 'Position direction (long/short) - lowercase for consistency';
COMMENT ON COLUMN positions.entry_time IS 'When the position was opened';
COMMENT ON COLUMN positions.entry_order_id IS 'Order ID that opened this position';
COMMENT ON COLUMN positions.exit_price IS 'Price at which position was closed';
COMMENT ON COLUMN positions.exit_time IS 'When the position was closed';
COMMENT ON COLUMN positions.exit_order_id IS 'Order ID that closed this position';
