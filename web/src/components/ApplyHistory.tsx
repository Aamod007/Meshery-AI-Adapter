
import { useStore } from '../store';
import { Undo } from 'lucide-react';

export function ApplyHistory() {
  const history = useStore(state => state.history);
  const removeHistory = useStore(state => state.removeHistory);

  const handleUndo = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:8080/api/apply/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert('Rollback successful');
        removeHistory(id);
      } else {
        const data = await res.json();
        alert('Failed to rollback: ' + data.message);
      }
    } catch (e) {
      alert('Error rolling back');
    }
  };

  return (
    <div className="sidebar-section history">
      <h3>Recent Applies</h3>
      {history.length === 0 ? (
        <p className="empty-msg">No recent actions</p>
      ) : (
        <ul className="history-list">
          {history.map(item => (
            <li key={item.id} className="history-item">
              <div className="history-info">
                <span className="history-time">{new Date(item.appliedAt).toLocaleTimeString()}</span>
                <span className="history-resources">{item.resources.length} resources</span>
              </div>
              <button className="undo-btn" onClick={() => handleUndo(item.id)} title="Undo Apply">
                <Undo size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
