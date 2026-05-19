import { useState } from 'react';
import { X, FileText, Upload, Link2, Check, AlertCircle } from 'lucide-react';

interface DeployModalProps {
  onClose: () => void;
  onApply: (yaml: string) => void;
}

export function DeployModal({ onClose, onApply }: DeployModalProps) {
  const [tab, setTab] = useState<'write' | 'upload' | 'url'>('write');
  const [yaml, setYaml] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  const handleUrlFetch = async () => {
    setLoading(true);
    try {
      const res = await fetch(url);
      if (res.ok) {
        setYaml(await res.text());
        setStep(2);
      } else {
        setError('Failed to fetch URL');
      }
    } catch {
      setError('Failed to fetch URL');
    }
    setLoading(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setYaml(ev.target?.result as string);
      setStep(2);
    };
    reader.readAsText(file);
  };

  const handleDeploy = () => {
    if (!yaml.trim()) return;
    onApply(yaml);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Deploy New Manifest</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-tabs">
          <button className={`modal-tab ${tab === 'write' ? 'active' : ''}`} onClick={() => setTab('write')}><FileText size={14} /> Write</button>
          <button className={`modal-tab ${tab === 'upload' ? 'active' : ''}`} onClick={() => setTab('upload')}><Upload size={14} /> Upload</button>
          <button className={`modal-tab ${tab === 'url' ? 'active' : ''}`} onClick={() => setTab('url')}><Link2 size={14} /> From URL</button>
        </div>

        {tab === 'write' && (
          <textarea className="modal-textarea" value={yaml} onChange={(e) => { setYaml(e.target.value); setStep(2); }} placeholder="Paste your YAML manifest here..." rows={12} />
        )}

        {tab === 'upload' && (
          <div className="upload-area">
            <Upload size={32} style={{ color: '#6e7681' }} />
            <p>Drag and drop a .yaml or .yml file here</p>
            <label className="upload-btn">
              Browse Files
              <input type="file" accept=".yaml,.yml" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          </div>
        )}

        {tab === 'url' && (
          <div className="url-input-group">
            <input className="form-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://raw.githubusercontent.com/.../manifest.yaml" />
            <button className="generate-btn" onClick={handleUrlFetch} disabled={loading || !url}>
              {loading ? 'Fetching...' : 'Fetch'}
            </button>
          </div>
        )}

        {error && (
          <div className="modal-error">
            <AlertCircle size={14} />{error}
          </div>
        )}

        {yaml && step >= 2 && (
          <div className="deploy-checklist">
            <div className="checklist-item">
              <Check size={14} style={{ color: '#3fb950' }} />
              <span>YAML syntax valid</span>
            </div>
            <div className="checklist-item">
              <Check size={14} style={{ color: '#3fb950' }} />
              <span>Ready to apply</span>
            </div>
          </div>
        )}

        <div className="modal-footer">
          <button className="modal-cancel" onClick={onClose}>Cancel</button>
          <button className="generate-btn" onClick={handleDeploy} disabled={!yaml.trim()}>
            Deploy
          </button>
        </div>
      </div>
    </div>
  );
}
