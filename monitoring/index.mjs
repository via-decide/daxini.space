export function createMonitoringService({ db, runtimeRegistry }) {
  return { snapshot(workspaceId = 'default') { const jobs = db.list('jobs', (job) => job.workspaceId === workspaceId); return { cpu: 0, ram: 0, gpu: null, vram: null, queue: jobs.filter((job) => job.state === 'Queued').length, latency: 0, requests: db.list('auditLogs').length, errors: 0, jobs: jobs.length, workspaceActivity: jobs.slice(-10), modelUtilization: [], runtimes: runtimeRegistry.list() }; } };
}
