import { useEffect, useState } from 'react';
import { Server } from 'lucide-react';

export function SystemContext() {
  const [health, setHealth] = useState({
    provider: '',
    provider_ok: false,
    cluster_ok: false,
    cluster_context: '',
  });

  useEffect(() => {
    fetch('http://localhost:8080/api/health')
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(console.error);
  }, []);

  return (
    <div className="right-panel">
      <div className="right-panel-title">
        <Server size={14} />
        System Context
      </div>
      <div className="context-row">
        <span className="context-label">Cluster Status</span>
        <span className={`context-value ${health.cluster_ok ? 'connected' : 'disconnected'}`}>
          {health.cluster_ok ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      <div className="context-row">
        <span className="context-label">LLM Provider</span>
        <span className="context-value">{health.provider || '—'}</span>
      </div>
      <div className="context-row">
        <span className="context-label">Namespace</span>
        <span className="context-value">default</span>
      </div>
    </div>
  );
}
