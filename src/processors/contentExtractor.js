/* eslint-disable no-console */
const axios = require('axios');
const cheerio = require('cheerio');
const YouTubeTranscriptExtractor = require('./youtubeTranscriptExtractor');

class ContentExtractor {
  isYoutubeUrl(url) {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)/i;
    return youtubeRegex.test(url);
  }

  classifyYoutubeUrl(url) {
    if (url.includes('list=')) return 'playlist';
    if (url.includes('watch?v=') || url.includes('youtu.be/')) return 'video';
    if (url.includes('/channel/') || url.includes('/c/') || url.includes('/@')) return 'channel';
    return 'unknown';
  }

  extractYoutubeId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m && m[1]) return m[1];
    }
    return null;
  }

  extractYoutubePlaylistId(url) {
    const m = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
  }

  async extractPlaylistVideos(playlistUrl) {
    const id = this.extractYoutubePlaylistId(playlistUrl);
    if (!id) throw new Error('Invalid playlist URL');
    const response = await axios.get(`https://www.youtube.com/playlist?list=${id}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 30000
    });
    const html = response.data;
    if (/Private playlist|"isPrivate":true|playlist-header-banner-private/.test(html)) {
      throw new Error('This YouTube playlist is private, cannot access the videos.');
    }
    const videoIdMatches = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/g) || html.match(/watch\?v=([a-zA-Z0-9_-]{11})/g) || [];
    const ids = [...new Set(videoIdMatches.map(m => m.includes('"videoId":"') ? m.replace(/.*"videoId":"([^"]+)".*/, '$1') : m.replace('watch?v=', '')))]
      .filter(Boolean);
    return ids.map(id2 => `https://www.youtube.com/watch?v=${id2}`);
  }

  async extractFromYoutube(url) {
    const videoId = this.extractYoutubeId(url);
    if (!videoId) throw new Error('Unable to extract video ID');
    const extractor = new YouTubeTranscriptExtractor();
    const res = await extractor.extractTranscript(videoId);
    if (!res.success) throw new Error(res.error || 'Transcript extraction failed');
    return {
      text: res.transcript,
      title: 'YouTube Video',
      contentType: 'youtube-video',
      extractionMethod: 'langchain-youtube-loader',
      fallbackUsed: false,
      metadata: { videoId }
    };
  }

  async extractFromUrl(url) {
    if (this.isYoutubeUrl(url)) {
      const kind = this.classifyYoutubeUrl(url);
      if (kind === 'video') return this.extractFromYoutube(url);
      if (kind === 'playlist') {
        const videos = await this.extractPlaylistVideos(url);
        return { text: '', title: 'YouTube Playlist', contentType: 'youtube-playlist', extractionMethod: 'playlist-scan', fallbackUsed: false, metadata: { videos } };
      }
    }
    return this.extractFromWebpage(url);
  }

  async extractFromWebpage(url) {
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });
    const $ = cheerio.load(response.data);
    const title = $('title').text() || url;
    $('script, style, nav, footer, header, aside, .ads, .comments, .sidebar').remove();
    const mainSelectors = ['main', 'article', '.content', '.post', '.entry', '#content', '.main'];
    let content = '';
    for (const sel of mainSelectors) {
      if ($(sel).length) { content = $(sel).text(); break; }
    }
    if (!content) content = $('body').text();
    content = this.cleanText(content);
    if (!content || content.length < 100) {
      const metaDescription = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content');
      content = metaDescription && metaDescription.length > 50 ? metaDescription : `This page at ${url} appears to have limited extractable text.`;
    }
    return { text: content, title, contentType: 'webpage', extractionMethod: 'cheerio', fallbackUsed: false, metadata: { url } };
  }

  cleanText(text) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }
}

module.exports = new ContentExtractor();
