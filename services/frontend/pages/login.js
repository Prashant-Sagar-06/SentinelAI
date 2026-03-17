import { useState } from 'react';
import { useRouter } from 'next/router';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('password123');
  const [mode, setMode] = useState('login');
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, role: 'admin' }),
    });
    if (!res.ok) {
      const txt = await res.text();
      setError(txt);
      return;
    }
    const data = await res.json();
    localStorage.setItem('sentinelai_token', data.token);
    router.push('/alerts');
  }

  return (
    <div className="container">
      <h1>SentinelAI</h1>
      <p className="small">Login to view alerts.</p>

      <div className="card" style={{ maxWidth: 420 }}>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 10 }}>
            <label className="small">Email</label>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label className="small">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <pre className="small" style={{ whiteSpace: 'pre-wrap', color: '#b91c1c' }}>
              {error}
            </pre>
          )}

          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button className="btn" type="submit">
              {mode === 'register' ? 'Register' : 'Login'}
            </button>
            <button
              className="btn secondary"
              type="button"
              onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
            >
              Switch to {mode === 'register' ? 'login' : 'register'}
            </button>
          </div>
        </form>
      </div>

      <p className="small" style={{ marginTop: 12 }}>
        Default suggestion: register once, then login.
      </p>
    </div>
  );
}
