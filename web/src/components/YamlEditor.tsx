import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { useStore } from '../store';
import { Play, Copy, Check } from 'lucide-react';

export function YamlEditor() {
  const yaml = useStore(state => state.yaml);
  const setYaml = useStore(state => state.setYaml);
  const addHistory = useStore(state => state.addHistory);
  const addActivity = useStore(state => state.addActivity);
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleApply = async () => {
    if (!yaml || applying) return;
    setApplying(true);
    
    try {
      const res = await fetch('http://localhost:8080/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml })
      });
      const data = await res.json();
      if (res.ok) {
        addHistory({
          id: data.apply_id,
          resources: data.resources,
          appliedAt: data.applied_at
        });
        addActivity({
          type: 'success',
          text: `Applied ${data.resources.length} resource(s) to cluster`,
          time: new Date().toISOString()
        });
      } else {
        addActivity({
          type: 'error',
          text: `Apply failed: ${data.message || 'unknown error'}`,
          time: new Date().toISOString()
        });
      }
    } catch (e) {
      addActivity({
        type: 'error',
        text: 'Error connecting to API',
        time: new Date().toISOString()
      });
    } finally {
      setApplying(false);
    }
  };

  const handleCopy = async () => {
    if (!yaml) return;
    await navigator.clipboard.writeText(yaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="editor-card">
      <div className="editor-toolbar">
        <span className="editor-filename">
          <span style={{ color: '#8b949e' }}>manifest</span>.yaml
        </span>
        <div className="editor-actions">
          <button className="copy-btn" onClick={handleCopy} disabled={!yaml}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button className="apply-btn" onClick={handleApply} disabled={applying || !yaml}>
            <Play size={14} /> {applying ? 'Applying...' : 'Apply to Cluster'}
          </button>
        </div>
      </div>
      <div className="monaco-wrapper">
        <Editor
          height="100%"
          defaultLanguage="yaml"
          value={yaml}
          onChange={(val) => setYaml(val || '')}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            scrollBeyondLastLine: false,
            padding: { top: 8 },
          }}
        />
      </div>
    </div>
  );
}
