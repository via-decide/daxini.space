import { ControlPlaneError } from '../shared/errors.mjs';
import { EventTypes } from '../events/index.mjs';
export function createWorkspaceService({ db, events }) {
  return {
    ensureWorkspace({ id = 'default', ownerId = 'system', name = 'Default Workspace' } = {}) {
      return db.get('workspaces', id) || db.insert('workspaces', { id, ownerId, name, status: 'active', projects: [], knowledge: [], memory: {}, agents: [], configuration: {}, deployments: [] });
    },
    resolveWorkspace(request) { const id = request.headers?.['x-workspace-id'] || 'default'; const workspace = this.ensureWorkspace({ id }); if (request.user && workspace.ownerId !== 'system' && workspace.ownerId !== request.user.id) throw new ControlPlaneError('workspace_forbidden', 'Workspace access denied.', { status: 403 }); return workspace; },
    createWorkspace(input) { const workspace = db.insert('workspaces', { status: 'active', projects: [], knowledge: [], memory: {}, agents: [], configuration: {}, deployments: [], ...input }); events?.emit(EventTypes.WorkspaceCreated, { workspaceId: workspace.id }); return workspace; },
    listForUser(user) { return db.list('workspaces', (workspace) => workspace.ownerId === 'system' || workspace.ownerId === user.id); }
  };
}
