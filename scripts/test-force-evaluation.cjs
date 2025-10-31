/**
 * Force Evaluation 테스트 스크립트
 * 직접 API를 호출하여 평가 실행을 테스트합니다.
 */

require('dotenv').config({ path: '.env.local' });

async function testForceEvaluation() {
  console.log('🧪 Force Evaluation 테스트 시작...\n');

  // Note: 이 스크립트는 인증이 필요한 API를 호출하므로
  // 브라우저에서 직접 "평가 실행" 버튼을 클릭해야 합니다.

  console.log('✅ 다음 단계를 진행하세요:');
  console.log('1. 브라우저에서 http://localhost:3000/trading/monitoring 접속');
  console.log('2. 활성 전략 패널에서 "평가 실행" 버튼 클릭');
  console.log('3. 개발자 도구 콘솔 (F12) 확인');
  console.log('4. 서버 로그 확인 (npm run dev 터미널)');
  console.log('');
  console.log('📝 확인할 사항:');
  console.log('- 콘솔에 "✅ 평가 완료: N개 심볼" 메시지가 표시되는지');
  console.log('- 서버 로그에 "[Strategy ...] Copied N symbols" 메시지가 있는지');
  console.log('- 서버 로그에 지표 계산 결과가 출력되는지 (DMI, ADX 등)');
  console.log('- 조건 평가 추적 패널에 평가 결과가 나타나는지');
  console.log('');
  console.log('이후 다음 명령어로 결과 확인:');
  console.log('  node scripts/diagnose-engine.cjs');
}

testForceEvaluation();
