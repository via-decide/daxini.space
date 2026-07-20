export const runtimeApi = (client) => ({ health: () => client.request('/runtime'), monitoring: () => client.request('/monitoring') });
