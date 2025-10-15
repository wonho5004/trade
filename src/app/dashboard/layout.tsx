import type { ReactNode } from 'react';

import { requireAuthenticatedUser } from '@/lib/auth/roles';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireAuthenticatedUser('/dashboard');
  return <>{children}</>;
}
