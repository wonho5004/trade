import { requireRole } from '@/lib/auth/roles';

export default async function OpsPage() {
  await requireRole('sys_admin', '/ops');

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-6">
        <h1 className="text-2xl font-semibold">시스템 관리자 패널</h1>
        <p className="mt-2 text-sm text-amber-200/70">
          인프라 상태, 서비스 키 값, 백오피스 연동 정보 등을 관리하는 전용 페이지입니다.
        </p>
      </div>
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-lg font-semibold text-zinc-100">환경 변수 점검</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Supabase 키, WebSocket 엔드포인트 등 핵심 설정을 확인하고 누락 시 경고합니다.
          </p>
        </article>
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-lg font-semibold text-zinc-100">서비스 상태 모니터링</h2>
          <p className="mt-2 text-sm text-zinc-400">
            향후 Prometheus/Grafana 연동으로 실시간 운영 지표를 노출할 예정입니다.
          </p>
        </article>
      </section>
    </div>
  );
}
