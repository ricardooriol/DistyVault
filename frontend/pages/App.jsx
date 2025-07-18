import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [input, setInput] = useState('');
  const [type, setType] = useState('url');
  const [summaries, setSummaries] = useState([]);
  const [file, setFile] = useState(null);

  useEffect(() => {
    axios.get('/api/summaries').then(res => setSummaries(res.data.summaries));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    let res;
    if (type === 'url') {
      res = await axios.post('/api/summarize-url', { url: input });
    } else if (type === 'youtube') {
      res = await axios.post('/api/summarize-youtube', { videoUrl: input });
    } else if (type === 'playlist') {
      res = await axios.post('/api/summarize-playlist', { playlistUrl: input });
    } else if (type === 'file' && file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const fileType = file.name.endsWith('.pdf') ? 'pdf' : file.name.endsWith('.docx') ? 'docx' : 'txt';
        const fileData = ev.target.result;
        res = await axios.post('/api/summarize-file', { fileData, fileType });
        setSummaries([{ id: res.data.id, summary: res.data.summary }, ...summaries]);
      };
      reader.readAsArrayBuffer(file);
      return;
    }
    if (res) setSummaries([{ id: res.data.id, summary: res.data.summary }, ...summaries]);
  };

  return (
    <div style={{ maxWidth: 800, margin: 'auto', padding: 32 }}>
      <h1>Sawron Knowledge Powerhouse</h1>
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
      <ul>
        {summaries.map(s => (
          <li key={s.id} style={{ marginBottom: 16 }}>
            <pre style={{ whiteSpace: 'pre-wrap', background: '#f4f4f4', padding: 16 }}>{s.summary}</pre>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
