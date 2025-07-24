/**
 * TranscriptValidator - Comprehensive validation system for YouTube transcripts
 * Implements strict validation rules and detailed error reporting
 */
class TranscriptValidator {
    constructor() {
        this.name = 'TranscriptValidator';
        
        // Validation thresholds
        this.MIN_TRANSCRIPT_LENGTH = 100;
        this.MIN_UNIQUE_WORDS = 15;
        this.MIN_SEGMENTS = 3;
        this.MAX_REPETITION_RATIO = 0.7;
        this.MIN_AVERAGE_SEGMENT_LENGTH = 5;
    }

    /**
     * Validate transcript data with comprehensive checks
     * @param {any} data - Raw transcript data
     * @param {string} source - Source of the data (for error reporting)
     * @returns {Object} - Validation result with detailed feedback
     */
    validateTranscript(data, source = 'unknown') {
        try {
            this._log('info', `Starting validation for data from ${source}`);

            // Step 1: Basic data structure validation
            const structureValidation = this._validateDataStructure(data);
            if (!structureValidation.valid) {
                return this._createValidationResult(false, 'INVALID_STRUCTURE', structureValidation.error, source);
            }

            // Step 2: Extract and clean transcript text
            const extractionResult = this._extractTranscriptText(data);
            if (!extractionResult.success) {
                return this._createValidationResult(false, 'EXTRACTION_FAILED', extractionResult.error, source);
            }

            const transcript = extractionResult.transcript;
            const segments = extractionResult.segments;

            // Step 3: Length validation
            const lengthValidation = this._validateLength(transcript, segments);
            if (!lengthValidation.valid) {
                return this._createValidationResult(false, 'INSUFFICIENT_LENGTH', lengthValidation.error, source, {
                    actualLength: transcript.length,
                    requiredLength: this.MIN_TRANSCRIPT_LENGTH,
                    segmentCount: segments.length
                });
            }

            // Step 4: Content quality validation
            const qualityValidation = this._validateContentQuality(transcript);
            if (!qualityValidation.valid) {
                return this._createValidationResult(false, 'POOR_QUALITY', qualityValidation.error, source, {
                    transcript: transcript.substring(0, 200) + '...'
                });
            }

            // Step 5: Segment validation
            const segmentValidation = this._validateSegments(segments);
            if (!segmentValidation.valid) {
                return this._createValidationResult(false, 'INVALID_SEGMENTS', segmentValidation.error, source, {
                    segmentCount: segments.length,
                    sampleSegments: segments.slice(0, 3)
                });
            }

            // Step 6: Repetition and spam detection
            const repetitionValidation = this._validateRepetition(transcript, segments);
            if (!repetitionValidation.valid) {
                return this._createValidationResult(false, 'EXCESSIVE_REPETITION', repetitionValidation.error, source, {
                    repetitionRatio: repetitionValidation.ratio
                });
            }

            // All validations passed
            this._log('info', `Validation successful: ${transcript.length} chars, ${segments.length} segments`);
            
            return this._createValidationResult(true, 'VALID', 'Transcript validation successful', source, {
                transcript: transcript,
                segments: segments,
                stats: {
                    length: transcript.length,
                    segmentCount: segments.length,
                    uniqueWords: this._countUniqueWords(transcript),
                    averageSegmentLength: segments.reduce((sum, seg) => sum + seg.text.length, 0) / segments.length
                }
            });

        } catch (error) {
            this._log('error', `Validation error: ${error.message}`);
            return this._createValidationResult(false, 'VALIDATION_ERROR', `Validation failed: ${error.message}`, source);
        }
    }

    /**
     * Validate basic data structure
     * @param {any} data - Data to validate
     * @returns {Object} - Validation result
     * @private
     */
    _validateDataStructure(data) {
        if (!data) {
            return { valid: false, error: 'Data is null or undefined' };
        }

        if (typeof data === 'string') {
            if (data.trim().length === 0) {
                return { valid: false, error: 'Data is empty string' };
            }
            return { valid: true };
        }

        if (Array.isArray(data)) {
            if (data.length === 0) {
                return { valid: false, error: 'Data array is empty' };
            }
            return { valid: true };
        }

        if (typeof data === 'object') {
            const keys = Object.keys(data);
            if (keys.length === 0) {
                return { valid: false, error: 'Data object is empty' };
            }
            return { valid: true };
        }

        return { valid: false, error: `Unsupported data type: ${typeof data}` };
    }

    /**
     * Extract transcript text from various data formats
     * @param {any} data - Raw data
     * @returns {Object} - Extraction result
     * @private
     */
    _extractTranscriptText(data) {
        try {
            let segments = [];
            let transcript = '';

            if (typeof data === 'string') {
                transcript = this._cleanText(data);
                segments = [{ text: transcript }];
            } else if (Array.isArray(data)) {
                segments = data.map(item => {
                    if (typeof item === 'string') {
                        return { text: this._cleanText(item) };
                    } else if (item && typeof item.text === 'string') {
                        return { text: this._cleanText(item.text) };
                    } else if (item && typeof item === 'object') {
                        // Try common property names
                        const textProps = ['text', 'content', 'transcript', 'caption', 'subtitle'];
                        for (const prop of textProps) {
                            if (item[prop] && typeof item[prop] === 'string') {
                                return { text: this._cleanText(item[prop]) };
                            }
                        }
                    }
                    return { text: this._cleanText(String(item)) };
                }).filter(segment => segment.text && segment.text.length > 0);

                transcript = segments.map(seg => seg.text).join(' ');
            } else if (typeof data === 'object') {
                // Try to find transcript in object properties
                const textProps = ['text', 'transcript', 'content', 'caption'];
                for (const prop of textProps) {
                    if (data[prop]) {
                        return this._extractTranscriptText(data[prop]);
                    }
                }
                
                // If no direct text property, try to extract from all string values
                const stringValues = Object.values(data)
                    .filter(value => typeof value === 'string' && value.trim().length > 0)
                    .map(value => this._cleanText(value));
                
                if (stringValues.length > 0) {
                    transcript = stringValues.join(' ');
                    segments = stringValues.map(text => ({ text }));
                }
            }

            if (!transcript || transcript.length === 0) {
                return { success: false, error: 'No text content could be extracted from data' };
            }

            return { success: true, transcript, segments };

        } catch (error) {
            return { success: false, error: `Text extraction failed: ${error.message}` };
        }
    }

    /**
     * Validate transcript length requirements
     * @param {string} transcript - Full transcript text
     * @param {Array} segments - Transcript segments
     * @returns {Object} - Validation result
     * @private
     */
    _validateLength(transcript, segments) {
        if (transcript.length < this.MIN_TRANSCRIPT_LENGTH) {
            return {
                valid: false,
                error: `Transcript too short: ${transcript.length} characters (minimum ${this.MIN_TRANSCRIPT_LENGTH} required)`
            };
        }

        if (segments.length < this.MIN_SEGMENTS) {
            return {
                valid: false,
                error: `Too few segments: ${segments.length} (minimum ${this.MIN_SEGMENTS} required)`
            };
        }

        const averageSegmentLength = segments.reduce((sum, seg) => sum + seg.text.length, 0) / segments.length;
        if (averageSegmentLength < this.MIN_AVERAGE_SEGMENT_LENGTH) {
            return {
                valid: false,
                error: `Segments too short on average: ${averageSegmentLength.toFixed(1)} characters (minimum ${this.MIN_AVERAGE_SEGMENT_LENGTH} required)`
            };
        }

        return { valid: true };
    }

    /**
     * Validate content quality (vocabulary diversity, meaningful content)
     * @param {string} transcript - Transcript text
     * @returns {Object} - Validation result
     * @private
     */
    _validateContentQuality(transcript) {
        const uniqueWords = this._countUniqueWords(transcript);
        
        if (uniqueWords < this.MIN_UNIQUE_WORDS) {
            return {
                valid: false,
                error: `Insufficient vocabulary diversity: ${uniqueWords} unique words (minimum ${this.MIN_UNIQUE_WORDS} required)`
            };
        }

        // Check for gibberish patterns
        const gibberishPatterns = [
            /^[a-z]{1,2}(\s[a-z]{1,2}){10,}$/i, // Single/double letter words
            /(.)\1{10,}/, // Repeated characters
            /^[^a-zA-Z]*$/, // No letters at all
            /^\d+(\s\d+)*$/ // Only numbers
        ];

        for (const pattern of gibberishPatterns) {
            if (pattern.test(transcript.trim())) {
                return {
                    valid: false,
                    error: 'Transcript appears to contain gibberish or invalid content'
                };
            }
        }

        return { valid: true };
    }

    /**
     * Validate individual segments
     * @param {Array} segments - Transcript segments
     * @returns {Object} - Validation result
     * @private
     */
    _validateSegments(segments) {
        const emptySegments = segments.filter(seg => !seg.text || seg.text.trim().length === 0);
        if (emptySegments.length > 0) {
            return {
                valid: false,
                error: `Found ${emptySegments.length} empty segments`
            };
        }

        const veryShortSegments = segments.filter(seg => seg.text.trim().length < 2);
        if (veryShortSegments.length > segments.length * 0.5) {
            return {
                valid: false,
                error: `Too many very short segments: ${veryShortSegments.length}/${segments.length}`
            };
        }

        return { valid: true };
    }

    /**
     * Validate repetition levels
     * @param {string} transcript - Full transcript
     * @param {Array} segments - Transcript segments
     * @returns {Object} - Validation result
     * @private
     */
    _validateRepetition(transcript, segments) {
        // Check for excessive repetition of segments
        const segmentTexts = segments.map(seg => seg.text.toLowerCase().trim());
        const uniqueSegments = new Set(segmentTexts);
        const repetitionRatio = 1 - (uniqueSegments.size / segmentTexts.length);

        if (repetitionRatio > this.MAX_REPETITION_RATIO) {
            return {
                valid: false,
                error: `Excessive repetition detected: ${(repetitionRatio * 100).toFixed(1)}% repeated content`,
                ratio: repetitionRatio
            };
        }

        return { valid: true, ratio: repetitionRatio };
    }

    /**
     * Count unique words in text
     * @param {string} text - Text to analyze
     * @returns {number} - Number of unique words
     * @private
     */
    _countUniqueWords(text) {
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 1);
        
        return new Set(words).size;
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
     * Create standardized validation result
     * @param {boolean} valid - Whether validation passed
     * @param {string} code - Error/success code
     * @param {string} message - Human-readable message
     * @param {string} source - Data source
     * @param {Object} details - Additional details
     * @returns {Object} - Validation result
     * @private
     */
    _createValidationResult(valid, code, message, source, details = {}) {
        return {
            valid,
            code,
            message,
            source,
            timestamp: new Date().toISOString(),
            details
        };
    }

    /**
     * Log messages with validator name
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @private
     */
    _log(level, message) {
        const logMessage = `[${this.name}] ${message}`;
        
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

module.exports = TranscriptValidator;