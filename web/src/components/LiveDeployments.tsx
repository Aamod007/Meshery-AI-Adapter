import { useEffect, useRef, useState } from 'react';
import { Activity, Undo2 } from 'lucide-react';
import { useStore } from '../store';
import type { ResourceStatus } from '../store';

export function LiveDeployments() {
  const statuses = useStore((s) => s.resourceStatuses);
  const upsertStatus = useStore((s) => s.upsertStatus);
  const history = useStore((s) => s.history);
  const removeHistory = useStore((s) => s.removeHistory);
  const wsRef = useRef<WebSocket | null>(null);
  const [timeLeft, setTimeLeft] = useState<Record<string, number>>({});

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(`ws://${window.location.host}/api/ws`);
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

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const next: Record<string, number> = {};
        for (const [id, t] of Object.entries(prev)) {
          if (t > 0) next[id] = t - 1;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const initial: Record<string, number> = {};
    for (const h of history) {
      const appliedAt = new Date(h.appliedAt).getTime();
      const remaining = Math.max(0, 60 - Math.floor((Date.now() - appliedAt) / 1000));
      if (remaining > 0) initial[h.id] = remaining;
    }
    setTimeLeft(initial);
  }, [history]);

  const handleUndo = async (id: string) => {
    try {
      const res = await fetch(`/api/apply/${id}`, { method: 'DELETE' });
      if (res.ok) {
        removeHistory(id);
        setTimeLeft((prev) => { const n = { ...prev }; delete n[id]; return n; });
      } else {
        const data = await res.json();
        alert('Failed to rollback: ' + (data.message || data.error));
      }
    } catch {
      alert('Error rolling back');
    }
  };

  const deploymentRows = statuses.map((s) => {
    const shortName = s.resource.split('/').pop() || s.resource;
    const matchingHistory = history.find((h) => h.resources.includes(s.resource));
    const canUndo = matchingHistory && (timeLeft[matchingHistory.id] ?? 0) > 0;

    return (
      <div key={s.resource} className={`deployment-item ${s.ready ? 'ready' : 'pending'}`}>
        <div className="deployment-left">
          <span className={`deployment-dot ${s.ready ? 'dot-green' : 'dot-orange'}`} />
          <span className="deployment-name">{shortName}</span>
        </div>
        <div className="deployment-right">
          <span className={`deployment-status ${s.ready ? 'healthy' : 'scaling'}`}>
            {s.message}
          </span>
          {canUndo && matchingHistory && (
            <button
              className="undo-inline-btn"
              onClick={() => handleUndo(matchingHistory.id)}
              title={`Undo (${timeLeft[matchingHistory.id]}s)`}
            >
              <Undo2 size={12} />
              <span className="undo-timer">{timeLeft[matchingHistory.id]}s</span>
            </button>
          )}
        </div>
      </div>
    );
  });

  return (
    <div className="right-panel">
      <div className="right-panel-title">
        <Activity size={14} />
        Live Deployments
      </div>
      {deploymentRows.length === 0 ? (
        <p className="empty-msg">No active deployments</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {deploymentRows}
        </div>
      )}
    </div>
  );
}
