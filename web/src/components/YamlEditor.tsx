import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { useStore } from '../store';
import { Play } from 'lucide-react';

export function YamlEditor() {
  const yaml = useStore(state => state.yaml);
  const setYaml = useStore(state => state.setYaml);
  const addHistory = useStore(state => state.addHistory);
  const [applying, setApplying] = useState(false);

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
        alert('Applied successfully!');
      } else {
        alert('Failed to apply: ' + data.message);
      }
    } catch (e) {
      alert('Error connecting to API');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="editor-container">
      <div className="editor-header">
        <h3>Manifest Viewer</h3>
        <button className="apply-btn" onClick={handleApply} disabled={applying || !yaml}>
          <Play size={16} /> {applying ? 'Applying...' : 'Apply to Cluster'}
        </button>
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
            fontSize: 14,
          }}
        />
      </div>
    </div>
  );
}
