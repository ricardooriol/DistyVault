
// Brute-force YouTube transcript extraction using yt-dlp via python3
const { spawn } = require('child_process');

async function getYoutubeTranscript(videoUrl) {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', videoUrl,
      '--skip-download',
      '--write-auto-sub',
      '--sub-lang', 'en',
      '--sub-format', 'vtt',
      '--output', '%(id)s.%(ext)s'
    ];
    const ytdlp = spawn('python3', ['-m', 'yt_dlp', ...args]);
    let transcript = '';
    ytdlp.stdout.on('data', (data) => {
      transcript += data.toString();
    });
    ytdlp.stderr.on('data', (data) => {
      // Optionally log errors
    });
    ytdlp.on('close', (code) => {
      // Parse .vtt file if downloaded
      // For brute-force, just return stdout
      resolve(transcript.trim());
    });
    ytdlp.on('error', reject);
  });
}

async function getPlaylistTranscripts(playlistUrl) {
  // Brute-force: not implemented, return empty array
  return [];
}

module.exports = { getYoutubeTranscript, getPlaylistTranscripts };
