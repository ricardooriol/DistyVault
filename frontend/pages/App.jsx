import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [input, setInput] = useState('');
  const [type, setType] = useState('url');
  const [summaries, setSummaries] = useState([]);
  const [file, setFile] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [showDetail, setShowDetail] = useState(null);

  useEffect(() => {
    axios.get('/api/summaries').then(res => {
      // Add dummy tags for demo, real tags should come from backend
      setSummaries(res.data.summaries.map(s => ({
        ...s,
        type: s.type || 'url',
        date: s.date || new Date().toLocaleString(),
        status: 'done',
      })));
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    let res;
    const now = new Date().toLocaleString();
    let newSummary = {
      id: Math.random().toString(36).slice(2),
      summary: '',
      type,
      date: now,
      status: 'loading',
    };
    setSummaries([newSummary, ...summaries]);
    setLoadingId(newSummary.id);
    if (type === 'url') {
      res = await axios.post('/api/summarize-url', { url: input }, { timeout: 120000 });
    } else if (type === 'youtube') {
      res = await axios.post('/api/summarize-youtube', { videoUrl: input }, { timeout: 120000 });
    } else if (type === 'playlist') {
      res = await axios.post('/api/summarize-playlist', { playlistUrl: input }, { timeout: 120000 });
    } else if (type === 'file' && file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const fileType = file.name.endsWith('.pdf') ? 'pdf' : file.name.endsWith('.docx') ? 'docx' : 'txt';
        const fileData = ev.target.result;
        res = await axios.post('/api/summarize-file', { fileData, fileType }, { timeout: 120000 });
        setSummaries([{ id: res.data.id, summary: res.data.summary, type, date: now, status: 'done' }, ...summaries.filter(s => s.id !== newSummary.id)]);
        setLoadingId(null);
      };
      reader.readAsArrayBuffer(file);
      return;
    }
    if (res) {
      setSummaries([{ id: res.data.id, summary: res.data.summary, type, date: now, status: 'done' }, ...summaries.filter(s => s.id !== newSummary.id)]);
      setLoadingId(null);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: 'auto', padding: 32 }}>
      <h1>Sawron</h1>
      <form onSubmit={handleSubmit}>
        <select value={type} onChange={e => setType(e.target.value)}>
          <option value="url">Website URL</option>
          <option value="youtube">YouTube Video</option>
          <option value="playlist">YouTube Playlist</option>
          <option value="file">Upload File</option>
        </select>
        {type === 'file' ? (
          <input type="file" onChange={e => setFile(e.target.files[0])} />
        ) : (
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={type === 'url' ? 'Enter website URL' : type === 'youtube' ? 'Enter YouTube link' : 'Enter playlist link'}
            style={{ width: '60%' }}
          />
        )}
        <button type="submit">Summarize</button>
      </form>
      <h2>Saved Summaries</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {summaries.map(s => (
          <li key={s.id} style={{
            marginBottom: 8,
            background: '#f8f8f8',
            borderRadius: 8,
            padding: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
          }}>
            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setShowDetail(s.id)}>
              <span style={{ fontWeight: 'bold', marginRight: 8 }}>{s.type.toUpperCase()}</span>
              <span style={{ color: '#888', marginRight: 8 }}>{s.date}</span>
              {s.status === 'loading' ? (
                <span style={{ color: '#007bff', marginRight: 8 }}>
                  <span className="spinner" style={{ marginRight: 4, display: 'inline-block', width: 16, height: 16, border: '2px solid #007bff', borderRadius: '50%', borderTop: '2px solid #f8f8f8', animation: 'spin 1s linear infinite' }}></span>
                  Processing...
                </span>
              ) : (
                <span style={{ color: '#28a745', marginRight: 8 }}>Done</span>
              )}
            </div>
            <div>
              <button onClick={() => {
                const blob = new Blob([s.summary], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `summary_${s.id}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }} style={{ marginRight: 8 }}>Download</button>
              <button onClick={() => setSummaries(summaries.filter(x => x.id !== s.id))} style={{ marginRight: 8, color: '#dc3545' }}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
      {showDetail && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', zIndex: 1000 }} onClick={() => setShowDetail(null)}>
          <div style={{ background: '#fff', maxWidth: 700, margin: '5vh auto', padding: 32, borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.12)', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowDetail(null)} style={{ position: 'absolute', top: 16, right: 16, fontSize: 18, background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
            <h2 style={{ marginBottom: 16 }}>Summary Details</h2>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontWeight: 'bold', marginRight: 8 }}>{summaries.find(s => s.id === showDetail)?.type.toUpperCase()}</span>
              <span style={{ color: '#888', marginRight: 8 }}>{summaries.find(s => s.id === showDetail)?.date}</span>
            </div>
            <div style={{ fontSize: 18, lineHeight: 1.7, color: '#222', background: '#f6f6f6', padding: 24, borderRadius: 8, whiteSpace: 'pre-wrap', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              {summaries.find(s => s.id === showDetail)?.summary}
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default App;
