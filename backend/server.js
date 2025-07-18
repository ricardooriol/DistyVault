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
  console.log('[DEBUG] /api/summarize called with text length:', text?.length);
  try {
    const summary = await summarizeText(text);
    const id = await saveSummary(summary);
    console.log('[DEBUG] /api/summarize completed, summary length:', summary?.length);
    res.json({ id, summary });
  } catch (err) {
    console.error('[ERROR] /api/summarize:', err);
    res.status(500).json({ error: err.message });
  }
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

const PORT = process.env.PORT || 5173;
app.listen(PORT, () => {
  console.log(`Sawron backend running on http://localhost:${PORT}`);
});
