/**
 * YouTubePageScrapingStrategy - Primary strategy for extracting transcripts
 * Scrapes YouTube video pages to find ytInitialPlayerResponse and extract captions
 */
const axios = require('axios');
const ExtractionStrategy = require('./ExtractionStrategy');

class YouTubePageScrapingStrategy extends ExtractionStrategy {
    constructor() {
        super('youtube-page-scraping', 1);
    }

    /**
     * Execute the YouTube page scraping strategy
     * @param {string} videoId - YouTube video ID
     * @returns {Promise<{success: boolean, data: any, error?: string}>}
     */
    async execute(videoId) {
        try {
            this._log('info', `Starting page scraping for video ID: ${videoId}`);

            // Fetch YouTube video page
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            this._log('info', `Fetching YouTube page: ${videoUrl}`);

            const response = await axios.get(videoUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                timeout: 30000
            });

            const html = response.data;
            this._log('info', `Page fetched successfully, size: ${html.length} characters`);

            // Extract ytInitialPlayerResponse
            const playerResponse = this._extractPlayerResponse(html);
            if (!playerResponse) {
                return {
                    success: false,
                    error: 'ytInitialPlayerResponse not found in page HTML'
                };
            }

            // Extract caption tracks
            const captionTracks = this._extractCaptionTracks(playerResponse);
            if (!captionTracks || captionTracks.length === 0) {
                return {
                    success: false,
                    error: 'No caption tracks found in player response'
                };
            }

            this._log('info', `Found ${captionTracks.length} caption tracks`);

            // Select best caption track (prioritize English)
            const selectedTrack = this._selectBestCaptionTrack(captionTracks);
            this._log('info', `Selected caption track: ${selectedTrack.name?.simpleText || selectedTrack.languageCode}`);

            // Fetch and parse caption XML
            const transcriptSegments = await this._fetchAndParseCaptions(selectedTrack);

            this._log('info', `Successfully extracted ${transcriptSegments.length} transcript segments`);
            
            return {
                success: true,
                data: transcriptSegments
            };

        } catch (error) {
            this._log('error', `Page scraping failed: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Extract ytInitialPlayerResponse from HTML using multiple robust patterns
     * @param {string} html - YouTube page HTML
     * @returns {Object|null} - Parsed player response or null
     * @private
     */
    _extractPlayerResponse(html) {
        try {
            // Enhanced regex patterns for ytInitialPlayerResponse extraction
            const patterns = [
                // Standard variable declaration
                /var ytInitialPlayerResponse = ({.+?});/s,
                // Window property assignment
                /window\["ytInitialPlayerResponse"\] = ({.+?});/s,
                // Direct assignment
                /ytInitialPlayerResponse = ({.+?});/s,
                // With whitespace variations
                /var\s+ytInitialPlayerResponse\s*=\s*({.+?});/s,
                /window\s*\[\s*["']ytInitialPlayerResponse["']\s*\]\s*=\s*({.+?});/s,
                // In script tags
                /<script[^>]*>.*?var ytInitialPlayerResponse = ({.+?});.*?<\/script>/s,
                // JSON-like structure
                /"ytInitialPlayerResponse"\s*:\s*({.+?})(?:,|\})/s,
                // Alternative formats
                /ytInitialPlayerResponse\s*=\s*({.+?})(?:;|\n)/s,
                // Minified versions
                /ytInitialPlayerResponse=({.+?});/s
            ];

            for (let i = 0; i < patterns.length; i++) {
                const pattern = patterns[i];
                const match = html.match(pattern);
                
                if (match && match[1]) {
                    this._log('info', `Found ytInitialPlayerResponse using pattern ${i + 1}`);
                    
                    try {
                        // Attempt to parse the JSON with error handling
                        const jsonStr = match[1];
                        const playerResponse = this._parseJsonSafely(jsonStr);
                        
                        if (playerResponse && typeof playerResponse === 'object') {
                            this._log('info', 'Successfully parsed ytInitialPlayerResponse');
                            return playerResponse;
                        }
                    } catch (parseError) {
                        this._log('warn', `Pattern ${i + 1} matched but JSON parsing failed: ${parseError.message}`);
                        continue;
                    }
                }
            }

            this._log('warn', 'ytInitialPlayerResponse not found with any pattern');
            return null;

        } catch (error) {
            this._log('error', `Error extracting ytInitialPlayerResponse: ${error.message}`);
            return null;
        }
    }

    /**
     * Safely parse JSON with error handling and cleanup
     * @param {string} jsonStr - JSON string to parse
     * @returns {Object|null} - Parsed object or null
     * @private
     */
    _parseJsonSafely(jsonStr) {
        try {
            // Clean up common JSON issues
            let cleanJson = jsonStr
                // Remove trailing commas
                .replace(/,(\s*[}\]])/g, '$1')
                // Fix unescaped quotes in strings (basic attempt)
                .replace(/([^\\])"/g, '$1\\"')
                // Remove comments
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*$/gm, '');

            return JSON.parse(cleanJson);
        } catch (error) {
            // Try alternative parsing approaches
            try {
                // Remove everything after the last valid closing brace
                const braceCount = (jsonStr.match(/{/g) || []).length;
                const closeBraceCount = (jsonStr.match(/}/g) || []).length;
                
                if (braceCount > closeBraceCount) {
                    // Add missing closing braces
                    const missing = braceCount - closeBraceCount;
                    jsonStr += '}'.repeat(missing);
                }
                
                return JSON.parse(jsonStr);
            } catch (secondError) {
                this._log('warn', `JSON parsing failed: ${error.message}`);
                return null;
            }
        }
    }

    /**
     * Extract caption tracks from player response
     * @param {Object} playerResponse - YouTube player response object
     * @returns {Array|null} - Array of caption tracks or null
     * @private
     */
    _extractCaptionTracks(playerResponse) {
        try {
            const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            
            if (!captions || !Array.isArray(captions)) {
                this._log('warn', 'No caption tracks found in player response structure');
                return null;
            }

            // Log available caption tracks
            captions.forEach((track, index) => {
                this._log('info', `Caption track ${index}: ${track.name?.simpleText || 'Unknown'} (${track.languageCode})`);
            });

            return captions;

        } catch (error) {
            this._log('error', `Error extracting caption tracks: ${error.message}`);
            return null;
        }
    }

    /**
     * Select the best caption track with comprehensive language prioritization
     * @param {Array} captionTracks - Array of available caption tracks
     * @returns {Object} - Selected caption track
     * @private
     */
    _selectBestCaptionTrack(captionTracks) {
        if (!captionTracks || captionTracks.length === 0) {
            throw new Error('No caption tracks provided');
        }

        // Enhanced language priority with manual vs auto-generated preference
        const languagePriority = [
            // Manual English captions (highest priority)
            { code: 'en', manual: true },
            { code: 'en-US', manual: true },
            { code: 'en-GB', manual: true },
            { code: 'en-CA', manual: true },
            { code: 'en-AU', manual: true },
            
            // Auto-generated English captions (medium priority)
            { code: 'en', manual: false },
            { code: 'en-US', manual: false },
            { code: 'en-GB', manual: false },
            { code: 'en-CA', manual: false },
            { code: 'en-AU', manual: false }
        ];

        // Analyze available tracks
        const trackAnalysis = captionTracks.map(track => ({
            track,
            isManual: !track.kind || track.kind !== 'asr',
            isEnglish: track.languageCode && track.languageCode.toLowerCase().startsWith('en'),
            languageCode: track.languageCode,
            name: track.name?.simpleText || track.name?.runs?.[0]?.text || 'Unknown'
        }));

        this._log('info', `Analyzing ${trackAnalysis.length} caption tracks:`);
        trackAnalysis.forEach((analysis, index) => {
            this._log('info', `  ${index}: ${analysis.name} (${analysis.languageCode}) - ${analysis.isManual ? 'Manual' : 'Auto-generated'}`);
        });

        // Try to find tracks matching priority order
        for (const priority of languagePriority) {
            const matchingTrack = trackAnalysis.find(analysis => 
                analysis.languageCode === priority.code && 
                analysis.isManual === priority.manual
            );
            
            if (matchingTrack) {
                this._log('info', `Selected priority match: ${matchingTrack.name} (${priority.code}, ${priority.manual ? 'manual' : 'auto-generated'})`);
                return matchingTrack.track;
            }
        }

        // Fallback: any English track (manual preferred)
        const englishTracks = trackAnalysis.filter(analysis => analysis.isEnglish);
        if (englishTracks.length > 0) {
            // Sort by manual first, then by language code
            englishTracks.sort((a, b) => {
                if (a.isManual !== b.isManual) {
                    return b.isManual ? 1 : -1; // Manual tracks first
                }
                return a.languageCode.localeCompare(b.languageCode);
            });
            
            const selectedTrack = englishTracks[0];
            this._log('info', `Selected English fallback: ${selectedTrack.name} (${selectedTrack.languageCode})`);
            return selectedTrack.track;
        }

        // Last resort: first available track
        const firstTrack = trackAnalysis[0];
        this._log('info', `No English tracks found, using first available: ${firstTrack.name} (${firstTrack.languageCode})`);
        return firstTrack.track;
    }

    /**
     * Fetch and parse caption XML from YouTube using comprehensive XML processor
     * @param {Object} captionTrack - Selected caption track
     * @returns {Promise<Array>} - Array of transcript segments
     * @private
     */
    async _fetchAndParseCaptions(captionTrack) {
        try {
            const captionUrl = captionTrack.baseUrl;
            this._log('info', `Fetching captions from: ${captionUrl}`);

            const captionResponse = await axios.get(captionUrl, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            });

            const captionXml = captionResponse.data;
            this._log('info', `Caption XML fetched, size: ${captionXml.length} characters`);

            // Debug: Log response details
            if (captionXml.length > 0) {
                this._log('info', `Caption XML preview: ${captionXml.substring(0, 500)}`);
            } else {
                this._log('warn', `Empty caption response. Status: ${captionResponse.status}`);
                this._log('warn', `Response headers: ${JSON.stringify(captionResponse.headers)}`);
                throw new Error('Empty caption XML response from YouTube');
            }

            // Use comprehensive XML processor
            const CaptionXmlProcessor = require('./CaptionXmlProcessor');
            const xmlProcessor = new CaptionXmlProcessor();
            
            const transcriptSegments = xmlProcessor.processXml(captionXml);
            
            this._log('info', `XML processor extracted ${transcriptSegments.length} segments`);
            
            if (transcriptSegments.length > 0) {
                this._log('info', `Sample segment: "${transcriptSegments[0].text.substring(0, 100)}..."`);
            }

            return transcriptSegments;

        } catch (error) {
            this._log('error', `Error fetching/parsing captions: ${error.message}`);
            throw error;
        }
    }
}

module.exports = YouTubePageScrapingStrategy;