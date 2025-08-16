/**
 * Simplified YouTube Transcript Extractor
 * Uses only LangChain YoutubeLoader for reliable transcript extraction
 */

class YouTubeTranscriptExtractor {
    constructor() {
        this.name = 'YouTubeTranscriptExtractor';
    }

    /**
     * Extract transcript from YouTube video using LangChain
     * @param {string} videoId - YouTube video ID
     * @returns {Promise<{success: boolean, transcript?: string, error?: string}>}
     */
    async extractTranscript(videoId) {
        try {
            this._log('info', `🎬 Starting transcript extraction for video ID: ${videoId}`);

            // Dynamic import for ES modules
            const { YoutubeLoader } = await import('@langchain/community/document_loaders/web/youtube');

            // Construct YouTube URL from video ID
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            this._log('info', `Creating loader for URL: ${videoUrl}`);

            // Create loader with configuration
            const loader = YoutubeLoader.createFromUrl(videoUrl, {
                language: 'en',
                addVideoInfo: true,
            });

            this._log('info', 'Loading transcript documents...');
            const docs = await loader.load();

            if (!docs || docs.length === 0) {
                this._log('error', 'LangChain loader returned no documents');
                return {
                    success: false,
                    error: 'No transcript documents found'
                };
            }

            this._log('info', `Successfully loaded ${docs.length} document(s)`);

            const document = docs[0];
            const transcript = document.pageContent;
            const metadata = document.metadata;

            if (!transcript || transcript.length === 0) {
                this._log('error', 'Document contains no transcript content');
                return {
                    success: false,
                    error: 'Document contains no transcript content'
                };
            }

            // Validate transcript length (minimum 100 characters)
            if (transcript.length < 100) {
                this._log('error', `Transcript too short: ${transcript.length} characters`);
                return {
                    success: false,
                    error: `Transcript too short: ${transcript.length} characters (minimum 100 required)`
                };
            }

            // Clean the transcript text
            const cleanedTranscript = this._cleanText(transcript);

            this._log('info', `✅ Transcript extracted successfully: ${cleanedTranscript.length} characters`);
            this._log('info', `Video metadata: ${JSON.stringify(metadata, null, 2)}`);

            return {
                success: true,
                transcript: cleanedTranscript,
                metadata: metadata
            };

        } catch (error) {
            this._log('error', `Transcript extraction failed: ${error.message}`);

            // Provide specific error messages for common issues
            let errorMessage = error.message;

            if (error.message.includes('Video unavailable')) {
                errorMessage = 'Video is unavailable or private';
            } else if (error.message.includes('No transcript')) {
                errorMessage = 'No transcript available for this video';
            } else if (error.message.includes('age-restricted')) {
                errorMessage = 'Video is age-restricted and cannot be processed';
            } else if (error.message.includes('private')) {
                errorMessage = 'Video is private and cannot be accessed';
            }

            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Clean text content
     * @param {string} text - Raw text
     * @returns {string} - Cleaned text
     * @private
     */
    _cleanText(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }

        return text
            // Decode HTML entities
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ')
            // Remove HTML tags
            .replace(/<[^>]*>/g, '')
            // Normalize whitespace
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Log messages with extractor name
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @private
     */
    _log(level, message) {
        const timestamp = new Date().toISOString();
        const logMessage = `${timestamp} ${level.toUpperCase()} [${this.name}] ${message}`;
        
        switch (level) {
            case 'info':
                console.log(logMessage);
                break;
            case 'warn':
                console.warn(logMessage);
                break;
            case 'error':
                console.error(logMessage);
                break;
            default:
                console.log(logMessage);
        }
    }
}

module.exports = YouTubeTranscriptExtractor;