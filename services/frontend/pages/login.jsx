import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeOff, Lock, Mail, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import useAuth from '../hooks/useAuth';
import { Button, Card, Input, Spinner } from '../ui';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE) {
  throw new Error('NEXT_PUBLIC_API_BASE_URL is not defined');
}

export default function LoginPage() {
  const router = useRouter();
  const { token, login, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const title = useMemo(() => (mode === 'register' ? 'Create your account' : 'Sign in to SentinelAI'), [mode]);
  const subtitle = useMemo(
    () => (mode === 'register' ? 'Provision an admin session for evaluation.' : 'Secure access to your SOC console.'),
    [mode]
  );

  useEffect(() => {
    if (!router.isReady) return;
    if (token === undefined) return;
    if (isAuthenticated) router.replace('/dashboard');
  }, [token, isAuthenticated, router]);

  async function submit(e) {
    e.preventDefault();
    setError('');

    const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, role: 'admin' }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (json && typeof json === 'object' && json.error) ? String(json.error) : 'Authentication failed';
        setError(msg);
        toast.error('Authentication failed');
        return;
      }

      const data = json && typeof json === 'object' && 'data' in json ? json.data : json;
      const nextToken = data?.token ? String(data.token) : '';

      if (!nextToken) {
        setError('Missing token from server response');
        toast.error('Authentication failed');
        return;
      }

      login(nextToken);
      toast.success('Welcome to SentinelAI');
      router.replace('/dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  }

  if (token === undefined) {
    return (
      <div className="grid min-h-screen place-items-center bg-soc-bg text-soc-text">
        <Spinner label="Loading…" />
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="grid min-h-screen place-items-center bg-soc-bg text-soc-text">
        <Spinner label="Redirecting…" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-soc-bg" />
      <div className="absolute inset-0 opacity-[0.65]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(59,130,246,0.22),transparent_55%),radial-gradient(circle_at_85%_35%,rgba(16,185,129,0.12),transparent_55%),radial-gradient(circle_at_45%_90%,rgba(245,158,11,0.10),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(31,41,55,0.50)_1px,transparent_1px),linear-gradient(to_bottom,rgba(31,41,55,0.50)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10">
        <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="hidden lg:flex lg:flex-col lg:justify-center">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <Card padding="lg">
                <div className="flex items-center gap-3">
                  <div className="relative grid h-12 w-12 place-items-center overflow-hidden rounded-card border border-soc-border bg-soc-card shadow-card">
                    <div className="absolute inset-0 bg-gradient-to-br from-soc-info/35 via-transparent to-soc-success/20" />
                    <ShieldAlert className="relative h-6 w-6 text-soc-text" />
                  </div>
                  <div>
                    <div className="text-ui-base font-semibold text-soc-text">SentinelAI</div>
                    <div className="text-ui-xs text-soc-muted">Enterprise SOC Platform</div>
                  </div>
                </div>

                <div className="mt-6 text-3xl font-semibold tracking-tight text-soc-text">
                  Threat detection, triage, and response.
                </div>
                <div className="mt-3 text-ui-base leading-relaxed text-soc-muted">
                  Dark-mode SOC console with realtime alerts, AI copilot explanations, anomaly response automation, and performance telemetry.
                </div>

                <div className="mt-8 grid grid-cols-2 gap-3">
                  <Card className="bg-black/10 shadow-none" padding="md">
                    <div className="text-ui-sm font-semibold text-soc-text">Realtime</div>
                    <div className="mt-1 text-ui-xs text-soc-muted">Socket-driven alert stream</div>
                  </Card>
                  <Card className="bg-black/10 shadow-none" padding="md">
                    <div className="text-ui-sm font-semibold text-soc-text">Copilot</div>
                    <div className="mt-1 text-ui-xs text-soc-muted">Root cause + confidence</div>
                  </Card>
                  <Card className="bg-black/10 shadow-none" padding="md">
                    <div className="text-ui-sm font-semibold text-soc-text">Telemetry</div>
                    <div className="mt-1 text-ui-xs text-soc-muted">Requests, errors, latency</div>
                  </Card>
                  <Card className="bg-black/10 shadow-none" padding="md">
                    <div className="text-ui-sm font-semibold text-soc-text">Response</div>
                    <div className="mt-1 text-ui-xs text-soc-muted">Automated action trails</div>
                  </Card>
                </div>
              </Card>
            </motion.div>
          </div>

          <div className="flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="w-full max-w-md"
            >
              <Card padding="lg">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold text-soc-muted">Authentication</div>
                    <div className="mt-1 text-xl font-semibold tracking-tight text-soc-text">{title}</div>
                    <div className="mt-1 text-sm text-soc-muted">{subtitle}</div>
                  </div>
                  <div className="hidden h-12 w-12 place-items-center rounded-card border border-soc-border bg-black/10 sm:grid">
                    <ShieldAlert className="h-5 w-5 text-soc-muted" />
                  </div>
                </div>

                <form onSubmit={submit} className="mt-6 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-soc-muted">Email</label>
                    <div className="relative mt-2">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-soc-muted" />
                      <Input
                        className="pl-10"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        inputMode="email"
                        placeholder="you@company.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-soc-muted">Password</label>
                    <div className="relative mt-2">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-soc-muted" />
                      <Input
                        className="pl-10 pr-10"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                        placeholder="••••••••••••"
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-control p-2 text-soc-muted hover:bg-white/6 hover:text-soc-text"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {error ? (
                      <motion.div
                        key="error"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="rounded-xl border border-soc-critical/35 bg-soc-critical/10 px-3 py-2 text-sm text-soc-text"
                      >
                        <div className="text-xs font-semibold text-soc-critical">Error</div>
                        <div className="mt-1 whitespace-pre-wrap text-xs text-soc-muted">{error}</div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  <Button type="submit" variant="primary" className="w-full" loading={loading} disabled={loading}>
                    {mode === 'register' ? 'Create account' : 'Sign in'}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setError('');
                      setMode((m) => (m === 'register' ? 'login' : 'register'));
                    }}
                    disabled={loading}
                  >
                    {mode === 'register' ? 'Use existing account' : 'Create an account'}
                  </Button>
                </form>

                <div className="mt-5 text-[11px] text-soc-muted">
                  Token is stored as <span className="text-soc-text">sentinelai_token</span>.
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
