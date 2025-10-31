/**
 * 엔진 및 전략 상태 진단 스크립트
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  console.error('   .env.local 파일에 다음 변수가 필요합니다:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseEngine() {
  console.log('🔍 엔진 및 전략 상태 진단 시작...\n');

  try {
    // 1. 엔진 상태 확인
    console.log('1️⃣ 엔진 상태 확인:');
    const { data: engineState, error: engineError } = await supabase
      .from('engine_state')
      .select('*')
      .eq('id', 'singleton')
      .single();

    if (engineError) {
      console.error('❌ 엔진 상태 조회 실패:', engineError.message);
    } else {
      console.log('✅ 엔진 상태:', {
        isRunning: engineState?.is_running,
        startedAt: engineState?.started_at,
        stoppedAt: engineState?.stopped_at,
        updatedAt: engineState?.updated_at
      });
    }
    console.log('');

    // 2. 활성 전략 확인
    console.log('2️⃣ 활성 전략 확인:');
    const { data: strategies, error: strategyError } = await supabase
      .from('strategies')
      .select('*')
      .eq('is_active', true);

    if (strategyError) {
      console.error('❌ 전략 조회 실패:', strategyError.message);
    } else {
      console.log(`✅ 활성 전략 수: ${strategies?.length || 0}`);

      if (strategies && strategies.length > 0) {
        strategies.forEach((strategy, idx) => {
          console.log(`\n📋 전략 #${idx + 1}:`);
          console.log(`  - ID: ${strategy.id}`);
          console.log(`  - 이름: ${strategy.name}`);
          console.log(`  - 생성일: ${strategy.created_at}`);

          // settings 파싱
          let settings = strategy.settings;
          if (typeof settings === 'string') {
            try {
              settings = JSON.parse(settings);
            } catch (e) {
              console.log('  - Settings 파싱 실패');
              settings = null;
            }
          }

          if (settings) {
            console.log(`  - 타임프레임: ${settings.timeframe || 'N/A'}`);
            console.log(`  - 레버리지: ${settings.leverage?.value || 'N/A'}`);
            console.log(`  - 종목 수: ${settings.symbolCount || 'N/A'}`);

            // 심볼 확인
            if (settings.symbolSelection) {
              console.log(`  - 심볼 선택 모드: ${settings.symbolSelection.mode || 'N/A'}`);
              if (settings.symbolSelection.manualSymbols) {
                console.log(`  - 수동 선택 심볼: ${settings.symbolSelection.manualSymbols.length}개`);
                console.log(`    ${settings.symbolSelection.manualSymbols.slice(0, 5).join(', ')}${settings.symbolSelection.manualSymbols.length > 5 ? '...' : ''}`);
              }
            }

            // settings.symbols 확인 (ExecutionEngine이 사용하는 필드)
            if (settings.symbols) {
              console.log(`  - settings.symbols: ${Array.isArray(settings.symbols) ? settings.symbols.length : 'not array'}개`);
              if (Array.isArray(settings.symbols) && settings.symbols.length > 0) {
                console.log(`    ${settings.symbols.slice(0, 5).join(', ')}${settings.symbols.length > 5 ? '...' : ''}`);
              } else {
                console.log('    ⚠️ settings.symbols가 비어있거나 배열이 아닙니다!');
              }
            } else {
              console.log('  - ⚠️ settings.symbols 필드가 없습니다!');
            }

            // 진입/청산 조건 확인
            if (settings.entry) {
              console.log(`  - 진입 조건: ${settings.entry.long?.enabled ? 'LONG ✓' : ''}${settings.entry.short?.enabled ? 'SHORT ✓' : ''}`);

              // 진입 조건 상세 확인
              if (settings.entry.long?.enabled && settings.entry.long.conditions) {
                console.log(`    LONG 조건 구조:`, JSON.stringify(settings.entry.long.conditions, null, 2).substring(0, 500));
              }
              if (settings.entry.short?.enabled && settings.entry.short.conditions) {
                console.log(`    SHORT 조건 구조:`, JSON.stringify(settings.entry.short.conditions, null, 2).substring(0, 500));
              }
            } else {
              console.log('  - ⚠️ settings.entry 필드가 없습니다!');
            }

            if (settings.exit) {
              console.log(`  - 청산 조건: ${settings.exit.long?.enabled ? 'LONG ✓' : ''}${settings.exit.short?.enabled ? 'SHORT ✓' : ''}`);
            } else {
              console.log('  - ⚠️ settings.exit 필드가 없습니다!');
            }
          }
        });
      } else {
        console.log('⚠️ 활성화된 전략이 없습니다!');
      }
    }
    console.log('');

    // 3. 조건 평가 이력 확인
    console.log('3️⃣ 조건 평가 이력 확인:');
    const { data: evaluations, error: evalError } = await supabase
      .from('condition_evaluations')
      .select('*')
      .order('evaluated_at', { ascending: false })
      .limit(10);

    if (evalError) {
      console.error('❌ 평가 이력 조회 실패:', evalError.message);
    } else {
      console.log(`✅ 최근 평가 기록: ${evaluations?.length || 0}개`);

      if (evaluations && evaluations.length > 0) {
        evaluations.forEach((evaluation, idx) => {
          console.log(`  ${idx + 1}. ${evaluation.symbol} - ${evaluation.condition_type} - ${evaluation.evaluation_result ? '✅ 충족' : '❌ 미충족'} (${new Date(evaluation.evaluated_at).toLocaleString('ko-KR')})`);
        });
      } else {
        console.log('⚠️ 평가 기록이 없습니다!');
      }
    }
    console.log('');

    // 4. 시뮬레이션 세션 확인
    console.log('4️⃣ 시뮬레이션 세션 확인:');
    const { data: sessions, error: sessionError } = await supabase
      .from('simulation_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (sessionError) {
      console.error('❌ 세션 조회 실패:', sessionError.message);
    } else {
      console.log(`✅ 시뮬레이션 세션: ${sessions?.length || 0}개`);

      if (sessions && sessions.length > 0) {
        sessions.forEach((session, idx) => {
          console.log(`  ${idx + 1}. ${session.name} - ${session.status} - ROI: ${session.roi?.toFixed(2) || 0}%`);
        });
      }
    }
    console.log('');

    // 5. 진단 요약
    console.log('📊 진단 요약:');
    const issues = [];

    if (!engineState?.is_running) {
      issues.push('❌ 엔진이 실행 중이 아닙니다');
    }

    if (!strategies || strategies.length === 0) {
      issues.push('❌ 활성 전략이 없습니다');
    } else {
      strategies.forEach(strategy => {
        let settings = strategy.settings;
        if (typeof settings === 'string') {
          try {
            settings = JSON.parse(settings);
          } catch (e) {
            settings = null;
          }
        }

        if (!settings) {
          issues.push(`❌ 전략 "${strategy.name}": settings 파싱 실패`);
        } else if (!settings.symbols || !Array.isArray(settings.symbols) || settings.symbols.length === 0) {
          issues.push(`❌ 전략 "${strategy.name}": settings.symbols가 비어있거나 배열이 아닙니다`);
        }
      });
    }

    if (!evaluations || evaluations.length === 0) {
      issues.push('⚠️ 조건 평가 기록이 없습니다 (아직 캔들이 형성되지 않았을 수 있음)');
    }

    if (issues.length === 0) {
      console.log('✅ 모든 체크 통과!');
    } else {
      console.log('발견된 문제:');
      issues.forEach(issue => console.log(`  ${issue}`));
    }

  } catch (error) {
    console.error('❌ 진단 중 오류 발생:', error);
  }
}

diagnoseEngine();
