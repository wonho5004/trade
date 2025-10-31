import { MonitoringDashboard } from '@/components/trading/monitoring/MonitoringDashboard';

export const metadata = {
  title: '거래 모니터링 | Binance Trader',
  description: '실시간 거래 모니터링 및 포지션 추적'
};

export default function MonitorPage() {
  return <MonitoringDashboard />;
}
