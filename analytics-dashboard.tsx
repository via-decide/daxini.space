/**
 * analytics-dashboard.tsx
 * Daxini.Space — Creator & Discovery Analytics Dashboard
 *
 * Reads from Firestore analyticsDailyCounts collection.
 * Renders two dashboards: Discovery Funnel + Creator Funnel.
 * Can be embedded in any admin page or daxini.xyz dashboard route.
 */

import React, { useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyCount {
  date_key: string;
  search_performed:    number;
  category_opened:     number;
  app_view:            number;
  app_install_click:   number;
  external_link_click: number;
  creator_signup:      number;
  app_publish:         number;
  returning_creator:   number;
  returning_user:      number;
}

interface TopSearchEntry { query: string; count: number; }
interface TopAppEntry    { app: string;  views: number; installs: number; }

// ─── Firestore REST Helpers ───────────────────────────────────────────────────

const PROJECT_ID = 'logichub-app';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function fetchDailyCounts(days = 30): Promise<DailyCount[]> {
  const results: DailyCount[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    try {
      const r = await fetch(`${BASE}/analyticsDailyCounts/${key}`);
      if (!r.ok) continue;
      const json = await r.json();
      const f = json.fields || {};
      const n = (k: string) => parseInt(f[k]?.integerValue || '0', 10);
      results.push({
        date_key:            key,
        search_performed:    n('search_performed'),
        category_opened:     n('category_opened'),
        app_view:            n('app_view'),
        app_install_click:   n('app_install_click'),
        external_link_click: n('external_link_click'),
        creator_signup:      n('creator_signup'),
        app_publish:         n('app_publish'),
        returning_creator:   n('returning_creator'),
        returning_user:      n('returning_user'),
      });
    } catch { /* skip missing days */ }
  }
  return results.sort((a, b) => a.date_key.localeCompare(b.date_key));
}

async function fetchTopSearches(limit = 10): Promise<TopSearchEntry[]> {
  // Queries analyticsEvents where event_name = 'search_performed'
  const r = await fetch(`${BASE}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'analyticsEvents' }],
        where: { fieldFilter: { field: { fieldPath: 'event_name' }, op: 'EQUAL', value: { stringValue: 'search_performed' } } },
        limit: 1000,
      }
    })
  });
  const docs = await r.json();
  const countMap: Record<string, number> = {};
  for (const d of Array.isArray(docs) ? docs : []) {
    const meta = d?.document?.fields?.metadata_json?.stringValue;
    if (!meta) continue;
    try {
      const { query } = JSON.parse(meta);
      if (query) countMap[query] = (countMap[query] || 0) + 1;
    } catch { /* skip */ }
  }
  return Object.entries(countMap)
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

async function fetchTopApps(limit = 10): Promise<TopAppEntry[]> {
  const views: Record<string, number>    = {};
  const installs: Record<string, number> = {};

  const r = await fetch(`${BASE}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'analyticsEvents' }],
        where: { fieldFilter: { field: { fieldPath: 'event_name' }, op: 'IN',
          value: { arrayValue: { values: [
            { stringValue: 'app_view' },
            { stringValue: 'app_install_click' },
          ]}}
        }},
        limit: 5000,
      }
    })
  });
  const docs = await r.json();
  for (const d of Array.isArray(docs) ? docs : []) {
    const f = d?.document?.fields;
    if (!f) continue;
    const appId = f.app_id?.stringValue || '';
    const event = f.event_name?.stringValue || '';
    if (!appId) continue;
    if (event === 'app_view')         views[appId]    = (views[appId]    || 0) + 1;
    if (event === 'app_install_click') installs[appId] = (installs[appId] || 0) + 1;
  }

  return Object.keys({ ...views, ...installs })
    .map(app => ({ app, views: views[app] || 0, installs: installs[app] || 0 }))
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div style={{ background: 'rgba(0,255,136,0.07)', border: '1px solid #00ff8844', borderRadius: 12, padding: '20px 24px', minWidth: 140 }}>
      <div style={{ color: '#00ff88', fontSize: 28, fontWeight: 700 }}>{value.toLocaleString()}</div>
      <div style={{ color: '#ccc', fontSize: 13, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function FunnelBar({ label, value, max, color = '#00ff88' }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#ccc', marginBottom: 4 }}>
        <span>{label}</span><span>{value.toLocaleString()} ({pct}%)</span>
      </div>
      <div style={{ background: '#1a1a1a', borderRadius: 6, height: 10, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 6, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AnalyticsDashboard() {
  const [counts, setCounts]       = useState<DailyCount[]>([]);
  const [searches, setSearches]   = useState<TopSearchEntry[]>([]);
  const [topApps, setTopApps]     = useState<TopAppEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<'discovery' | 'creator'>('discovery');

  useEffect(() => {
    Promise.all([
      fetchDailyCounts(30).then(setCounts),
      fetchTopSearches(10).then(setSearches),
      fetchTopApps(10).then(setTopApps),
    ]).finally(() => setLoading(false));
  }, []);

  const sum = (key: keyof Omit<DailyCount, 'date_key'>) =>
    counts.reduce((acc, d) => acc + (d[key] || 0), 0);

  const totalSearches  = sum('search_performed');
  const totalViews     = sum('app_view');
  const totalInstalls  = sum('app_install_click');
  const totalSignups   = sum('creator_signup');
  const totalPublish   = sum('app_publish');
  const totalReturnU   = sum('returning_user');
  const totalReturnC   = sum('returning_creator');

  const style = {
    container: { background: '#0a0f0c', color: '#e0ffe0', fontFamily: '"SF Mono", "Fira Code", monospace', minHeight: '100vh', padding: 32 },
    heading:   { color: '#00ff88', fontSize: 22, fontWeight: 700, letterSpacing: 1, marginBottom: 8 },
    section:   { marginBottom: 40 },
    grid:      { display: 'flex', gap: 16, flexWrap: 'wrap' as const, marginBottom: 24 },
    tab:       (active: boolean): React.CSSProperties => ({
      padding: '8px 20px', cursor: 'pointer', borderRadius: 8,
      background: active ? '#00ff88' : 'transparent',
      color: active ? '#0a0f0c' : '#00ff88',
      border: '1px solid #00ff8844', fontWeight: 700, fontSize: 13,
    }),
  };

  if (loading) return (
    <div style={{ ...style.container, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#00ff88', fontSize: 18 }}>⚡ Loading Analytics...</div>
    </div>
  );

  return (
    <div style={style.container}>
      <h1 style={{ ...style.heading, fontSize: 28, marginBottom: 4 }}>DAXINI.SPACE ANALYTICS</h1>
      <div style={{ color: '#666', fontSize: 12, marginBottom: 32 }}>Last 30 days · Creator & Discovery Intelligence</div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 32 }}>
        <button style={style.tab(activeTab === 'discovery')} onClick={() => setActiveTab('discovery')}>DISCOVERY</button>
        <button style={style.tab(activeTab === 'creator')}   onClick={() => setActiveTab('creator')}>CREATOR</button>
      </div>

      {/* ── DISCOVERY DASHBOARD ── */}
      {activeTab === 'discovery' && (
        <>
          <div style={style.section}>
            <div style={style.heading}>Discovery Metrics</div>
            <div style={style.grid}>
              <MetricCard label="Searches"       value={totalSearches} />
              <MetricCard label="App Views"      value={totalViews}    />
              <MetricCard label="Install Clicks" value={totalInstalls} />
              <MetricCard label="Returning Users" value={totalReturnU} />
            </div>
          </div>

          <div style={style.section}>
            <div style={style.heading}>Discovery Funnel</div>
            <div style={{ maxWidth: 560 }}>
              <FunnelBar label="🔍 Searches"       value={totalSearches} max={totalSearches} color="#00ff88" />
              <FunnelBar label="📱 App Views"      value={totalViews}    max={totalSearches} color="#00ccff" />
              <FunnelBar label="⬇️  Install Clicks" value={totalInstalls} max={totalViews}    color="#ffaa00" />
            </div>
            <div style={{ color: '#888', fontSize: 12, marginTop: 8 }}>
              View Rate: {totalSearches > 0 ? Math.round(totalViews / totalSearches * 100) : 0}% ·
              Install Intent: {totalViews > 0 ? Math.round(totalInstalls / totalViews * 100) : 0}%
            </div>
          </div>

          <div style={style.section}>
            <div style={style.heading}>Top Search Terms</div>
            {searches.length === 0 ? (
              <div style={{ color: '#555', fontSize: 13 }}>No search data yet.</div>
            ) : (
              <table style={{ borderCollapse: 'collapse', fontSize: 13, color: '#ccc', width: '100%', maxWidth: 480 }}>
                <thead><tr>
                  <th style={{ textAlign: 'left', padding: '4px 12px', color: '#00ff88' }}>#</th>
                  <th style={{ textAlign: 'left', padding: '4px 12px', color: '#00ff88' }}>Query</th>
                  <th style={{ textAlign: 'right', padding: '4px 12px', color: '#00ff88' }}>Count</th>
                </tr></thead>
                <tbody>{searches.map((s, i) => (
                  <tr key={s.query} style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <td style={{ padding: '6px 12px', color: '#555' }}>{i + 1}</td>
                    <td style={{ padding: '6px 12px' }}>{s.query}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: '#00ff88' }}>{s.count}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>

          <div style={style.section}>
            <div style={style.heading}>Top Apps</div>
            {topApps.length === 0 ? (
              <div style={{ color: '#555', fontSize: 13 }}>No app view data yet.</div>
            ) : (
              <table style={{ borderCollapse: 'collapse', fontSize: 13, color: '#ccc', width: '100%', maxWidth: 560 }}>
                <thead><tr>
                  <th style={{ textAlign: 'left', padding: '4px 12px', color: '#00ff88' }}>App</th>
                  <th style={{ textAlign: 'right', padding: '4px 12px', color: '#00ff88' }}>Views</th>
                  <th style={{ textAlign: 'right', padding: '4px 12px', color: '#00ff88' }}>Installs</th>
                  <th style={{ textAlign: 'right', padding: '4px 12px', color: '#00ff88' }}>Intent%</th>
                </tr></thead>
                <tbody>{topApps.map(a => (
                  <tr key={a.app} style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <td style={{ padding: '6px 12px' }}>{a.app}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right' }}>{a.views}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: '#ffaa00' }}>{a.installs}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: '#00ccff' }}>
                      {a.views > 0 ? Math.round(a.installs / a.views * 100) : 0}%
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── CREATOR DASHBOARD ── */}
      {activeTab === 'creator' && (
        <>
          <div style={style.section}>
            <div style={style.heading}>Creator Metrics</div>
            <div style={style.grid}>
              <MetricCard label="Creator Signups"    value={totalSignups}  />
              <MetricCard label="Apps Published"     value={totalPublish}  />
              <MetricCard label="Returning Creators" value={totalReturnC}  />
            </div>
          </div>

          <div style={style.section}>
            <div style={style.heading}>Creator Funnel</div>
            <div style={{ maxWidth: 560 }}>
              <FunnelBar label="✍️  Creator Signups" value={totalSignups} max={totalSignups} color="#00ff88" />
              <FunnelBar label="🚀 Apps Published"   value={totalPublish} max={totalSignups} color="#ffaa00" />
            </div>
            <div style={{ color: '#888', fontSize: 12, marginTop: 8 }}>
              Publish Conversion: {totalSignups > 0 ? Math.round(totalPublish / totalSignups * 100) : 0}% ·
              Creator Retention: {totalSignups > 0 ? Math.round(totalReturnC / totalSignups * 100) : 0}%
            </div>
          </div>
        </>
      )}
    </div>
  );
}
