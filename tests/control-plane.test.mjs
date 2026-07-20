import test from 'node:test';
import assert from 'node:assert/strict';
import { createControlPlane } from '../runtime/control-plane.mjs';

test('gateway creates and reads workspace-isolated jobs', async () => {
  const plane = createControlPlane();
  const headers = { authorization: 'Bearer dev:alice', 'x-workspace-id': 'alpha' };
  const created = await plane.gateway.route({ method: 'POST', path: '/api/v1/jobs', headers, body: { type: 'chat' } });
  assert.equal(created.status, 'ok');
  assert.equal(created.data.state, 'Queued');

  const sameWorkspace = await plane.gateway.route({ method: 'GET', path: `/api/v1/jobs/${created.data.id}`, headers });
  assert.equal(sameWorkspace.data.id, created.data.id);

  const otherWorkspace = await plane.gateway.route({ method: 'GET', path: `/api/v1/jobs/${created.data.id}`, headers: { ...headers, 'x-workspace-id': 'beta' } });
  assert.equal(otherWorkspace.data, null);
});

test('runtime dashboard endpoints expose health and monitoring', async () => {
  const plane = createControlPlane();
  const headers = { authorization: 'Bearer dev:alice', 'x-workspace-id': 'alpha' };
  const runtime = await plane.gateway.route({ method: 'GET', path: '/api/v1/runtime', headers });
  const monitoring = await plane.gateway.route({ method: 'GET', path: '/api/v1/monitoring', headers });
  assert.equal(runtime.status, 'ok');
  assert.equal(runtime.data.status, 'ok');
  assert.ok(Array.isArray(monitoring.data.runtimes));
});
