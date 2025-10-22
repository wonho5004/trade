# API 에러 응답 표준안

본 표준안은 Next.js API(`src/app/api/*`)와 클라이언트 간 에러 포맷을 일관되게 유지하기 위한 규칙입니다.

## 응답 형태(JSON)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "입력값을 확인해 주세요.",
    "details": { "reason": "symbol not allowed" },
    "fieldErrors": [
      { "field": "symbol", "code": "INVALID_SYMBOL", "message": "지원하지 않는 종목입니다." }
    ]
  },
  "requestId": "7f8a2b1c-...",
  "ts": "2025-10-20T12:34:56.789Z"
}
```

## 코드/HTTP 매핑
- 400 Bad Request: `BAD_REQUEST`, `VALIDATION_ERROR`(필드 없음)
- 401/403 Unauthorized/Forbidden: `UNAUTHORIZED`, `FORBIDDEN`
- 404 Not Found: `NOT_FOUND`
- 409 Conflict: `CONFLICT`(이름 중복 등)
- 422 Unprocessable Entity: `VALIDATION_ERROR`(필드 오류 포함)
- 429 Too Many Requests: `RATE_LIMITED`
- 500 Internal Server Error: `INTERNAL`

## 클라이언트 처리 지침
- 422/400에 `fieldErrors`가 있으면 필드 하이라이트 + 첫 오류 포커스 이동. 토스트는 보조 정보.
- 그 외 오류는 토스트(에러)로 노출하고, `requestId`를 메시지/로그에 포함.
- `error.code`로 i18n 메시지를 매핑하고, `message`는 기본 fallback으로 사용.

## Next.js 예시
```ts
import { NextResponse } from 'next/server'

export function error422(fieldErrors: any[], requestId: string) {
  return NextResponse.json({
    success: false,
    error: { code: 'VALIDATION_ERROR', message: '입력값을 확인해 주세요.', fieldErrors },
    requestId,
    ts: new Date().toISOString(),
  }, { status: 422 })
}
```

## 로깅/보안
- `requestId`를 생성·전파하여 서버/클라이언트 로그 연계를 단순화합니다.
- `details`에는 민감정보(API 키, 서명, 토큰 등)를 절대 포함하지 않습니다.
- 서버 로그에는 전체 스택을 남기되, 응답에는 요약 메시지만 노출합니다.

