import { useEffect, useState } from 'react';
import { Zap, Server, Sliders, Save, Check, X, Eye, EyeOff, RefreshCw, Link2 } from 'lucide-react';

interface ProviderConfig {
  provider: string;
  apiKey: string;
  model: string;
  host?: string;
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'provider' | 'cluster' | 'generation'>('provider');
  const [providers, setProviders] = useState<ProviderConfig[]>([
    { provider: 'ollama', apiKey: '', model: 'llama3.2', host: 'http://localhost:11434' },
    { provider: 'openai', apiKey: '', model: 'gpt-4o-mini' },
    { provider: 'anthropic', apiKey: '', model: 'claude-3-5-sonnet-20240620' },
  ]);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [clusterContext, setClusterContext] = useState('');
  const [contexts, setContexts] = useState<string[]>([]);
  const [maxTokens, setMaxTokens] = useState(2000);
  const [temperature, setTemperature] = useState(0.3);
  const [autoValidate, setAutoValidate] = useState(true);
  const [schemaInjection, setSchemaInjection] = useState(true);
  const [rollbackTtl, setRollbackTtl] = useState(60);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.providers) setProviders(data.providers);
        if (data.clusterContext) setClusterContext(data.clusterContext);
        if (data.contexts) setContexts(data.contexts);
        if (data.maxTokens) setMaxTokens(data.maxTokens);
        if (data.temperature !== undefined) setTemperature(data.temperature);
        if (data.autoValidate !== undefined) setAutoValidate(data.autoValidate);
        if (data.schemaInjection !== undefined) setSchemaInjection(data.schemaInjection);
        if (data.rollbackTtl) setRollbackTtl(data.rollbackTtl);
      }
    } catch {}
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providers, clusterContext, maxTokens, temperature, autoValidate, schemaInjection, rollbackTtl }) });
    } catch {}
    setSaving(false);
  };

  const testProvider = async (provider: string) => {
    try {
      const res = await fetch(`/api/settings/test-provider/${provider}`);
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [provider]: { ok: res.ok, msg: data.message || (res.ok ? 'Connected' : 'Failed') } }));
    } catch {
      setTestResults((prev) => ({ ...prev, [provider]: { ok: false, msg: 'Connection error' } }));
    }
  };

  const testCluster = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, cluster: { ok: data.cluster_ok, msg: data.cluster_ok ? `Connected: ${data.cluster_context}` : 'Disconnected' } }));
    } catch {
      setTestResults((prev) => ({ ...prev, cluster: { ok: false, msg: 'Connection error' } }));
    }
  };

  const updateProvider = (idx: number, field: string, value: string) => {
    setProviders((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const tabs = [
    { id: 'provider' as const, label: 'Providers', icon: Zap },
    { id: 'cluster' as const, label: 'Cluster', icon: Server },
    { id: 'generation' as const, label: 'Generation', icon: Sliders },
  ];

  return (
    <div className="page-content">
      <div className="page-header">
        <h2 className="page-title">Settings</h2>
        <span className="page-subtitle">Configure providers, cluster, and generation</span>
      </div>
      <div className="settings-layout">
        <div className="settings-tabs">
          {tabs.map((tab) => (
            <button key={tab.id} className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              <tab.icon size={14} />{tab.label}
            </button>
          ))}
        </div>
        <div className="settings-panel">
          {activeTab === 'provider' && (
            <div className="settings-section">
              <h3 className="settings-section-title">LLM Providers</h3>
              <p className="settings-section-desc">Configure API keys and models for each provider</p>
              {providers.map((p, idx) => (
                <div key={p.provider} className="provider-config-card">
                  <div className="provider-config-header">
                    <span className="provider-config-name">{p.provider.charAt(0).toUpperCase() + p.provider.slice(1)}</span>
                    {testResults[p.provider] && (
                      <span className={`test-badge ${testResults[p.provider].ok ? 'test-ok' : 'test-fail'}`}>
                        {testResults[p.provider].ok ? <Check size={12} /> : <X size={12} />}{testResults[p.provider].msg}
                      </span>
                    )}
                  </div>
                  {p.host && (
                    <div className="form-group">
                      <label>Host</label>
                      <input className="form-input" value={p.host} onChange={(e) => updateProvider(idx, 'host', e.target.value)} placeholder="http://localhost:11434" />
                    </div>
                  )}
                  <div className="form-group">
                    <label>API Key {p.provider === 'ollama' && '(optional)'}</label>
                    <div className="input-with-icon">
                      <input className="form-input" type={showKeys[p.provider] ? 'text' : 'password'} value={p.apiKey} onChange={(e) => updateProvider(idx, 'apiKey', e.target.value)} placeholder={p.provider === 'ollama' ? 'Not required' : 'sk-...'} />
                      <button className="input-icon-btn" onClick={() => setShowKeys((prev) => ({ ...prev, [p.provider]: !prev[p.provider] }))}>
                        {showKeys[p.provider] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Model</label>
                    <input className="form-input" value={p.model} onChange={(e) => updateProvider(idx, 'model', e.target.value)} placeholder="llama3.2" />
                  </div>
                  <button className="test-btn" onClick={() => testProvider(p.provider)}><RefreshCw size={12} /> Test Connection</button>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'cluster' && (
            <div className="settings-section">
              <h3 className="settings-section-title">Cluster Connection</h3>
              <p className="settings-section-desc">Configure Kubernetes cluster access</p>
              {testResults.cluster && (
                <div className={`test-banner ${testResults.cluster.ok ? 'test-banner-ok' : 'test-banner-fail'}`}>
                  {testResults.cluster.ok ? <Check size={14} /> : <X size={14} />}{testResults.cluster.msg}
                </div>
              )}
              {contexts.length > 0 && (
                <div className="form-group">
                  <label>Kubeconfig Contexts</label>
                  <select className="form-select" value={clusterContext} onChange={(e) => setClusterContext(e.target.value)}>
                    <option value="">Select context...</option>
                    {contexts.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              <button className="test-btn" onClick={testCluster}><Link2 size={12} /> Test Cluster</button>
            </div>
          )}
          {activeTab === 'generation' && (
            <div className="settings-section">
              <h3 className="settings-section-title">Generation Settings</h3>
              <p className="settings-section-desc">Configure LLM generation parameters</p>
              <div className="form-group">
                <label>Max Tokens: {maxTokens}</label>
                <input type="range" min={500} max={4000} step={100} value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} className="form-range" />
                <div className="range-labels"><span>500</span><span>4000</span></div>
              </div>
              <div className="form-group">
                <label>Temperature: {temperature.toFixed(1)}</label>
                <input type="range" min={0} max={1} step={0.1} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} className="form-range" />
                <div className="range-presets">
                  <button className={`preset-btn ${temperature === 0.1 ? 'active' : ''}`} onClick={() => setTemperature(0.1)}>Precise</button>
                  <button className={`preset-btn ${temperature === 0.5 ? 'active' : ''}`} onClick={() => setTemperature(0.5)}>Balanced</button>
                  <button className={`preset-btn ${temperature === 0.9 ? 'active' : ''}`} onClick={() => setTemperature(0.9)}>Creative</button>
                </div>
              </div>
              <div className="form-group">
                <label>Rollback TTL: {rollbackTtl}s</label>
                <div className="ttl-options">
                  {[30, 60, 120, 300].map((t) => (
                    <button key={t} className={`ttl-btn ${rollbackTtl === t ? 'active' : ''}`} onClick={() => setRollbackTtl(t)}>{t}s</button>
                  ))}
                </div>
              </div>
              <div className="toggle-group">
                <div className="toggle-row">
                  <div><div className="toggle-label">Auto-validate</div><div className="toggle-desc">Run server-side dry-run after generation</div></div>
                  <button className={`toggle ${autoValidate ? 'toggle-on' : ''}`} onClick={() => setAutoValidate(!autoValidate)}>
                    <span className={`toggle-knob ${autoValidate ? 'toggle-knob-on' : ''}`} />
                  </button>
                </div>
                <div className="toggle-row">
                  <div><div className="toggle-label">Schema injection</div><div className="toggle-desc">Inject live CRD schemas into system prompt</div></div>
                  <button className={`toggle ${schemaInjection ? 'toggle-on' : ''}`} onClick={() => setSchemaInjection(!schemaInjection)}>
                    <span className={`toggle-knob ${schemaInjection ? 'toggle-knob-on' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="settings-footer">
            <button className="save-btn" onClick={handleSave} disabled={saving}><Save size={14} /> {saving ? 'Saving...' : 'Save Settings'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
