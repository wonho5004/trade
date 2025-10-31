/**
 * Create engine_state table in Supabase
 * Run with: npx tsx scripts/create-engine-state-table.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createEngineStateTable() {
  console.log('🚀 Creating engine_state table...\n');

  try {
    // Create table
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS engine_state (
          id TEXT PRIMARY KEY DEFAULT 'singleton',
          is_running BOOLEAN NOT NULL DEFAULT false,
          started_at TIMESTAMPTZ,
          stopped_at TIMESTAMPTZ,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `
    });

    if (error && error.message !== 'rpc is not a function') {
      console.error('❌ Failed to create table:', error);
      throw error;
    }

    // Insert default record
    const { error: insertError } = await supabase
      .from('engine_state')
      .upsert({
        id: 'singleton',
        is_running: false,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    if (insertError) {
      console.error('❌ Failed to insert default record:', insertError);
      throw insertError;
    }

    console.log('✅ engine_state table created successfully');
    console.log('✅ Default record inserted\n');

    // Verify
    const { data: verifyData, error: verifyError } = await supabase
      .from('engine_state')
      .select('*')
      .eq('id', 'singleton')
      .single();

    if (verifyError) {
      console.error('❌ Failed to verify table:', verifyError);
    } else {
      console.log('✅ Verification successful:');
      console.log(verifyData);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createEngineStateTable();
