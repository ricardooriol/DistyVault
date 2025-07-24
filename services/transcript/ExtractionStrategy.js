/**
 * Base ExtractionStrategy class for YouTube transcript extraction
 * Provides common interface and validation methods for all extraction strategies
 */
class ExtractionStrategy {
    constructor(name, priority) {
        this.name = name;
        this.priority = priority;
    }

    /**
     * Execute the extraction strategy
     * @param {string} videoId - YouTube video ID
     * @returns {Promise<{success: boolean, data: any, error?: string}>}
     */
    async execute(videoId) {
        throw new Error('execute method must be implemented by subclass');
    }

    /**
     * Validate the extracted data using comprehensive validation system
     * @param {any} data - Raw extracted data
     * @returns {Promise<{valid: boolean, transcript: string, error?: string, code?: string, details?: Object}>}
     */
    async validate(data) {
        try {
            // Use comprehensive validator
            const TranscriptValidator = require('./TranscriptValidator');
            const validator = new TranscriptValidator();
            
            const validationResult = validator.validateTranscript(data, this.name);
            
            if (validationResult.valid) {
                return {
                    valid: true,
                    transcript: validationResult.details.transcript,
                    segments: validationResult.details.segments,
                    stats: validationResult.details.stats
                };
            } else {
                return {
                    valid: false,
                    error: validationResult.message,
                    code: validationResult.code,
                    details: validationResult.details
                };
            }

        } catch (error) {
            this._log('error', `Validation error: ${error.message}`);
            return {
                valid: false,
                error: `Validation failed: ${error.message}`,
                code: 'VALIDATION_EXCEPTION'
            };
        }
    }

    /**
     * Extract text from a transcript item (handles various formats)
     * @param {any} item - Transcript item
     * @returns {string} - Extracted text
     * @private
     */
    _extractTextFromItem(item) {
        if (typeof item === 'string') {
            return item.trim();
        }
        
        if (typeof item === 'object' && item !== null) {
            // Try common property names for transcript text
            const textProps = ['text', 'snippet', 'content', 'transcript', 'caption', 'subtitle'];
            for (const prop of textProps) {
                if (item[prop] && typeof item[prop] === 'string') {
                    return item[prop].trim();
                }
            }
        }
        
        // Last resort - convert to string
        return String(item).trim();
    }

    /**
     * Clean transcript text by removing HTML entities and normalizing whitespace
     * @param {string} text - Raw transcript text
     * @returns {string} - Cleaned transcript text
     * @private
     */
    _cleanTranscript(text) {
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
     * Log strategy execution details
     * @param {string} level - Log level (info, warn, error)
     * @param {string} message - Log message
     * @param {any} data - Additional data to log
     * @protected
     */
    _log(level, message, data = null) {
        const logMessage = `[${this.name}] ${message}`;
        
        switch (level) {
            case 'info':
                console.log(logMessage, data || '');
                break;
            case 'warn':
                console.warn(logMessage, data || '');
                break;
            case 'error':
                console.error(logMessage, data || '');
                break;
            default:
                console.log(logMessage, data || '');
        }
    }
}

module.exports = ExtractionStrategy;