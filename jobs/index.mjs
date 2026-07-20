import { EventTypes } from '../events/index.mjs';
export const JobStates = Object.freeze(['Created','Queued','Running','Streaming','Evaluating','Completed','Failed','Cancelled']);
export function createJobService({ db, events }) {
  return {
    createJob({ workspaceId, type = 'runtime.action', payload = {}, userId = 'system' }) { const job = db.insert('jobs', { workspaceId, type, payload, userId, state: 'Created', metadata: { createdAt: new Date().toISOString(), transitions: ['Created'] } }); this.transition(job.id, 'Queued'); return db.get('jobs', job.id); },
    getJob(id, workspaceId) { const job = db.get('jobs', id); return job && job.workspaceId === workspaceId ? job : null; },
    listJobs(workspaceId) { return db.list('jobs', (job) => job.workspaceId === workspaceId); },
    transition(id, state, patch = {}) { if (!JobStates.includes(state)) throw new Error(`Unsupported job state: ${state}`); const current = db.get('jobs', id); const next = db.update('jobs', id, { ...patch, state, metadata: { ...current.metadata, updatedAt: new Date().toISOString(), transitions: [...(current.metadata?.transitions || []), state] } }); if (state === 'Queued') events?.emit(EventTypes.JobQueued, { jobId: id }); if (state === 'Running') events?.emit(EventTypes.JobStarted, { jobId: id }); if (state === 'Completed') events?.emit(EventTypes.JobCompleted, { jobId: id }); return next; }
  };
}
