/**
 * CaptionXmlProcessor - Comprehensive XML processing for YouTube captions
 * Handles various XML formats and provides robust text extraction
 */
class CaptionXmlProcessor {
    constructor() {
        this.name = 'CaptionXmlProcessor';
    }

    /**
     * Process caption XML and extract transcript segments
     * @param {string} xmlContent - Raw XML content from YouTube
     * @returns {Array} - Array of transcript segments
     */
    processXml(xmlContent) {
        if (!xmlContent || typeof xmlContent !== 'string') {
            throw new Error('Invalid XML content provided');
        }

        this._log('info', `Processing XML content: ${xmlContent.length} characters`);

        // Try multiple extraction methods
        const extractionMethods = [
            () => this._extractFromTextTags(xmlContent),
            () => this._extractFromCdataSections(xmlContent),
            () => this._extractFromAttributes(xmlContent),
            () => this._extractFromAlternativeFormats(xmlContent)
        ];

        for (let i = 0; i < extractionMethods.length; i++) {
            try {
                const segments = extractionMethods[i]();
                if (segments && segments.length > 0) {
                    this._log('info', `Successfully extracted ${segments.length} segments using method ${i + 1}`);
                    return this._validateAndCleanSegments(segments);
                }
            } catch (error) {
                this._log('warn', `Extraction method ${i + 1} failed: ${error.message}`);
            }
        }

        throw new Error('No valid transcript segments found in XML');
    }

    /**
     * Extract text from standard <text> tags
     * @param {string} xmlContent - XML content
     * @returns {Array} - Array of text segments
     * @private
     */
    _extractFromTextTags(xmlContent) {
        this._log('info', 'Attempting extraction from <text> tags');

        // Multiple patterns for text tags
        const patterns = [
            // Standard text tags with content
            /<text[^>]*>([^<]+)<\/text>/g,
            // Text tags without attributes
            /<text>([^<]+)<\/text>/g,
            // Text tags with timing attributes
            /<text\s+start="[^"]*"[^>]*>([^<]+)<\/text>/g,
            // Self-closing text tags with text attribute
            /<text[^>]*text="([^"]*)"[^>]*\/>/g
        ];

        let allMatches = [];

        for (const pattern of patterns) {
            const matches = [...xmlContent.matchAll(pattern)];
            if (matches.length > 0) {
                this._log('info', `Found ${matches.length} matches with pattern`);
                allMatches = allMatches.concat(matches.map(match => match[1]));
            }
        }

        if (allMatches.length === 0) {
            throw new Error('No text tag matches found');
        }

        return allMatches.map(text => ({ text: this._decodeHtmlEntities(text) }));
    }

    /**
     * Extract text from CDATA sections
     * @param {string} xmlContent - XML content
     * @returns {Array} - Array of text segments
     * @private
     */
    _extractFromCdataSections(xmlContent) {
        this._log('info', 'Attempting extraction from CDATA sections');

        const cdataPattern = /<!\[CDATA\[(.*?)\]\]>/gs;
        const matches = [...xmlContent.matchAll(cdataPattern)];

        if (matches.length === 0) {
            throw new Error('No CDATA sections found');
        }

        this._log('info', `Found ${matches.length} CDATA sections`);

        return matches.map(match => ({
            text: this._decodeHtmlEntities(match[1])
        }));
    }

    /**
     * Extract text from XML attributes
     * @param {string} xmlContent - XML content
     * @returns {Array} - Array of text segments
     * @private
     */
    _extractFromAttributes(xmlContent) {
        this._log('info', 'Attempting extraction from XML attributes');

        // Look for text in various attributes
        const attributePatterns = [
            /text="([^"]+)"/g,
            /content="([^"]+)"/g,
            /caption="([^"]+)"/g,
            /transcript="([^"]+)"/g
        ];

        let allMatches = [];

        for (const pattern of attributePatterns) {
            const matches = [...xmlContent.matchAll(pattern)];
            if (matches.length > 0) {
                this._log('info', `Found ${matches.length} attribute matches`);
                allMatches = allMatches.concat(matches.map(match => match[1]));
            }
        }

        if (allMatches.length === 0) {
            throw new Error('No attribute matches found');
        }

        return allMatches.map(text => ({ text: this._decodeHtmlEntities(text) }));
    }

    /**
     * Extract text from alternative XML formats
     * @param {string} xmlContent - XML content
     * @returns {Array} - Array of text segments
     * @private
     */
    _extractFromAlternativeFormats(xmlContent) {
        this._log('info', 'Attempting extraction from alternative formats');

        // Try different tag names that might contain transcript text
        const alternativeTags = ['p', 'span', 'div', 'caption', 'subtitle', 'transcript'];
        let allMatches = [];

        for (const tag of alternativeTags) {
            const pattern = new RegExp(`<${tag}[^>]*>([^<]+)<\/${tag}>`, 'g');
            const matches = [...xmlContent.matchAll(pattern)];
            
            if (matches.length > 0) {
                this._log('info', `Found ${matches.length} matches in <${tag}> tags`);
                allMatches = allMatches.concat(matches.map(match => match[1]));
            }
        }

        // Try extracting any text content between XML tags
        if (allMatches.length === 0) {
            const textPattern = />([^<]+)</g;
            const matches = [...xmlContent.matchAll(textPattern)];
            
            if (matches.length > 0) {
                this._log('info', `Found ${matches.length} generic text matches`);
                allMatches = matches
                    .map(match => match[1].trim())
                    .filter(text => text.length > 3 && !text.match(/^[\s\n\r]*$/));
            }
        }

        if (allMatches.length === 0) {
            throw new Error('No alternative format matches found');
        }

        return allMatches.map(text => ({ text: this._decodeHtmlEntities(text) }));
    }

    /**
     * Validate and clean transcript segments
     * @param {Array} segments - Raw transcript segments
     * @returns {Array} - Cleaned and validated segments
     * @private
     */
    _validateAndCleanSegments(segments) {
        if (!Array.isArray(segments)) {
            throw new Error('Segments must be an array');
        }

        const cleanedSegments = segments
            .map(segment => {
                if (typeof segment === 'string') {
                    return { text: this._cleanText(segment) };
                } else if (segment && typeof segment.text === 'string') {
                    return { text: this._cleanText(segment.text) };
                }
                return null;
            })
            .filter(segment => segment && segment.text && segment.text.length > 0);

        this._log('info', `Cleaned segments: ${cleanedSegments.length} valid segments`);

        if (cleanedSegments.length === 0) {
            throw new Error('No valid segments after cleaning');
        }

        // Additional validation
        const totalLength = cleanedSegments.reduce((sum, seg) => sum + seg.text.length, 0);
        if (totalLength < 50) {
            throw new Error(`Total transcript too short: ${totalLength} characters`);
        }

        return cleanedSegments;
    }

    /**
     * Decode HTML entities in text
     * @param {string} text - Text with HTML entities
     * @returns {string} - Decoded text
     * @private
     */
    _decodeHtmlEntities(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }

        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#x27;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .replace(/&apos;/g, "'")
            // Numeric entities
            .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
            .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
    }

    /**
     * Clean and normalize text content
     * @param {string} text - Raw text
     * @returns {string} - Cleaned text
     * @private
     */
    _cleanText(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }

        return text
            // Remove HTML tags
            .replace(/<[^>]*>/g, '')
            // Normalize whitespace
            .replace(/\s+/g, ' ')
            // Remove control characters
            .replace(/[\x00-\x1F\x7F]/g, '')
            // Trim
            .trim();
    }

    /**
     * Log messages with processor name
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

module.exports = CaptionXmlProcessor;