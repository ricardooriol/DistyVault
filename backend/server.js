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
  const summary = await summarizeText(text);
  const id = await saveSummary(summary);
  res.json({ id, summary });
});

// Scrape and summarize a URL
app.post('/api/summarize-url', async (req, res) => {
  const { url } = req.body;
  const text = await scrapeUrl(url);
  const summary = await summarizeText(text);
  const id = await saveSummary(summary);
  res.json({ id, summary });
});

// Summarize YouTube video
app.post('/api/summarize-youtube', async (req, res) => {
  const { videoUrl } = req.body;
  const transcript = await getYoutubeTranscript(videoUrl);
  const summary = await summarizeText(transcript);
  const id = await saveSummary(summary);
  res.json({ id, summary });
});

// Summarize YouTube playlist
app.post('/api/summarize-playlist', async (req, res) => {
  const { playlistUrl } = req.body;
  const transcripts = await getPlaylistTranscripts(playlistUrl);
  const summaries = [];
  for (const transcript of transcripts) {
    const summary = await summarizeText(transcript.text);
    const id = await saveSummary(summary);
    summaries.push({ video: transcript.video, id, summary });
  }
  res.json({ summaries });
});

// Summarize uploaded file
app.post('/api/summarize-file', async (req, res) => {
  const { fileData, fileType } = req.body;
  const text = await parseFile(fileData, fileType);
  const summary = await summarizeText(text);
  const id = await saveSummary(summary);
  res.json({ id, summary });
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
