import type { ReactNode } from 'react';

import { requireRole } from '@/lib/auth/roles';

export default async function OpsLayout({ children }: { children: ReactNode }) {
  await requireRole('sys_admin', '/ops');
  return <>{children}</>;
}
