import { ControlPlaneError } from '../shared/errors.mjs';
export function createIdentityService({ db }) {
  return {
    validateJwt(token) {
      if (!token) throw new ControlPlaneError('unauthorized', 'Missing bearer token.', { status: 401 });
      const userId = token.replace(/^dev:/, '') || 'anonymous';
      return db.get('users', userId) || db.insert('users', { id: userId, email: `${userId}@local.daxini`, roles: ['operator'] });
    },
    resolvePermissions(user, workspaceId) { return { userId: user.id, workspaceId, roles: user.roles || [], canRead: true, canWrite: (user.roles || []).includes('operator') }; }
  };
}
