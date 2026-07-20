import { createMemoryDatabase } from '../database/index.mjs';
import { createEventBus } from '../events/index.mjs';
import { createIdentityService } from '../identity/index.mjs';
import { createWorkspaceService } from '../workspace/index.mjs';
import { createJobService } from '../jobs/index.mjs';
import { createRuntimeRegistry } from './index.mjs';
import { createMonitoringService } from '../monitoring/index.mjs';
import { createDeploymentService } from '../deployment/index.mjs';
import { createGateway } from '../gateway/index.mjs';

export function createControlPlane(seed = {}) {
  const db = createMemoryDatabase(seed); const events = createEventBus();
  const identity = createIdentityService({ db }); const workspaces = createWorkspaceService({ db, events });
  const jobs = createJobService({ db, events }); const runtimeRegistry = createRuntimeRegistry({ db });
  const monitoring = createMonitoringService({ db, runtimeRegistry }); const deployments = createDeploymentService({ db, events });
  const gateway = createGateway({ identity, workspaces, jobs, runtimeRegistry, monitoring, deployments });
  workspaces.ensureWorkspace();
  return { db, events, identity, workspaces, jobs, runtimeRegistry, monitoring, deployments, gateway };
}
