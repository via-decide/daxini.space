export function createMemoryDatabase(seed = {}) {
  const tables = new Map(['users','organizations','workspaces','projects','jobs','deployments','runtimeRegistry','auditLogs','configurations'].map((name) => [name, new Map()]));
  Object.entries(seed).forEach(([table, rows]) => rows?.forEach((row) => tables.get(table)?.set(row.id, { ...row })));
  return {
    insert(table, row) { const id = row.id || `${table}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; const stored = { ...row, id }; tables.get(table).set(id, stored); return { ...stored }; },
    get(table, id) { const row = tables.get(table)?.get(id); return row ? { ...row } : null; },
    list(table, predicate = () => true) { return [...(tables.get(table)?.values() || [])].filter(predicate).map((row) => ({ ...row })); },
    update(table, id, patch) { const row = this.get(table, id); if (!row) return null; const next = { ...row, ...patch }; tables.get(table).set(id, next); return { ...next }; }
  };
}
