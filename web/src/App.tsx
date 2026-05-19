import { useState } from 'react';
import { ChatInput } from './components/ChatInput';
import { YamlEditor } from './components/YamlEditor';
import { SystemContext } from './components/SystemContext';
import { LiveDeployments } from './components/LiveDeployments';
import { RecentActivity } from './components/RecentActivity';
import { TopBar } from './components/TopBar';
import { LeftSidebar } from './components/LeftSidebar';
import { DeployModal } from './components/DeployModal';
import { StatusPage } from './pages/StatusPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import './App.css';

function App() {
  const [activeNav, setActiveNav] = useState('orchestration');
  const [showDeploy, setShowDeploy] = useState(false);

  const handleDeploy = async (yaml: string) => {
    try {
      await fetch('/api/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ yaml }) });
    } catch {}
  };

  const renderContent = () => {
    switch (activeNav) {
      case 'status':
        return <StatusPage />;
      case 'history':
        return <HistoryPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return (
          <div className="content-area">
            <div className="center-panel">
              <ChatInput />
              <YamlEditor />
            </div>
            <div className="right-sidebar">
              <SystemContext />
              <LiveDeployments />
              <RecentActivity />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="app-layout">
      <LeftSidebar activeNav={activeNav} onNavChange={setActiveNav} onDeploy={() => setShowDeploy(true)} />
      <div className="main-content">
        <TopBar />
        {renderContent()}
      </div>
      {showDeploy && <DeployModal onClose={() => setShowDeploy(false)} onApply={handleDeploy} />}
    </div>
  );
}

export default App;
