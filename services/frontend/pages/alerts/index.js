import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import Link from 'next/link';
import { useRouter } from 'next/router';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

function classNames(...xs) {
  return xs.filter(Boolean).join(' ');
}

function badgeTone(sev) {
  const s = String(sev ?? '').toLowerCase();
  if (s === 'critical') return 'bg-red-400/10 text-red-200 ring-1 ring-red-500/20';
  if (s === 'high') return 'bg-orange-400/10 text-orange-200 ring-1 ring-orange-500/20';
  if (s === 'medium') return 'bg-amber-400/10 text-amber-200 ring-1 ring-amber-500/20';
  if (s === 'low') return 'bg-emerald-400/10 text-emerald-200 ring-1 ring-emerald-500/20';
  return 'bg-slate-400/10 text-slate-200 ring-1 ring-slate-500/20';
}

function badge(sev) {
  return (
    <span className={classNames('rounded-full px-2.5 py-1 text-xs font-medium', badgeTone(sev))}>
      {sev}
    </span>
  );
}

function fmtTime(v) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString();
}

export default function Alerts() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('sentinelai_token');
    if (!token) {
      router.push('/login');
      return;
    }

    (async () => {
      const res = await fetch(`${API_BASE}/api/alerts?limit=50`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const data = await res.json();
      setItems(data.items || []);
    })();
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('sentinelai_token');
    if (!token) return undefined;

    async function refresh() {
      try {
        const res = await fetch(`${API_BASE}/api/alerts?limit=50`, { headers: { authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (res.ok && !cancelled) setItems(data.items || []);
      } catch {
        // best-effort; page already shows errors for initial load
      }
    }

    const socket = io(API_BASE);

    socket.on('connect_error', () => {
      // no-op; best-effort realtime
    });

    socket.on('alert_created', () => {
      refresh();
    });

    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">SentinelAI</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Alerts</h1>
          </div>

          <button
            type="button"
            className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-900/40"
            onClick={() => {
              localStorage.removeItem('sentinelai_token');
              router.push('/login');
            }}
          >
            Logout
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-4">
          {items.map((a) => (
            <Link key={a._id} href={`/alerts/${a._id}`} className="block">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm hover:bg-slate-900">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{a.title}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {a.threat_type} • {a.status}
                    </div>
                  </div>
                  {badge(a.severity)}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <div className="text-xs text-slate-400">Events</div>
                    <div className="mt-0.5 text-sm text-slate-100">{a.event_count ?? a.counts?.occurrences ?? 1}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <div className="text-xs text-slate-400">First Seen</div>
                    <div className="mt-0.5 text-sm text-slate-100">
                      {fmtTime(a.first_seen ?? a.counts?.first_seen_at ?? a.createdAt)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <div className="text-xs text-slate-400">Last Seen</div>
                    <div className="mt-0.5 text-sm text-slate-100">
                      {fmtTime(a.last_seen ?? a.counts?.last_seen_at ?? a.updatedAt)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-sm text-slate-200">{a.reason}</div>
              </div>
            </Link>
          ))}
          {!items.length ? <div className="text-sm text-slate-400">No alerts yet.</div> : null}
        </div>
      </div>
    </div>
  );
}
