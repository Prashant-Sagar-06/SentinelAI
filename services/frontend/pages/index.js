import { useEffect } from 'react';
import { useRouter } from 'next/router';

import useAuth from '../hooks/useAuth';
import { Spinner } from '../ui';

export default function Home() {
  const router = useRouter();
  const { token, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!router.isReady) return;
    if (token === undefined) return;

    router.replace(isAuthenticated ? '/dashboard' : '/login');
  }, [router, token, isAuthenticated]);

  return (
    <div className="grid min-h-screen place-items-center bg-soc-bg text-soc-text">
      <Spinner label="Loading…" />
    </div>
  );
}
