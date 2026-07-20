export function createRuntimeRegistry({ db }) {
  const defaults = ['Reasoning Runtime','Knowledge Runtime','Memory Runtime','Model Router','Execution Runtime','Manufacturing Runtime','Evaluation Runtime'];
  defaults.forEach((name) => db.get('runtimeRegistry', name) || db.insert('runtimeRegistry', { id: name, name, health: 'unknown', version: '0.1.0', status: 'standby', latency: 0, memoryUsage: 0, queueDepth: 0 }));
  return { list() { return db.list('runtimeRegistry'); }, report(id, metrics) { return db.update('runtimeRegistry', id, { ...metrics, reportedAt: new Date().toISOString() }); }, health() { return { status: 'ok', runtimes: this.list() }; } };
}
