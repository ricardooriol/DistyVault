/**
 * LibraryFallbackStrategy - Final fallback strategy using youtube-transcript library
 * Uses the youtube-transcript npm package as the last resort for transcript extraction
 */
const YoutubeTranscript = require('youtube-transcript');
const ExtractionStrategy = require('./ExtractionStrategy');

class LibraryFallbackStrategy extends ExtractionStrategy {
    constructor() {
        super('library-fallback', 3);
    }

    /**
     * Execute the library fallback strategy
     * @param {string} videoId - YouTube video ID
     * @returns {Promise<{success: boolean, data: any, error?: string}>}
     */
    async execute(videoId) {
        try {
            this._log('info', `Starting library fallback for video ID: ${videoId}`);

            // Check if the library is available and has the expected method
            if (!YoutubeTranscript || !YoutubeTranscript.YoutubeTranscript) {
                return {
                    success: false,
                    error: 'youtube-transcript library not available or incorrectly imported'
                };
            }

            const YTTranscript = YoutubeTranscript.YoutubeTranscript;
            
            if (typeof YTTranscript.fetchTranscript !== 'function') {
                return {
                    success: false,
                    error: 'YTTranscript.fetchTranscript method not available'
                };
            }

            this._log('info', 'Attempting transcript extraction using youtube-transcript library');

            // Try to fetch transcript using the library
            const result = await YTTranscript.fetchTranscript(videoId);

            this._log('info', `Library returned result type: ${typeof result}, isArray: ${Array.isArray(result)}`);
            this._log('info', `Library result length: ${Array.isArray(result) ? result.length : 'N/A'}`);

            // Debug: Log the actual result structure
            if (result) {
                this._log('info', `Library result sample: ${JSON.stringify(Array.isArray(result) ? result.slice(0, 2) : result, null, 2)}`);
            }

            if (!result) {
                return {
                    success: false,
                    error: 'Library returned null or undefined result'
                };
            }

            if (Array.isArray(result)) {
                if (result.length === 0) {
                    return {
                        success: false,
                        error: 'Library returned empty transcript array'
                    };
                }

                this._log('info', `Library returned ${result.length} transcript items`);
                
                // Log sample of first few items for debugging
                if (result.length > 0) {
                    this._log('info', `Sample transcript items:`, result.slice(0, 3));
                }

                return {
                    success: true,
                    data: result
                };
            } else {
                // Handle non-array results
                this._log('warn', `Library returned non-array result: ${typeof result}`);
                
                // Try to extract transcript from object structure
                const extractedData = this._extractFromLibraryResult(result);
                
                if (extractedData && extractedData.length > 0) {
                    return {
                        success: true,
                        data: extractedData
                    };
                } else {
                    return {
                        success: false,
                        error: 'Could not extract transcript data from library result'
                    };
                }
            }

        } catch (error) {
            this._log('error', `Library fallback failed: ${error.message}`);
            this._log('error', `Full error:`, error);
            
            // Provide more specific error messages based on common failure modes
            let errorMessage = error.message;
            
            if (error.message.includes('Video unavailable')) {
                errorMessage = 'Video is unavailable or private';
            } else if (error.message.includes('No transcript')) {
                errorMessage = 'No transcript available for this video';
            } else if (error.message.includes('Transcript disabled')) {
                errorMessage = 'Transcript is disabled for this video';
            } else if (error.message.includes('timeout')) {
                errorMessage = 'Request timed out while fetching transcript';
            }

            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Extract transcript data from various library result formats
     * @param {any} result - Result from youtube-transcript library
     * @returns {Array|null} - Extracted transcript segments or null
     * @private
     */
    _extractFromLibraryResult(result) {
        try {
            // Check if result has transcript property
            if (result.transcript && Array.isArray(result.transcript)) {
                this._log('info', 'Found transcript array in result.transcript');
                return result.transcript;
            }

            // Check if result has items property
            if (result.items && Array.isArray(result.items)) {
                this._log('info', 'Found transcript array in result.items');
                return result.items;
            }

            // Check if result has data property
            if (result.data && Array.isArray(result.data)) {
                this._log('info', 'Found transcript array in result.data');
                return result.data;
            }

            // Check if result has captions property
            if (result.captions && Array.isArray(result.captions)) {
                this._log('info', 'Found transcript array in result.captions');
                return result.captions;
            }

            // If result is an object with unknown structure, try to find arrays
            if (typeof result === 'object' && result !== null) {
                const keys = Object.keys(result);
                for (const key of keys) {
                    if (Array.isArray(result[key]) && result[key].length > 0) {
                        // Check if the array contains transcript-like objects
                        const firstItem = result[key][0];
                        if (typeof firstItem === 'object' && 
                            (firstItem.text || firstItem.content || firstItem.transcript)) {
                            this._log('info', `Found transcript array in result.${key}`);
                            return result[key];
                        }
                    }
                }
            }

            this._log('warn', 'Could not find transcript array in library result structure');
            return null;

        } catch (error) {
            this._log('error', `Error extracting from library result: ${error.message}`);
            return null;
        }
    }

    /**
     * Validate library-specific transcript format
     * @param {any} data - Raw extracted data from library
     * @returns {Promise<{valid: boolean, transcript: string, error?: string}>}
     */
    async validate(data) {
        try {
            if (!Array.isArray(data) || data.length === 0) {
                return {
                    valid: false,
                    error: 'Library data is not a valid array or is empty'
                };
            }

            this._log('info', `Validating library data with ${data.length} items`);

            // Extract text from library format (usually has 'text' property)
            const transcript = data
                .map(item => {
                    if (typeof item === 'string') {
                        return item.trim();
                    }
                    
                    if (typeof item === 'object' && item !== null) {
                        // youtube-transcript library typically uses 'text' property
                        if (item.text && typeof item.text === 'string') {
                            return item.text.trim();
                        }
                        
                        // Try other common properties
                        const textProps = ['content', 'transcript', 'caption', 'subtitle'];
                        for (const prop of textProps) {
                            if (item[prop] && typeof item[prop] === 'string') {
                                return item[prop].trim();
                            }
                        }
                    }
                    
                    return String(item).trim();
                })
                .filter(text => text && text.length > 0)
                .join(' ')
                .trim();

            // Clean the transcript
            const cleanedTranscript = this._cleanTranscript(transcript);

            if (!cleanedTranscript || cleanedTranscript.length < 50) {
                return {
                    valid: false,
                    error: `Library transcript too short: ${cleanedTranscript?.length || 0} characters (minimum 50 required)`
                };
            }

            // Check for meaningful content
            const uniqueWords = new Set(cleanedTranscript.toLowerCase().split(/\s+/)).size;
            if (uniqueWords < 10) {
                return {
                    valid: false,
                    error: `Library transcript lacks variety: only ${uniqueWords} unique words`
                };
            }

            this._log('info', `Library transcript validation successful: ${cleanedTranscript.length} characters, ${uniqueWords} unique words`);

            return {
                valid: true,
                transcript: cleanedTranscript
            };

        } catch (error) {
            this._log('error', `Library validation error: ${error.message}`);
            return {
                valid: false,
                error: `Library validation failed: ${error.message}`
            };
        }
    }
}

module.exports = LibraryFallbackStrategy;