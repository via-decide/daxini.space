export function createClient({ baseUrl = '', tokenProvider = () => 'dev:local-user', workspaceId = 'default', fetchImpl = globalThis.fetch } = {}) {
  async function request(path, { method = 'GET', body } = {}) {
    const res = await fetchImpl(`${baseUrl}/api/v1${path}`, { method, headers: { authorization: `Bearer ${await tokenProvider()}`, 'content-type': 'application/json', 'x-workspace-id': workspaceId }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json(); if (json.status === 'error') throw Object.assign(new Error(json.message), json); return json.data;
  }
  return { request };
}
