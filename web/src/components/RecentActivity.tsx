import { useStore } from '../store';
import { Check, Edit, Plus } from 'lucide-react';

export function RecentActivity() {
  const history = useStore((s) => s.history);
  const activities = useStore((s) => s.activities);
  const removeHistory = useStore((s) => s.removeHistory);

  const handleUndo = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:8080/api/apply/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        removeHistory(id);
      } else {
        const data = await res.json();
        alert('Failed to rollback: ' + (data.message || data.error));
      }
    } catch {
      alert('Error rolling back');
    }
  };

  const allItems = [
    ...activities.map(a => ({ ...a, _type: 'activity' as const })),
    ...history.map(h => ({
      type: 'success' as const,
      text: `Applied ${h.resources.length} resource(s)`,
      time: h.appliedAt,
      _type: 'history' as const,
      id: h.id,
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8);

  const iconMap = {
    success: Check,
    update: Edit,
    create: Plus,
    error: Check,
  };

  const formatTime = (t: string) => {
    const d = new Date(t);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="right-panel" style={{ flex: 1 }}>
      <div className="right-panel-title">
        <Edit size={14} />
        Recent Activity
      </div>
      {allItems.length === 0 ? (
        <p className="empty-msg">No recent activity</p>
      ) : (
        <div>
          {allItems.map((item, i) => {
            const Icon = iconMap[item.type] || Check;
            return (
              <div key={i} className="activity-item">
                <div className={`activity-icon ${item.type}`}>
                  <Icon size={10} />
                </div>
                <div>
                  <div className="activity-text">{item.text}</div>
                  <div className="activity-time">{formatTime(item.time)}</div>
                </div>
                {item._type === 'history' && item.id && (
                  <button
                    className="undo-btn"
                    onClick={() => handleUndo(item.id!)}
                    title="Undo"
                    style={{
                      marginLeft: 'auto',
                      background: 'none',
                      border: 'none',
                      color: '#f85149',
                      cursor: 'pointer',
                      fontSize: '11px',
                      padding: '2px 4px',
                    }}
                  >
                    Undo
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
