export function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error(err);
  const status = err.statusCode ?? 500;
  res.status(status).json({ error: 'server_error', message: err.message });
}
