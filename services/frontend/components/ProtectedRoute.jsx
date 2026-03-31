import { useEffect } from 'react';
import { useRouter } from 'next/router';

import useAuth from '../hooks/useAuth';
import { Spinner } from '../ui';

export default function ProtectedRoute({ children }) {
  const router = useRouter();
  const { token } = useAuth();

  const loading = token === undefined || !router.isReady;

  useEffect(() => {
    if (!router.isReady) return;
    if (token === undefined) return;
    if (token) return;

    if (router.pathname !== '/login') {
      router.replace('/login');
    }
  }, [router, token]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-soc-bg text-soc-text">
        <Spinner label="Loading…" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="grid min-h-screen place-items-center bg-soc-bg text-soc-text">
        <Spinner label="Redirecting…" />
      </div>
    );
  }

  return children;
}
