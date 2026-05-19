import { useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useStore } from '../store';

export function ChatInput() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const setYaml = useStore((s) => s.setYaml);
  const setLastPrompt = useStore((s) => s.setLastPrompt);
  const setValidationErrors = useStore((s) => s.setValidationErrors);
  const validationErrors = useStore((s) => s.validationErrors);
  const lastPrompt = useStore((s) => s.lastPrompt);
  const clearStatuses = useStore((s) => s.clearStatuses);

  const generate = async (userPrompt: string) => {
    setLoading(true);
    setValidationErrors([]);
    clearStatuses();
    try {
      const res = await fetch('http://localhost:8080/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt, provider: 'ollama', validate: true }),
      });

      const data = await res.json();

      if (res.status === 422) {
        setYaml(data.yaml || '');
        setValidationErrors(data.validation?.errors || []);
        return;
      }

      if (res.ok && data.yaml) {
        setYaml(data.yaml);
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
    setPrompt('');
    await generate(p);
  };

  const handleRetry = async () => {
    if (!lastPrompt || loading) return;
    const errorContext = validationErrors.map((e) => `Error: ${e.message}`).join('\n');
    const retryPrompt = `${lastPrompt}\n\nFix these validation errors:\n${errorContext}`;
    await generate(retryPrompt);
  };

  return (
    <div className="orchestrator-card">
      <div className="orchestrator-title">
        <Sparkles size={14} />
        Natural Language Orchestrator
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
  );
}
