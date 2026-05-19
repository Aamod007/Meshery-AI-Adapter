import { useEffect, useState } from 'react';
import { Activity, Server, CheckCircle, XCircle, Clock, Trash2, Eye, Search, RefreshCw } from 'lucide-react';

interface K8sResource {
  name: string;
  kind: string;
  namespace: string;
  status: string;
  age: string;
}

export function StatusPage() {
  const [resources, setResources] = useState<K8sResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [summary, setSummary] = useState({ pods: 0, running: 0, pending: 0, failed: 0, nodes: 0 });
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchAll = async () => {
    try {
      const [resRes, sumRes, evtRes] = await Promise.all([
        fetch('/api/status/resources'),
        fetch('/api/status/summary'),
        fetch('/api/status/events'),
      ]);
      if (resRes.ok) setResources((await resRes.json()).resources || []);
      if (sumRes.ok) setSummary(await sumRes.json());
      if (evtRes.ok) setEvents((await evtRes.json()).events || []);
    } catch {}
    setLoading(false);
  };

  const handleDelete = async (name: string, kind: string, ns: string) => {
    if (!confirm(`Delete ${kind}/${name}?`)) return;
    try {
      await fetch(`/api/status/resources/${ns}/${kind.toLowerCase()}s/${name}`, { method: 'DELETE' });
      fetchAll();
    } catch {}
  };

  const filtered = resources.filter((r) => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (kindFilter && r.kind !== kindFilter) return false;
    return true;
  });

  const kinds = [...new Set(resources.map((r) => r.kind))];

  return (
    <div className="page-content">
      <div className="page-header">
        <h2 className="page-title">Status</h2>
        <span className="page-subtitle">Cluster resource overview</span>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-icon" style={{ background: 'rgba(88,166,255,0.12)', color: '#58a6ff' }}><Activity size={18} /></div>
          <div><div className="summary-value">{summary.pods}</div><div className="summary-label">Total Pods</div></div>
        </div>
        <div className="summary-card">
          <div className="summary-icon" style={{ background: 'rgba(63,185,80,0.12)', color: '#3fb950' }}><CheckCircle size={18} /></div>
          <div><div className="summary-value">{summary.running}</div><div className="summary-label">Running</div></div>
        </div>
        <div className="summary-card">
          <div className="summary-icon" style={{ background: 'rgba(210,153,34,0.12)', color: '#d29922' }}><Clock size={18} /></div>
          <div><div className="summary-value">{summary.pending}</div><div className="summary-label">Pending</div></div>
        </div>
        <div className="summary-card">
          <div className="summary-icon" style={{ background: 'rgba(248,81,73,0.12)', color: '#f85149' }}><XCircle size={18} /></div>
          <div><div className="summary-value">{summary.failed}</div><div className="summary-label">Failed</div></div>
        </div>
        <div className="summary-card">
          <div className="summary-icon" style={{ background: 'rgba(188,140,255,0.12)', color: '#bc8cff' }}><Server size={18} /></div>
          <div><div className="summary-value">{summary.nodes}</div><div className="summary-label">Nodes</div></div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-header">
          <h3 className="table-title">Resources</h3>
          <div className="table-filters">
            <div className="search-input">
              <Search size={14} />
              <input className="search-field" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="table-select" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
              <option value="">All Kinds</option>
              {kinds.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <button className="refresh-btn" onClick={fetchAll}><RefreshCw size={14} /></button>
          </div>
        </div>
        {loading ? (
          <div className="table-loading">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="table-empty">No resources found</div>
        ) : (
          <table className="resource-table">
            <thead>
              <tr><th>Name</th><th>Kind</th><th>Namespace</th><th>Status</th><th>Age</th><th style={{ width: 80 }}>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i}>
                  <td className="cell-name">{r.name}</td>
                  <td><span className="kind-badge">{r.kind}</span></td>
                  <td>{r.namespace}</td>
                  <td><span className={`status-badge ${r.status === 'Running' || r.status === 'Active' ? 'status-ok' : 'status-warn'}`}>{r.status}</span></td>
                  <td>{r.age}</td>
                  <td>
                    <div className="cell-actions">
                      <button className="action-btn" title="View"><Eye size={13} /></button>
                      <button className="action-btn danger" title="Delete" onClick={() => handleDelete(r.name, r.kind, r.namespace)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {events.length > 0 && (
        <div className="table-card" style={{ marginTop: 16 }}>
          <div className="table-header"><h3 className="table-title">Recent Events</h3></div>
          <div className="event-list">
            {events.slice(0, 10).map((e, i) => (
              <div key={i} className={`event-item ${e.type === 'Warning' ? 'event-warning' : ''}`}>
                <span className={`event-type ${e.type === 'Warning' ? 'event-type-warn' : 'event-type-normal'}`}>{e.type}</span>
                <span className="event-reason">{e.reason}</span>
                <span className="event-object">{e.object}</span>
                <span className="event-msg">{e.message}</span>
                <span className="event-time">{e.age}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
