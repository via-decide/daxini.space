import { createRequestId, createLogger } from '../shared/logger.mjs';
import { normalizeError, ControlPlaneError } from '../shared/errors.mjs';

export function createGateway({ identity, workspaces, jobs, runtimeRegistry, monitoring, deployments, logger = createLogger() }) {
  const buckets = new Map();
  const guardRate = (key, limit = 120) => { const now = Date.now(); const bucket = (buckets.get(key) || []).filter((ts) => now - ts < 60000); if (bucket.length >= limit) throw new ControlPlaneError('rate_limited', 'Too many requests.', { status: 429 }); bucket.push(now); buckets.set(key, bucket); };
  const route = async (request) => {
    const started = Date.now(); const requestId = request.headers?.['x-request-id'] || createRequestId();
    try {
      guardRate(request.headers?.authorization || 'anonymous');
      const user = identity.validateJwt((request.headers?.authorization || '').replace(/^Bearer\s+/i, ''));
      request.user = user; const workspace = workspaces.resolveWorkspace(request); const path = (request.path || request.url || '').replace(/\?.*/, '');
      let data;
      if (request.method === 'GET' && path === '/api/v1/runtime') data = runtimeRegistry.health();
      else if (request.method === 'GET' && path === '/api/v1/workspaces') data = workspaces.listForUser(user);
      else if (request.method === 'GET' && path === '/api/v1/monitoring') data = monitoring.snapshot(workspace.id);
      else if (request.method === 'GET' && path === '/api/v1/deployments') data = deployments.listDeployments(workspace.id);
      else if (request.method === 'POST' && path === '/api/v1/deployments') data = deployments.createDeployment({ workspaceId: workspace.id, ...(request.body || {}) });
      else if (request.method === 'POST' && path === '/api/v1/jobs') data = jobs.createJob({ workspaceId: workspace.id, userId: user.id, ...(request.body || {}) });
      else if (request.method === 'GET' && path === '/api/v1/jobs') data = jobs.listJobs(workspace.id);
      else if (request.method === 'GET' && path.startsWith('/api/v1/jobs/')) data = jobs.getJob(path.split('/').pop(), workspace.id);
      else throw new ControlPlaneError('not_found', 'API route not found.', { status: 404 });
      logger.info({ requestId, workspace: workspace.id, user: user.id, runtime: 'gateway', duration: Date.now() - started, result: 'ok' });
      return { status: 'ok', data, requestId };
    } catch (error) {
      const body = normalizeError(error, requestId); logger.error({ requestId, duration: Date.now() - started, result: body.code }); return body;
    }
  };
  return { route, version: 'v1', supportsStreaming: true };
}
