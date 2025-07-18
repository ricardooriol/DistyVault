// YouTube transcript extraction
const ytdlp = require('yt-dlp-exec');

async function getYoutubeTranscript(videoUrl) {
  const result = await ytdlp(videoUrl, {
    dumpSingleJson: true,
    noCheckCertificates: true,
    skipDownload: true,
    writeAutoSub: true,
    writeSub: true,
    subLang: 'en',
  });
  return result.subtitles?.[0]?.data || '';
}

async function getPlaylistTranscripts(playlistUrl) {
  // Placeholder: fetch playlist videos and transcripts
  return [];
}

module.exports = { getYoutubeTranscript, getPlaylistTranscripts };
