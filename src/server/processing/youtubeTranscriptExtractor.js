/**
 * Simplified YouTube Transcript Extractor (server-side)
 * Uses LangChain YoutubeLoader to fetch transcripts
 */
/* eslint-disable no-console */

class YouTubeTranscriptExtractor {
  constructor() {
    this.name = 'YouTubeTranscriptExtractor';
  }

  async extractTranscript(videoId) {
    try {
      const { YoutubeLoader } = await import('@langchain/community/document_loaders/web/youtube');
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const loader = YoutubeLoader.createFromUrl(videoUrl, {
        language: 'en',
        addVideoInfo: true,
      });
      const docs = await loader.load();
      if (!docs || docs.length === 0) {
        return { success: false, error: 'No transcript documents found' };
      }
      const document = docs[0];
      const transcript = this._cleanText(document.pageContent || '');
      if (transcript.length < 100) {
        return { success: false, error: `Transcript too short (${transcript.length} chars)` };
      }
      return { success: true, transcript, metadata: document.metadata };
    } catch (error) {
      let msg = error?.message || 'Unknown error';
      if (/unavailable|private/i.test(msg)) msg = 'Video is unavailable or private';
      if (/age-restricted|age restricted/i.test(msg)) msg = 'Video is age-restricted';
      if (/No transcript/i.test(msg)) msg = 'No transcript available for this video';
      return { success: false, error: msg };
    }
  }

  _cleanText(text) {
    return String(text)
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

module.exports = YouTubeTranscriptExtractor;
