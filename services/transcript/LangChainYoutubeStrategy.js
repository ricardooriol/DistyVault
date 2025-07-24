/**
 * LangChainYoutubeStrategy - YouTube transcript extraction using LangChain YoutubeLoader
 * Uses the @langchain/community YoutubeLoader for robust transcript extraction
 */
const ExtractionStrategy = require('./ExtractionStrategy');

class LangChainYoutubeStrategy extends ExtractionStrategy {
    constructor() {
        super('langchain-youtube-loader', 0); // Highest priority since it works!
    }

    /**
     * Execute the LangChain YouTube loader strategy
     * @param {string} videoId - YouTube video ID
     * @returns {Promise<{success: boolean, data: any, error?: string}>}
     */
    async execute(videoId) {
        try {
            this._log('info', `Starting LangChain YouTube loader for video ID: ${videoId}`);

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
                return {
                    success: false,
                    error: 'LangChain loader returned no documents'
                };
            }

            this._log('info', `Successfully loaded ${docs.length} document(s)`);

            const document = docs[0];
            const transcript = document.pageContent;
            const metadata = document.metadata;

            if (!transcript || transcript.length === 0) {
                return {
                    success: false,
                    error: 'Document contains no transcript content'
                };
            }

            this._log('info', `Transcript extracted: ${transcript.length} characters`);
            this._log('info', `Video metadata: ${JSON.stringify(metadata, null, 2)}`);

            // Convert to our expected format
            const segments = this._convertToSegments(transcript);

            return {
                success: true,
                data: segments,
                metadata: metadata,
                rawTranscript: transcript
            };

        } catch (error) {
            this._log('error', `LangChain strategy failed: ${error.message}`);

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
                error: errorMessage,
                originalError: error.message
            };
        }
    }

    /**
     * Convert transcript text to segments format
     * @param {string} transcript - Full transcript text
     * @returns {Array} - Array of transcript segments
     * @private
     */
    _convertToSegments(transcript) {
        // Split transcript into logical segments
        // LangChain provides the full transcript as one text block

        // Split by sentences or logical breaks
        const sentences = transcript
            .split(/[.!?]+/)
            .map(sentence => sentence.trim())
            .filter(sentence => sentence.length > 10); // Filter out very short segments

        // If we have too few sentences, split by paragraphs or line breaks
        if (sentences.length < 5) {
            const paragraphs = transcript
                .split(/\n\s*\n/)
                .map(para => para.trim().replace(/\s+/g, ' '))
                .filter(para => para.length > 20);

            if (paragraphs.length > 0) {
                return paragraphs.map(text => ({ text }));
            }
        }

        // If we have a reasonable number of sentences, use them
        if (sentences.length >= 5) {
            return sentences.map(text => ({ text: text + '.' }));
        }

        // Fallback: split into chunks of reasonable size
        const chunkSize = 200;
        const chunks = [];

        for (let i = 0; i < transcript.length; i += chunkSize) {
            const chunk = transcript.substring(i, i + chunkSize);
            if (chunk.trim().length > 0) {
                chunks.push({ text: chunk.trim() });
            }
        }

        return chunks.length > 0 ? chunks : [{ text: transcript }];
    }

    /**
     * Enhanced validation for LangChain results
     * @param {any} data - Raw extracted data
     * @returns {Promise<{valid: boolean, transcript: string, error?: string, code?: string, details?: Object}>}
     */
    async validate(data) {
        try {
            // Use the parent validation but with some LangChain-specific enhancements
            const baseValidation = await super.validate(data);

            if (baseValidation.valid) {
                this._log('info', `LangChain validation successful: ${baseValidation.transcript.length} characters`);

                // Add LangChain-specific metadata if available
                if (data.metadata) {
                    baseValidation.metadata = data.metadata;
                }

                if (data.rawTranscript) {
                    baseValidation.rawTranscript = data.rawTranscript;
                }
            }

            return baseValidation;

        } catch (error) {
            this._log('error', `LangChain validation error: ${error.message}`);
            return {
                valid: false,
                error: `LangChain validation failed: ${error.message}`,
                code: 'LANGCHAIN_VALIDATION_ERROR'
            };
        }
    }
}

module.exports = LangChainYoutubeStrategy;