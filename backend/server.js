// Express backend for Sawron
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { summarizeText } = require('./llm/ollama');
const { scrapeUrl, getYoutubeTranscript, getPlaylistTranscripts, parseFile } = require('./scraping');
const { saveSummary, getSummaries } = require('./storage/db');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '100mb' }));

// Summarize raw text
app.post('/api/summarize', async (req, res) => {
  const { text } = req.body;
  let type = 'text', url = '', name = '', status = 'scraping', step = 1, steps = 4;
  if (/^https?:\/\//.test(text)) {
    type = 'url'; url = text; name = text.split('/')[2] || 'Website';
  } else if (/youtube\.com\/watch\?v=|youtu\.be\//.test(text)) {
    type = 'youtube'; url = text; name = 'YouTube Video';
  } else if (/youtube\.com\/playlist\?list=/.test(text)) {
    type = 'playlist'; url = text; name = 'YouTube Playlist';
  } else {
    name = text.slice(0, 32).replace(/\s+/g, ' ').trim().split(' ').slice(0, 4).join(' ');
  }
  const date = new Date().toISOString();
  const started = Date.now();
  try {
    // Save as in-progress first
    const inProgress = { summary: '', type, date, status: 'scraping', name, url };
    const id = await saveSummary(inProgress);
    // Step 1: Scraping
    setTimeout(async () => {
      await saveSummary({ id, summary: '', type, date, status: 'processing', name, url });
      // Step 2: Processing
      const summary = await summarizeText(text);
      await saveSummary({ id, summary, type, date, status: 'done', name, url });
    }, 1000);
    res.json({ id, summary: '', type, date, status: 'scraping', name, url, step, steps, started });
  } catch (err) {
    console.error('[ERROR] /api/summarize:', err);
    res.status(500).json({ error: err.message });
  }
});
// Stop summarization
app.post('/api/summaries/:id/stop', async (req, res) => {
  const { id } = req.params;
  try {
    await require('./storage/db').saveSummary({ id, summary: '', type: '', date: '', status: 'stopped', name: '', url: '' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Get progress/status for a summary
app.get('/api/summaries/:id/progress', async (req, res) => {
  const { id } = req.params;
  const summaries = await require('./storage/db').getSummaries();
  const summary = summaries.find(s => s.id == id);
  if (!summary) return res.status(404).json({ error: 'Not found' });
  // Calculate elapsed time
  const started = summary.started || summary.date;
  const elapsed = started ? Math.floor((Date.now() - new Date(started).getTime()) / 1000) : null;
  res.json({ ...summary, elapsed });
});

// Scrape and summarize a URL
app.post('/api/summarize-url', async (req, res) => {
  const { url } = req.body;
  console.log('[DEBUG] /api/summarize-url called with url:', url);
  try {
    const text = await scrapeUrl(url);
    console.log('[DEBUG] /api/summarize-url scraped text length:', text?.length);
    const summary = await summarizeText(text);
    const id = await saveSummary(summary);
    console.log('[DEBUG] /api/summarize-url completed, summary length:', summary?.length);
    res.json({ id, summary });
  } catch (err) {
    console.error('[ERROR] /api/summarize-url:', err);
    res.status(500).json({ error: err.message });
  }
});

// Summarize YouTube video
app.post('/api/summarize-youtube', async (req, res) => {
  const { videoUrl } = req.body;
  console.log('[DEBUG] /api/summarize-youtube called with videoUrl:', videoUrl);
  try {
    const transcript = await getYoutubeTranscript(videoUrl);
    console.log('[DEBUG] /api/summarize-youtube transcript length:', transcript?.length);
    const summary = await summarizeText(transcript);
    const id = await saveSummary(summary);
    console.log('[DEBUG] /api/summarize-youtube completed, summary length:', summary?.length);
    res.json({ id, summary });
  } catch (err) {
    console.error('[ERROR] /api/summarize-youtube:', err);
    res.status(500).json({ error: err.message });
  }
});

// Summarize YouTube playlist
app.post('/api/summarize-playlist', async (req, res) => {
  const { playlistUrl } = req.body;
  console.log('[DEBUG] /api/summarize-playlist called with playlistUrl:', playlistUrl);
  try {
    const transcripts = await getPlaylistTranscripts(playlistUrl);
    console.log('[DEBUG] /api/summarize-playlist transcripts count:', transcripts?.length);
    const summaries = [];
    for (const transcript of transcripts) {
      const summary = await summarizeText(transcript.text);
      const id = await saveSummary(summary);
      summaries.push({ video: transcript.video, id, summary });
    }
    console.log('[DEBUG] /api/summarize-playlist completed, summaries count:', summaries.length);
    res.json({ summaries });
  } catch (err) {
    console.error('[ERROR] /api/summarize-playlist:', err);
    res.status(500).json({ error: err.message });
  }
});

// Summarize uploaded file
app.post('/api/summarize-file', async (req, res) => {
  const { fileData, fileType } = req.body;
  console.log('[DEBUG] /api/summarize-file called with fileType:', fileType, 'fileData length:', fileData?.length);
  try {
    const text = await parseFile(fileData, fileType);
    console.log('[DEBUG] /api/summarize-file parsed text length:', text?.length);
    const summary = await summarizeText(text);
    const id = await saveSummary(summary);
    console.log('[DEBUG] /api/summarize-file completed, summary length:', summary?.length);
    res.json({ id, summary });
  } catch (err) {
    console.error('[ERROR] /api/summarize-file:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all summaries
app.get('/api/summaries', async (req, res) => {
  const summaries = await getSummaries();
  res.json({ summaries });
});

// Delete summary
app.delete('/api/summaries/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await require('./storage/db').deleteSummary(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5174;
app.listen(PORT, () => {
  console.log(`Sawron backend running on http://localhost:${PORT}`);
});
