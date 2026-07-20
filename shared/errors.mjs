export class ControlPlaneError extends Error {
  constructor(code, message, { status = 500, details = null } = {}) {
    super(message);
    this.name = 'ControlPlaneError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function normalizeError(error, requestId = 'req_unknown') {
  const safe = error instanceof ControlPlaneError
    ? error
    : new ControlPlaneError('internal_error', 'An unexpected runtime error occurred.');
  return {
    status: 'error',
    error: safe.name,
    code: safe.code,
    message: safe.message,
    details: safe.details,
    requestId
  };
}
