import { useState, useRef, useEffect } from 'react';
import { RefreshCw, Sparkles, ChevronDown, History } from 'lucide-react';
import { useStore } from '../store';

const PROVIDERS = [
  { id: 'ollama', label: 'Ollama' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
];

export function ChatInput() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showProviders, setShowProviders] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  const setYaml = useStore((s) => s.setYaml);
  const setLastPrompt = useStore((s) => s.setLastPrompt);
  const setValidationErrors = useStore((s) => s.setValidationErrors);
  const validationErrors = useStore((s) => s.validationErrors);
  const lastPrompt = useStore((s) => s.lastPrompt);
  const clearStatuses = useStore((s) => s.clearStatuses);
  const promptHistory = useStore((s) => s.promptHistory);
  const addPromptHistory = useStore((s) => s.addPromptHistory);
  const setGenerationMeta = useStore((s) => s.setGenerationMeta);
  const selectedProvider = useStore((s) => s.selectedProvider);
  const setSelectedProvider = useStore((s) => s.setSelectedProvider);
  const setDetectedSchemas = useStore((s) => s.setDetectedSchemas);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
        setShowProviders(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const extractSchemas = (text: string): string[] => {
    const builtins = ['Deployment', 'Service', 'ConfigMap', 'Namespace', 'Pod', 'Ingress', 'PersistentVolumeClaim', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob', 'Secret', 'Role', 'RoleBinding', 'ClusterRole', 'ClusterRoleBinding'];
    const found: string[] = [];
    for (const kind of builtins) {
      if (text.toLowerCase().includes(kind.toLowerCase())) {
        found.push(kind);
      }
    }
    const crdMatch = text.match(/\b[A-Z][a-zA-Z]+\b/g);
    if (crdMatch) {
      for (const m of crdMatch) {
        if (m.length > 3 && m[0] === m[0].toUpperCase() && !builtins.includes(m) && !found.includes(m)) {
          found.push(m);
        }
      }
    }
    return found;
  };

  const generate = async (userPrompt: string) => {
    setLoading(true);
    setValidationErrors([], false);
    setGenerationMeta(null);
    clearStatuses();
    setDetectedSchemas(extractSchemas(userPrompt));
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt, provider: selectedProvider, validate: true }),
      });

      const data = await res.json();

      if (res.status === 422) {
        setYaml(data.yaml || '');
        setValidationErrors(data.validation?.errors || [], false);
        if (data.meta) setGenerationMeta(data.meta);
        return;
      }

      if (res.ok && data.yaml) {
        setYaml(data.yaml);
        setValidationErrors([], true);
        if (data.meta) setGenerationMeta(data.meta);
      } else {
        alert(data.message || 'Error generating YAML');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to connect to API');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    const p = prompt.trim();
    setLastPrompt(p);
    addPromptHistory(p);
    setPrompt('');
    setShowHistory(false);
    await generate(p);
  };

  const handleRetry = async () => {
    if (!lastPrompt || loading) return;
    const errorContext = validationErrors.map((e) => `Error: ${e.message}`).join('\n');
    const retryPrompt = `${lastPrompt}\n\nFix these validation errors:\n${errorContext}`;
    await generate(retryPrompt);
  };

  const currentProvider = PROVIDERS.find((p) => p.id === selectedProvider) || PROVIDERS[0];

  return (
    <div className="orchestrator-card">
      <div className="orchestrator-header">
        <div className="orchestrator-title">
          <Sparkles size={14} />
          Natural Language Orchestrator
        </div>
        <div className="provider-selector" ref={historyRef}>
          <button className="provider-btn" onClick={() => { setShowProviders(!showProviders); setShowHistory(false); }}>
            {currentProvider.label}
            <ChevronDown size={12} />
          </button>
          {showProviders && (
            <div className="provider-dropdown">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  className={`provider-option ${p.id === selectedProvider ? 'active' : ''}`}
                  onClick={() => { setSelectedProvider(p.id); setShowProviders(false); }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="validation-errors">
          <div className="validation-header">
            <span className="validation-title">Validation Errors</span>
            <button className="retry-btn" onClick={handleRetry} disabled={loading}>
              <RefreshCw size={12} /> Retry with error context
            </button>
          </div>
          <ul className="validation-list">
            {validationErrors.map((e, i) => (
              <li key={i}>
                {e.resource && <code className="err-resource">{e.resource}</code>}
                {e.field && <code className="err-field">{e.field}</code>}
                <span className="err-msg">{e.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div ref={historyRef} style={{ position: 'relative' }}>
        {promptHistory.length > 0 && (
          <button className="history-toggle" onClick={() => { setShowHistory(!showHistory); setShowProviders(false); }}>
            <History size={12} /> Recent
          </button>
        )}
        {showHistory && promptHistory.length > 0 && (
          <div className="prompt-history-dropdown">
            {promptHistory.slice(0, 5).map((h, i) => (
              <button
                key={i}
                className="prompt-history-item"
                onClick={() => { setPrompt(h); setShowHistory(false); }}
              >
                {h.length > 60 ? h.slice(0, 60) + '...' : h}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="prompt-area">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the infrastructure changes...&#10;e.g., 'Deploy a Redis cluster with 3 replicas...'"
            className="prompt-textarea"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                handleSubmit(e as any);
              }
            }}
          />
          <button type="submit" disabled={loading} className="generate-btn">
            {loading ? <RefreshCw size={14} className="spin" /> : <Sparkles size={14} />}
            Generate Manifest
          </button>
        </form>
      </div>

      {useStore.getState().detectedSchemas.length > 0 && (
        <div className="schema-chips">
          <span className="schema-label">Schema loaded:</span>
          {useStore.getState().detectedSchemas.map((s, i) => (
            <span key={i} className="schema-chip">{s}</span>
          ))}
        </div>
      )}
    </div>
  );
}
