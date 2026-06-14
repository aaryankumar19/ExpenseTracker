import React, { useEffect, useState, useRef } from 'react';
import { uploadExpenseFile, getAnomalies } from '../lib/api';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, X, RefreshCw } from 'lucide-react';

export const Importer = () => {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [anomLoading, setAnomLoading] = useState(true);
  const [resolved, setResolved] = useState(new Set());
  const fileRef = useRef();

  useEffect(() => {
    getAnomalies()
      .then(data => setAnomalies(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setAnomLoading(false));
  }, []);

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.csv'))) setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true); setSummary(null);
    try {
      const result = await uploadExpenseFile(file);
      setSummary(result);
      const anoms = await getAnomalies();
      setAnomalies(Array.isArray(anoms) ? anoms : []);
      setResolved(new Set());
    } catch (err) {
      setSummary({ error: err.message });
    } finally { setLoading(false); }
  };

  const refreshAnomalies = async () => {
    setAnomLoading(true);
    try {
      const data = await getAnomalies();
      setAnomalies(Array.isArray(data) ? data : []);
      setResolved(new Set());
    } catch (err) { console.error(err); }
    finally { setAnomLoading(false); }
  };

  const markResolved = (id) => setResolved(prev => new Set([...prev, id]));
  const unresolvedAnomalies = anomalies.filter(a => !resolved.has(a.id) && !a.resolved);

  const typeColor = (type) => {
    if (type === 'duplicate') return 'badge-amber';
    if (type === 'invalid_user') return 'badge-rose';
    if (type === 'invalid_amount') return 'badge-rose';
    if (type === 'currency_issue') return 'badge-blue';
    return 'badge-gray';
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="page-header">
        <h1 className="page-title">Import Center</h1>
      </div>

      {/* Drop Zone */}
      <div
        className={`drop-zone ${dragging ? 'drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef} type="file" accept=".xlsx,.csv"
          onChange={(e) => setFile(e.target.files[0])}
          style={{ display: 'none' }}
        />
        <FileSpreadsheet size={48} style={{ margin: '0 auto 1rem', color: '#818cf8', opacity: 0.6 }} />
        {file ? (
          <div>
            <p style={{ fontWeight: 600, color: '#e2e8f0' }}>{file.name}</p>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.3rem' }}>
              {(file.size / 1024).toFixed(1)} KB — Ready to import
            </p>
          </div>
        ) : (
          <div>
            <p style={{ fontWeight: 600, color: '#94a3b8' }}>
              Drag & drop your spreadsheet here
            </p>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.3rem' }}>
              Accepts .xlsx and .csv files
            </p>
          </div>
        )}
      </div>

      {file && (
        <button className="btn btn-primary" onClick={handleUpload} disabled={loading} style={{ alignSelf: 'flex-start' }}>
          {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Importing...</> : <><Upload size={18} /> Import File</>}
        </button>
      )}

      {/* Import Summary */}
      {summary && !summary.error && (
        <div className="glass-strong slide-up" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <CheckCircle size={20} color="#34d399" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Import Complete</h3>
          </div>
          <div className="summary-grid">
            {summary.rows_processed != null && <div className="summary-item"><div className="val">{summary.rows_processed}</div><div className="lbl">Rows Processed</div></div>}
            {summary.expenses_created != null && <div className="summary-item"><div className="val" style={{ color: '#34d399' }}>{summary.expenses_created}</div><div className="lbl">Expenses Created</div></div>}
            {summary.users_created != null && <div className="summary-item"><div className="val" style={{ color: '#818cf8' }}>{summary.users_created}</div><div className="lbl">Users Created</div></div>}
            {summary.duplicates_found != null && <div className="summary-item"><div className="val" style={{ color: '#fbbf24' }}>{summary.duplicates_found}</div><div className="lbl">Duplicates Found</div></div>}
            {summary.anomalies_found != null && <div className="summary-item"><div className="val" style={{ color: '#fb7185' }}>{summary.anomalies_found}</div><div className="lbl">Anomalies</div></div>}
          </div>
        </div>
      )}
      {summary?.error && (
        <div className="glass-strong" style={{ padding: '1rem', borderColor: 'rgba(244,63,94,0.3)' }}>
          <p style={{ color: '#fb7185' }}>⚠ Import failed: {summary.error}</p>
        </div>
      )}

      {/* Anomaly Review Panel */}
      <div className="glass-strong" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={20} color="#fbbf24" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Anomaly Review</h3>
            {unresolvedAnomalies.length > 0 && (
              <span className="badge badge-amber">{unresolvedAnomalies.length} unresolved</span>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={refreshAnomalies}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {anomLoading ? (
          <div className="loader"><div className="spinner" /> Loading anomalies...</div>
        ) : unresolvedAnomalies.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>
            ✅ No unresolved anomalies. Your data looks clean!
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {unresolvedAnomalies.map(a => (
              <div key={a.id} className="anomaly-card">
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <span className={`badge ${typeColor(a.anomaly_type)}`}>{a.anomaly_type}</span>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Row {a.row_number}</span>
                  </div>
                  <p style={{ fontSize: '0.88rem', color: '#cbd5e1' }}>{a.description}</p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => markResolved(a.id)} title="Dismiss">
                  <X size={14} /> Dismiss
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
