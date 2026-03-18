import { useEffect, useMemo, useRef, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';

const DEFAULT_API_BASE = 'http://localhost:4000';
const DEFAULT_GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function colorForCount(count, maxCount) {
  const c = Number(count);
  const m = Number(maxCount);
  if (!Number.isFinite(c) || c <= 0) return 'rgba(148, 163, 184, 0.65)';
  if (!Number.isFinite(m) || m <= 0) return 'rgba(249, 115, 22, 0.75)';

  const t = clamp(c / m, 0, 1);
  // Tailwind-ish: orange-500 -> red-500
  const r = Math.round(lerp(249, 239, t));
  const g = Math.round(lerp(115, 68, t));
  const b = Math.round(lerp(22, 68, t));
  const a = lerp(0.7, 0.9, t);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function radiusForCount(count, maxCount) {
  const c = Number(count);
  const m = Number(maxCount);
  if (!Number.isFinite(c) || c <= 0) return 0;
  if (!Number.isFinite(m) || m <= 0) return 4;

  const ratio = clamp(c / m, 0, 1);
  // sqrt scaling keeps large counts from dominating
  return 4 + 14 * Math.sqrt(ratio);
}

export default function AttackMap({ token, apiBaseUrl, geographyUrl }) {
  const apiBase = apiBaseUrl || process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE;
  const geoUrl = geographyUrl || DEFAULT_GEO_URL;

  const abortRef = useRef(null);
  const intervalRef = useRef(null);

  const [attacks, setAttacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, attack: null });

  const maxCount = useMemo(() => {
    return attacks.reduce((m, a) => Math.max(m, Number(a?.count ?? 0) || 0), 0);
  }, [attacks]);

  async function load() {
    if (!token) {
      setLoading(false);
      setError('');
      setAttacks([]);
      return;
    }

    abortRef.current?.abort?.();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setError('');

      const res = await fetch(`${apiBase}/api/attack-map`, {
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/json',
        },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load attack map');

      const items = Array.isArray(json.attacks) ? json.attacks : [];
      setAttacks(items.slice(0, 50));
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setError(e?.message || 'Failed to load attack map');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load();

    intervalRef.current = setInterval(() => {
      load();
    }, 10_000);

    return () => {
      abortRef.current?.abort?.();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, apiBase]);

  return (
    <div className="relative h-64 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 130 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#0f172a"
                stroke="#334155"
                strokeWidth={0.5}
                style={{
                  default: { outline: 'none' },
                  hover: { outline: 'none' },
                  pressed: { outline: 'none' },
                }}
              />
            ))
          }
        </Geographies>

        {attacks.map((a) => {
          const lat = Number(a?.lat);
          const lon = Number(a?.lon);
          const count = Number(a?.count ?? 0);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

          const r = radiusForCount(count, maxCount);
          const fill = colorForCount(count, maxCount);

          return (
            <Marker
              key={a.ip}
              coordinates={[lon, lat]}
              onMouseEnter={(evt) => {
                setTooltip({ visible: true, x: evt.clientX, y: evt.clientY, attack: a });
              }}
              onMouseMove={(evt) => {
                setTooltip((t) => (t.visible ? { ...t, x: evt.clientX, y: evt.clientY, attack: a } : t));
              }}
              onMouseLeave={() => {
                setTooltip({ visible: false, x: 0, y: 0, attack: null });
              }}
            >
              <circle className="attack-pulse" r={r} fill={fill} stroke="none" />
              <circle r={r} fill={fill} stroke="#7f1d1d" strokeWidth={1} />
            </Marker>
          );
        })}
      </ComposableMap>

      <style jsx>{`
        .attack-pulse {
          transform-origin: center;
          transform-box: fill-box;
          animation: attackPulse 1.8s ease-out infinite;
        }

        @keyframes attackPulse {
          0% {
            transform: scale(1);
            opacity: 0.55;
          }
          100% {
            transform: scale(2.4);
            opacity: 0;
          }
        }
      `}</style>

      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 text-xs text-slate-300">
          Loading map…
        </div>
      ) : null}

      {error ? (
        <div className="absolute left-3 top-3 rounded-lg border border-red-900/40 bg-red-950/40 px-2.5 py-1 text-xs text-red-200">
          {error}
        </div>
      ) : null}

      {tooltip.visible && tooltip.attack ? (
        <div
          className="pointer-events-none fixed z-50 rounded-xl border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs text-slate-100 shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12, maxWidth: 260 }}
        >
          <div className="font-semibold text-slate-100">{tooltip.attack.ip}</div>
          <div className="mt-0.5 text-slate-300">
            {tooltip.attack.city}, {tooltip.attack.country}
          </div>
          <div className="mt-1 flex items-center justify-between gap-6">
            <span className="text-slate-300">Attacks</span>
            <span className="font-semibold text-slate-100">{tooltip.attack.count}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
