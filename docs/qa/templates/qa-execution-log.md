# QA 실행 로그 템플릿

메타
- 날짜: YYYY-MM-DD
- 테스트 환경: dev | local | prod-mock
- 빌드/커밋: <hash or tag>
- 테스트 담당: <name>
- 시나리오 문서: <path e.g. docs/qa/phase2-margin-qa.md>

케이스
1) 제목: <예: ETHUSDT 150x 최소/최대 계산>
- 입력값: <요약>
- 기대값: <요약>
- 실제값: <요약>
- 결과: pass | fail
- 근거 스냅샷/링크: <첨부 또는 경로>
- 관련 requestId(있다면): <uuid>

이슈/메모
- <발견된 문제, 재현 절차, 영향 범위>
- <추가 검증 필요 항목>

결론
- 전반 결과: pass | conditional pass | fail
- 다음 액션: <버그 티켓/개선 작업/추가 데이터 수집>

