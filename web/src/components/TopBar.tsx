import { Bell, HelpCircle, Grid, RefreshCw } from 'lucide-react';

export function TopBar() {
  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <span className="top-bar-title">Orchestrator</span>
        <span className="top-bar-version">v2.4</span>
      </div>
      <div className="top-bar-right">
        <button className="top-bar-icon" title="Notifications">
          <Bell size={16} />
        </button>
        <button className="top-bar-icon" title="Help">
          <HelpCircle size={16} />
        </button>
        <button className="top-bar-icon" title="Apps">
          <Grid size={16} />
        </button>
        <button className="sync-btn">
          <RefreshCw size={12} />
          Sync Cluster
        </button>
      </div>
    </div>
  );
}
