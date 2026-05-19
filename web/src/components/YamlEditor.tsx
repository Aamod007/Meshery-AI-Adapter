import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { useStore } from '../store';
import { Play, Copy, Check, CheckCircle, XCircle } from 'lucide-react';

export function YamlEditor() {
  const yaml = useStore(state => state.yaml);
  const setYaml = useStore(state => state.setYaml);
  const addHistory = useStore(state => state.addHistory);
  const addActivity = useStore(state => state.addActivity);
  const validationPassed = useStore(s => s.validationPassed);
  const validationErrors = useStore(s => s.validationErrors);
  const generationMeta = useStore(s => s.generationMeta);
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleApply = async () => {
    if (!yaml || applying) return;
    setApplying(true);
    
    try {
      const res = await fetch('/api/apply', {
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
          text: `Apply failed: ${data.message || data.error || 'unknown error'}`,
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

  const validationBanner = (() => {
    if (validationPassed === null || !yaml) return null;
    if (validationPassed && validationErrors.length === 0) {
      return (
        <div className="validation-banner success">
          <CheckCircle size={14} />
          Valid — passes server-side dry run
        </div>
      );
    }
    if (validationErrors.length > 0) {
      return (
        <div className="validation-banner error">
          <XCircle size={14} />
          Validation failed — {validationErrors.length} error(s)
        </div>
      );
    }
    return null;
  })();

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

      {validationBanner}

      <div className="monaco-wrapper">
        <Editor
          height="100%"
          defaultLanguage="yaml"
          value={yaml || undefined}
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
          loading={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6e7681', fontSize: 13 }}>
              Generated YAML will appear here...
            </div>
          }
        />
        {!yaml && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#6e7681', fontSize: 13, pointerEvents: 'none',
          }}>
            Generated YAML will appear here...
          </div>
        )}
      </div>

      {generationMeta && (
        <div className="editor-footer">
          <span>{generationMeta.provider}</span>
          <span className="footer-sep">·</span>
          <span>{generationMeta.inputTokens} in</span>
          <span className="footer-sep">·</span>
          <span>{generationMeta.outputTokens} out</span>
          <span className="footer-sep">·</span>
          <span>{(generationMeta.latencyMs / 1000).toFixed(2)}s</span>
        </div>
      )}
    </div>
  );
}
