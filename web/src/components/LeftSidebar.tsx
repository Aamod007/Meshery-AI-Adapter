import { LayoutDashboard, Activity, History, Settings, Plus } from 'lucide-react';
import { useState } from 'react';

export function LeftSidebar() {
  const [active, setActive] = useState('orchestration');

  const navItems = [
    { id: 'orchestration', label: 'Orchestration', icon: LayoutDashboard },
    { id: 'status', label: 'Status', icon: Activity },
    { id: 'history', label: 'History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="left-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">K8</div>
        <div className="sidebar-brand-text">
          <h2>K8s-LLM Ops</h2>
          <span>Cluster: prod-us-east-1</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${active === item.id ? 'active' : ''}`}
            onClick={() => setActive(item.id)}
          >
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </nav>

      <button className="sidebar-deploy-btn">
        <Plus size={14} />
        Deploy New Manifest
      </button>
    </div>
  );
}
