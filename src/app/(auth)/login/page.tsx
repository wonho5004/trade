import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-zinc-400">로딩 중…</div>}>
      <LoginForm />
    </Suspense>
  );
}
