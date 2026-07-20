export const workspaceApi = (client) => ({ list: () => client.request('/workspaces') });
