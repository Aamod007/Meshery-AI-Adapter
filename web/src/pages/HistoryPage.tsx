import { useEffect, useState } from 'react';
import { Search, RefreshCw, Play, Copy, ChevronDown, ChevronUp } from 'lucide-react';

interface HistoryEntry {
  id: string;
  timestamp: string;
  prompt: string;
  resources: string[];
  status: 'success' | 'failed' | 'rolled_back';
  provider: string;
  yaml?: string;
}

export function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      if (res.ok) setEntries((await res.json()).entries || []);
    } catch {}
    setLoading(false);
  };

  const handleReapply = async (yaml: string) => {
    try {
      await fetch('/api/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ yaml }) });
      fetchHistory();
    } catch {}
  };

  const handleCopy = async (yaml: string) => { await navigator.clipboard.writeText(yaml); };

  const filtered = entries.filter((e) => {
    if (search && !e.prompt.toLowerCase().includes(search.toLowerCase()) && !e.resources.some((r) => r.toLowerCase().includes(search.toLowerCase()))) return false;
    if (statusFilter && e.status !== statusFilter) return false;
    if (providerFilter && !e.provider.includes(providerFilter)) return false;
    return true;
  });

  return (
    <div className="page-content">
      <div className="page-header">
        <h2 className="page-title">History</h2>
        <span className="page-subtitle">Apply log and generated manifests</span>
      </div>
      <div className="table-card">
        <div className="table-header">
          <h3 className="table-title">Apply Log</h3>
          <div className="table-filters">
            <div className="search-input">
              <Search size={14} />
              <input className="search-field" placeholder="Search prompts or resources..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="table-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="rolled_back">Rolled Back</option>
            </select>
            <select className="table-select" value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)}>
              <option value="">All Providers</option>
              <option value="ollama">Ollama</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
            <button className="refresh-btn" onClick={fetchHistory}><RefreshCw size={14} /></button>
          </div>
        </div>
        {loading ? (
          <div className="table-loading">Loading history...</div>
        ) : filtered.length === 0 ? (
          <div className="table-empty">No history entries found</div>
        ) : (
          <div className="history-list">
            {filtered.map((entry) => (
              <div key={entry.id} className="history-entry">
                <div className="history-entry-header" onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}>
                  <div className="history-entry-left">
                    <span className={`status-dot-small ${entry.status === 'success' ? 'dot-green' : entry.status === 'failed' ? 'dot-red' : 'dot-orange'}`} />
                    <div>
                      <div className="history-prompt">{entry.prompt}</div>
                      <div className="history-meta">
                        <span>{new Date(entry.timestamp).toLocaleString()}</span>
                        <span className="meta-sep">·</span>
                        <span>{entry.provider}</span>
                        <span className="meta-sep">·</span>
                        <span>{entry.resources.length} resource(s)</span>
                      </div>
                    </div>
                  </div>
                  <div className="history-entry-right">
                    <span className={`status-badge-small ${entry.status === 'success' ? 'status-ok' : entry.status === 'failed' ? 'status-warn' : 'status-info'}`}>{entry.status}</span>
                    {expandedId === entry.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
                {expandedId === entry.id && entry.yaml && (
                  <div className="history-entry-body">
                    <div className="history-yaml-header">
                      <span className="history-yaml-title">Generated YAML</span>
                      <div className="history-yaml-actions">
                        <button className="action-btn-sm" onClick={() => handleCopy(entry.yaml!)}><Copy size={12} /> Copy</button>
                        <button className="action-btn-sm primary" onClick={() => handleReapply(entry.yaml!)}><Play size={12} /> Re-apply</button>
                      </div>
                    </div>
                    <pre className="history-yaml">{entry.yaml}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
