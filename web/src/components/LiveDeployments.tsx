import { useEffect, useRef } from 'react';
import { Activity } from 'lucide-react';
import { useStore } from '../store';
import type { ResourceStatus } from '../store';

export function LiveDeployments() {
  const statuses = useStore((s) => s.resourceStatuses);
  const upsertStatus = useStore((s) => s.upsertStatus);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket('ws://localhost:8080/api/ws');
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data) as ResourceStatus;
          if (msg.kind === 'status') {
            upsertStatus(msg);
          }
        } catch {}
      };

      ws.onclose = () => {
        setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    };

    connect();
    return () => wsRef.current?.close();
  }, []);

  if (statuses.length === 0) {
    return (
      <div className="right-panel">
        <div className="right-panel-title">
          <Activity size={14} />
          Live Deployments
        </div>
        <p className="empty-msg">No active deployments</p>
      </div>
    );
  }

  return (
    <div className="right-panel">
      <div className="right-panel-title">
        <Activity size={14} />
        Live Deployments
      </div>
      {statuses.map((s, i) => {
        const shortName = s.resource.split('/').pop() || s.resource;
        return (
          <div key={i} className={`deployment-item ${s.ready ? 'ready' : 'pending'}`}>
            <span className="deployment-name">{shortName}</span>
            <span className={`deployment-status ${s.ready ? 'healthy' : 'scaling'}`}>
              {s.ready ? s.message : s.message}
            </span>
          </div>
        );
      })}
    </div>
  );
}
