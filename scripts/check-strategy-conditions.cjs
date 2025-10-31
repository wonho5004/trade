/**
 * 전략 조건 구조 상세 확인 스크립트
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStrategyConditions() {
  console.log('🔍 전략 조건 구조 상세 확인...\n');

  try {
    // 활성 전략 조회
    const { data: strategies, error } = await supabase
      .from('strategies')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('❌ 전략 조회 실패:', error.message);
      return;
    }

    if (!strategies || strategies.length === 0) {
      console.log('⚠️ 활성 전략이 없습니다.');
      return;
    }

    const strategy = strategies[0];
    console.log(`📋 전략: ${strategy.name} (ID: ${strategy.id})\n`);

    // settings 파싱
    let settings = strategy.settings;
    if (typeof settings === 'string') {
      try {
        settings = JSON.parse(settings);
      } catch (e) {
        console.error('❌ settings 파싱 실패:', e.message);
        return;
      }
    }

    // 전체 settings 구조 출력
    console.log('📊 전체 Settings 구조:');
    console.log(JSON.stringify(settings, null, 2));
    console.log('\n');

    // entry 조건 상세 확인
    console.log('🎯 진입 조건 (Entry):');
    if (settings.entry) {
      console.log('  - long.enabled:', settings.entry.long?.enabled);
      console.log('  - short.enabled:', settings.entry.short?.enabled);

      if (settings.entry.long?.conditions) {
        console.log('\n  📝 LONG 진입 조건 구조:');
        console.log(JSON.stringify(settings.entry.long.conditions, null, 2));
      } else {
        console.log('  ⚠️ LONG 진입 조건이 없습니다!');
      }

      if (settings.entry.short?.conditions) {
        console.log('\n  📝 SHORT 진입 조건 구조:');
        console.log(JSON.stringify(settings.entry.short.conditions, null, 2));
      } else {
        console.log('  ⚠️ SHORT 진입 조건이 없습니다!');
      }
    } else {
      console.log('  ❌ settings.entry가 없습니다!');
    }

    // exit 조건 상세 확인
    console.log('\n🚪 청산 조건 (Exit):');
    if (settings.exit) {
      console.log('  - long.enabled:', settings.exit.long?.enabled);
      console.log('  - short.enabled:', settings.exit.short?.enabled);

      if (settings.exit.long?.conditions) {
        console.log('\n  📝 LONG 청산 조건 구조:');
        console.log(JSON.stringify(settings.exit.long.conditions, null, 2));
      } else {
        console.log('  ⚠️ LONG 청산 조건이 없습니다!');
      }

      if (settings.exit.short?.conditions) {
        console.log('\n  📝 SHORT 청산 조건 구조:');
        console.log(JSON.stringify(settings.exit.short.conditions, null, 2));
      } else {
        console.log('  ⚠️ SHORT 청산 조건이 없습니다!');
      }
    } else {
      console.log('  ❌ settings.exit가 없습니다!');
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
}

checkStrategyConditions();
