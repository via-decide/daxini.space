export const EventTypes = Object.freeze({
  WorkspaceCreated: 'WorkspaceCreated', ProjectCreated: 'ProjectCreated', JobQueued: 'JobQueued', JobStarted: 'JobStarted',
  JobCompleted: 'JobCompleted', DeploymentCreated: 'DeploymentCreated', DeploymentCompleted: 'DeploymentCompleted', RuntimeOnline: 'RuntimeOnline', RuntimeOffline: 'RuntimeOffline'
});

export function createEventBus() {
  const listeners = new Map();
  return {
    on(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); return () => listeners.get(type)?.delete(handler); },
    emit(type, payload = {}) { const event = { type, payload, occurredAt: new Date().toISOString() }; (listeners.get(type) || []).forEach((handler) => handler(event)); return event; }
  };
}
