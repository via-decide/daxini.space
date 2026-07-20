export const deploymentApi = (client) => ({ list: () => client.request('/deployments'), create: (input) => client.request('/deployments', { method: 'POST', body: input }) });
