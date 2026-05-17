import { useEffect, useRef } from 'react';
import { CheckCircle, Clock } from 'lucide-react';
import { useStore } from '../store';
import type { ResourceStatus } from '../store';

export function LiveStatusPanel() {
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
        // Reconnect after 3s
        setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    };

    connect();
    return () => wsRef.current?.close();
  }, []);

  if (statuses.length === 0) return null;

  return (
    <div className="live-status-panel">
      <h3 className="status-panel-title">Live Status</h3>
      <ul className="status-list">
        {statuses.map((s, i) => (
          <li key={i} className={`status-item-row ${s.ready ? 'ready' : 'pending'}`}>
            <span className="status-icon">
              {s.ready ? (
                <CheckCircle size={14} className="icon-ok" />
              ) : (
                <Clock size={14} className="icon-pending" />
              )}
            </span>
            <span className="status-resource">{s.resource}</span>
            <span className="status-msg">{s.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
