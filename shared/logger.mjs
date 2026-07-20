export function createRequestId(prefix = 'req') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createLogger({ sink = console } = {}) {
  const write = (level, event) => sink[level === 'error' ? 'error' : 'log'](JSON.stringify({ level, ts: new Date().toISOString(), ...event }));
  return { info: (event) => write('info', event), warn: (event) => write('warn', event), error: (event) => write('error', event) };
}
