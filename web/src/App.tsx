import { ChatInput } from './components/ChatInput';
import { YamlEditor } from './components/YamlEditor';
import { SystemContext } from './components/SystemContext';
import { LiveDeployments } from './components/LiveDeployments';
import { RecentActivity } from './components/RecentActivity';
import { TopBar } from './components/TopBar';
import { LeftSidebar } from './components/LeftSidebar';
import './App.css';

function App() {
  return (
    <div className="app-layout">
      <LeftSidebar />

      <div className="main-content">
        <TopBar />

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
      </div>
    </div>
  );
}

export default App;
