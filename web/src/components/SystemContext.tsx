import { useEffect, useState } from 'react';
import { Server, Link2 } from 'lucide-react';

export function SystemContext() {
  const [health, setHealth] = useState({
    provider: '',
    provider_ok: false,
    cluster_ok: false,
    cluster_context: '',
  });
  const [showConnect, setShowConnect] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(console.error);

    const interval = setInterval(() => {
      fetch('/api/health')
        .then(res => res.json())
        .then(data => setHealth(data))
        .catch(console.error);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const clusterLabel = health.cluster_context || 'kind';

  return (
    <div className="right-panel">
      <div className="right-panel-title">
        <Server size={14} />
        System Context
      </div>
      <div className="context-row">
        <span className="context-label">Cluster</span>
        <span className={`context-value ${health.cluster_ok ? 'connected' : 'disconnected'}`}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span className={`status-dot ${health.cluster_ok ? 'dot-green' : 'dot-red'}`} />
            {health.cluster_ok ? clusterLabel : 'Disconnected'}
          </span>
        </span>
      </div>
      {!health.cluster_ok && (
        <button className="connect-btn" onClick={() => setShowConnect(!showConnect)}>
          <Link2 size={12} /> Connect
        </button>
      )}
      {showConnect && (
        <div className="connect-modal">
          <p style={{ fontSize: 11, color: '#8b949e', marginBottom: 6 }}>
            Ensure <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: 3 }}>~/.kube/config</code> is configured and the cluster is reachable.
          </p>
          <button className="connect-btn" onClick={() => { setShowConnect(false); window.location.reload(); }}>
            Retry Connection
          </button>
        </div>
      )}
      <div className="context-row">
        <span className="context-label">LLM Provider</span>
        <span className="context-value">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span className={`status-dot ${health.provider_ok ? 'dot-green' : 'dot-red'}`} />
            {health.provider || '—'}
          </span>
        </span>
      </div>
      {!health.provider_ok && (
        <p style={{ fontSize: 11, color: '#f85149', marginTop: 4 }}>
          Provider not reachable. Check Ollama is running or API keys are set.
        </p>
      )}
      <div className="context-row">
        <span className="context-label">Namespace</span>
        <span className="context-value">default</span>
      </div>
    </div>
  );
}
