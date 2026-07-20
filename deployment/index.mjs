import { EventTypes } from '../events/index.mjs';
export function createDeploymentService({ db, events }) {
  return { createDeployment({ workspaceId, target = 'local', mode = 'Local Runtime', config = {} }) { const deployment = db.insert('deployments', { workspaceId, target, mode, config, state: 'Created', createdAt: new Date().toISOString() }); events?.emit(EventTypes.DeploymentCreated, { deploymentId: deployment.id }); return deployment; }, listDeployments(workspaceId) { return db.list('deployments', (deployment) => deployment.workspaceId === workspaceId); }, completeDeployment(id) { const deployment = db.update('deployments', id, { state: 'Completed', completedAt: new Date().toISOString() }); events?.emit(EventTypes.DeploymentCompleted, { deploymentId: id }); return deployment; } };
}
