export const jobsApi = (client) => ({ list: () => client.request('/jobs'), get: (id) => client.request(`/jobs/${id}`), create: (input) => client.request('/jobs', { method: 'POST', body: input }) });
