import express from 'express';
import net from 'node:net';

import { Alert } from '../models/Alert.js';

export const attackMapRouter = express.Router();

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** @type {Map<string, {expiresAt: number, value: null | {country: string, city: string, lat: number, lon: number}}>} */
const geoCache = new Map();

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function normalizeIp(ip) {
  return typeof ip === 'string' ? ip.trim() : '';
}

function isPrivateOrInternalIp(ip) {
  const kind = net.isIP(ip);
  if (!kind) return true;

  // IPv4
  if (kind === 4) {
    const parts = ip.split('.').map((p) => Number(p));
    if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true;

    const [a, b] = parts;

    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
    if (a >= 224) return true; // multicast/reserved
    return false;
  }

  // IPv6
  const lower = ip.toLowerCase();
  if (lower === '::1') return true; // loopback
  if (lower.startsWith('fe80:')) return true; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
  return false;
}

function getCachedGeo(ip) {
  const entry = geoCache.get(ip);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    geoCache.delete(ip);
    return undefined;
  }
  return entry.value;
}

function setCachedGeo(ip, value) {
  geoCache.set(ip, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

async function fetchGeo(ip) {
  const cached = getCachedGeo(ip);
  if (cached !== undefined) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}`, {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
      },
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json || json.status !== 'success') {
      setCachedGeo(ip, null);
      return null;
    }

    const lat = Number(json.lat);
    const lon = Number(json.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setCachedGeo(ip, null);
      return null;
    }

    const value = {
      country: isNonEmptyString(json.country) ? json.country : 'Unknown',
      city: isNonEmptyString(json.city) ? json.city : 'Unknown',
      lat,
      lon,
    };

    setCachedGeo(ip, value);
    return value;
  } catch {
    setCachedGeo(ip, null);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const idx = nextIndex;
      nextIndex += 1;
      if (idx >= items.length) return;
      // eslint-disable-next-line no-await-in-loop
      results[idx] = await fn(items[idx], idx);
    }
  }

  const count = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: count }, () => worker()));
  return results;
}

attackMapRouter.get('/', async (req, res, next) => {
  try {
    const rows = await Alert.aggregate([
      {
        $match: {
          source_ip: { $type: 'string', $ne: '' },
        },
      },
      {
        $group: {
          _id: '$source_ip',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 50 },
    ]);

    const attacks = await mapWithConcurrency(rows, 5, async (row) => {
      const ip = normalizeIp(row?._id);
      const count = Number(row?.count ?? 0);
      if (!ip || !Number.isFinite(count) || count <= 0) return null;

      if (isPrivateOrInternalIp(ip)) return null;

      const geo = await fetchGeo(ip);
      if (!geo) return null;

      return {
        ip,
        country: geo.country,
        city: geo.city,
        lat: geo.lat,
        lon: geo.lon,
        count,
      };
    });

    res.json({ attacks: attacks.filter(Boolean) });
  } catch (e) {
    next(e);
  }
});
