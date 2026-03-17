export function redisConnectionFromUrl(redisUrl) {
  const u = new URL(redisUrl);
  const port = u.port ? Number(u.port) : 6379;
  const username = u.username || undefined;
  const password = u.password || undefined;
  const tls = u.protocol === 'rediss:' ? {} : undefined;

  return {
    host: u.hostname,
    port,
    username,
    password,
    tls,
  };
}
