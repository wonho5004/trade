import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 px-6 py-12 text-zinc-100">
      <div className="max-w-md text-center space-y-4">
        <p className="text-3xl font-semibold">접근 권한이 없습니다</p>
        <p className="text-sm text-zinc-400">
          요청한 페이지에 접근하기 위한 권한이 부족합니다. 필요한 권한이 있는 계정으로 다시 로그인하거나
          관리자에게 문의해 주세요.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="rounded border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-300"
        >
          대시보드로 이동
        </Link>
        <Link
          href="/login"
          className="rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
        >
          로그인 페이지
        </Link>
      </div>
    </div>
  );
}
