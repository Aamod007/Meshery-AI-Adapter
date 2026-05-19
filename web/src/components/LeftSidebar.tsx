import { LayoutDashboard, Activity, History, Settings, Plus } from 'lucide-react';

interface LeftSidebarProps {
  activeNav: string;
  onNavChange: (nav: string) => void;
  onDeploy: () => void;
}

export function LeftSidebar({ activeNav, onNavChange, onDeploy }: LeftSidebarProps) {
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
            className={`nav-item ${activeNav === item.id ? 'active' : ''}`}
            onClick={() => onNavChange(item.id)}
          >
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </nav>
      <button className="sidebar-deploy-btn" onClick={onDeploy}>
        <Plus size={14} />
        Deploy New Manifest
      </button>
    </div>
  );
}
