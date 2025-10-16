export function PermissionMatrixCard() {
  return (
    <article className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-300">
      <header>
        <h2 className="text-lg font-semibold text-zinc-100">권한별 기능 설정</h2>
        <p className="mt-1 text-zinc-400">
          각 역할이 접근할 수 있는 메뉴와 기능 제한을 정리하는 영역입니다. 추후 세부 정책을 추가할 예정입니다.
        </p>
      </header>
      <section className="space-y-3 rounded border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-400">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">메뉴 접근</h3>
          <p className="mt-1">권한별 대시보드, 거래, 분석, 관리자, 시스템 메뉴 접근 허용 범위를 구성합니다.</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">기능 제한</h3>
          <p className="mt-1">주문 기능, 데이터 다운로드, 백오피스 연동 등 세부 기능 권한을 정의합니다.</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">향후 계획</h3>
          <ul className="mt-1 space-y-1">
            <li>• 역할별 접근 행렬 시각화</li>
            <li>• 사용자 그룹 기반 정책 상속</li>
            <li>• 감사 로그 기반 권한 변경 추적</li>
          </ul>
        </div>
      </section>
    </article>
  );
}
