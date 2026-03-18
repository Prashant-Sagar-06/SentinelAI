const maliciousIPs = ['185.23.12.58', '45.33.32.156', '103.21.244.0'];

/**
 * Very small local-feed threat intel lookup.
 *
 * @param {string | undefined | null} ip
 * @returns {Promise<{reputation: 'malicious' | 'unknown', country: string, provider: 'local-feed'}>}
 */
export async function lookupThreatIntel(ip) {
  const normalized = typeof ip === 'string' ? ip.trim() : '';
  const reputation = normalized && maliciousIPs.includes(normalized) ? 'malicious' : 'unknown';

  return {
    reputation,
    country: 'Unknown',
    provider: 'local-feed',
  };
}
