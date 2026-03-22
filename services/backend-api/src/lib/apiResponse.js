export function ok(res, data, { status = 200 } = {}) {
  return res.status(status).json({ data, error: null });
}

export function fail(
  res,
  {
    status = 400,
    code = 'request_error',
    message = 'Request failed',
    details = undefined,
    requestId = undefined,
  } = {}
) {
  const error = {
    message,
    code,
    ...(details !== undefined ? { details } : {}),
    ...(requestId ? { requestId } : {}),
  };
  return res.status(status).json({ data: null, error });
}
