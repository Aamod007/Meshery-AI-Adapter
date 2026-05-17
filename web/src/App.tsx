import { ChatInput } from './components/ChatInput';
import { YamlEditor } from './components/YamlEditor';
import { ClusterSidebar } from './components/ClusterSidebar';
import { ApplyHistory } from './components/ApplyHistory';
import { LiveStatusPanel } from './components/LiveStatusPanel';
import './App.css';

function App() {
  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>LLM Infrastructure Assistant</h1>
        <span className="app-subtitle">Natural language → Kubernetes YAML</span>
      </header>

      <main className="app-main">
        <aside className="sidebar left-sidebar">
          <ClusterSidebar />
          <LiveStatusPanel />
          <ApplyHistory />
        </aside>

        <div className="center-content">
          <ChatInput />
          <YamlEditor />
        </div>
      </main>
    </div>
  );
}

export default App;
