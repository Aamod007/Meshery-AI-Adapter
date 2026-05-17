import { useEffect, useState } from 'react';
import { Server, Zap } from 'lucide-react';

export function ClusterSidebar() {
  const [health, setHealth] = useState({ provider: '', provider_ok: false, cluster_ok: false });

  useEffect(() => {
    fetch('http://localhost:8080/api/health')
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(console.error);
  }, []);

  return (
    <div className="sidebar-section">
      <h3>Status</h3>
      <div className="status-item">
        <Server size={18} />
        <span>Cluster: {health.cluster_ok ? <span className="ok">Connected</span> : <span className="err">Disconnected</span>}</span>
      </div>
      <div className="status-item">
        <Zap size={18} />
        <span>Provider: {health.provider_ok ? <span className="ok">{health.provider}</span> : <span className="err">Error</span>}</span>
      </div>
    </div>
  );
}
