/**
 * AlternativePageParsingStrategy - Fallback strategy for YouTube transcript extraction
 * Uses alternative parsing methods when primary strategy fails
 */
const axios = require('axios');
const ExtractionStrategy = require('./ExtractionStrategy');

class AlternativePageParsingStrategy extends ExtractionStrategy {
    constructor() {
        super('alternative-page-parsing', 2);
    }

    /**
     * Execute the alternative page parsing strategy
     * @param {string} videoId - YouTube video ID
     * @returns {Promise<{success: boolean, data: any, error?: string}>}
     */
    async execute(videoId) {
        try {
            this._log('info', `Starting alternative parsing for video ID: ${videoId}`);

            // Try multiple parsing approaches
            const strategies = [
                () => this._tryYtPlayerConfig(videoId),
                () => this._tryAlternativeHeaders(videoId),
                () => this._tryMobileUserAgent(videoId)
            ];

            for (let i = 0; i < strategies.length; i++) {
                try {
                    this._log('info', `Attempting alternative approach ${i + 1}/${strategies.length}`);
                    const result = await strategies[i]();
                    
                    if (result && result.length > 0) {
                        this._log('info', `Alternative approach ${i + 1} succeeded with ${result.length} segments`);
                        return {
                            success: true,
                            data: result
                        };
                    }
                } catch (error) {
                    this._log('warn', `Alternative approach ${i + 1} failed: ${error.message}`);
                }
            }

            return {
                success: false,
                error: 'All alternative parsing approaches failed'
            };

        } catch (error) {
            this._log('error', `Alternative parsing failed: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Try parsing ytplayer.config from YouTube page with enhanced patterns
     * @param {string} videoId - YouTube video ID
     * @returns {Promise<Array>} - Array of transcript segments
     * @private
     */
    async _tryYtPlayerConfig(videoId) {
        this._log('info', 'Attempting ytplayer.config parsing');

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        
        const response = await axios.get(videoUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            timeout: 30000
        });

        const html = response.data;
        this._log('info', `Fetched page for ytplayer.config parsing: ${html.length} characters`);

        // Enhanced patterns for ytplayer.config
        const configPatterns = [
            // Standard patterns
            /ytplayer\.config\s*=\s*({.+?});/s,
            /window\.ytplayer\.config\s*=\s*({.+?});/s,
            /"ytplayer":\s*({.+?})/s,
            
            // Alternative formats
            /ytplayer\s*\.\s*config\s*=\s*({.+?});/s,
            /window\s*\[\s*["']ytplayer["']\s*\]\s*\.\s*config\s*=\s*({.+?});/s,
            /ytplayer\s*:\s*{\s*config\s*:\s*({.+?})/s,
            
            // Minified versions
            /ytplayer\.config=({.+?});/s,
            /ytplayer\.config=({.+?})(?:,|\})/s,
            
            // In script blocks
            /<script[^>]*>.*?ytplayer\.config\s*=\s*({.+?});.*?<\/script>/s
        ];

        for (let i = 0; i < configPatterns.length; i++) {
            const pattern = configPatterns[i];
            const configMatch = html.match(pattern);
            
            if (configMatch && configMatch[1]) {
                this._log('info', `Found ytplayer.config using pattern ${i + 1}`);
                
                try {
                    const configStr = configMatch[1];
                    const config = this._parseJsonSafely(configStr);
                    
                    if (!config) {
                        this._log('warn', `Pattern ${i + 1} matched but JSON parsing failed`);
                        continue;
                    }
                    
                    const args = config?.args;
                    
                    if (args?.player_response) {
                        let playerResponse;
                        
                        if (typeof args.player_response === 'string') {
                            playerResponse = this._parseJsonSafely(args.player_response);
                        } else {
                            playerResponse = args.player_response;
                        }
                        
                        if (!playerResponse) {
                            this._log('warn', 'Failed to parse player_response from ytplayer.config');
                            continue;
                        }
                            
                        const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
                        
                        if (captions && captions.length > 0) {
                            this._log('info', `Found ${captions.length} caption tracks in ytplayer.config`);
                            
                            // Select best caption track
                            const selectedTrack = this._selectBestCaptionTrack(captions);
                            
                            // Fetch and parse captions
                            return await this._fetchAndParseCaptions(selectedTrack);
                        } else {
                            this._log('warn', 'No caption tracks found in ytplayer.config player_response');
                        }
                    } else {
                        this._log('warn', 'No player_response found in ytplayer.config args');
                    }
                } catch (parseError) {
                    this._log('warn', `Error parsing ytplayer.config pattern ${i + 1}: ${parseError.message}`);
                    continue;
                }
            }
        }

        throw new Error('ytplayer.config not found or invalid');
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
                // Remove comments
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*$/gm, '');

            return JSON.parse(cleanJson);
        } catch (error) {
            // Try alternative parsing approaches
            try {
                // Find the main object boundaries
                let braceCount = 0;
                let validEnd = -1;
                
                for (let i = 0; i < jsonStr.length; i++) {
                    if (jsonStr[i] === '{') {
                        braceCount++;
                    } else if (jsonStr[i] === '}') {
                        braceCount--;
                        if (braceCount === 0) {
                            validEnd = i;
                            break;
                        }
                    }
                }
                
                if (validEnd > 0) {
                    const truncatedJson = jsonStr.substring(0, validEnd + 1);
                    return JSON.parse(truncatedJson);
                }
                
                return null;
            } catch (secondError) {
                this._log('warn', `JSON parsing failed: ${error.message}`);
                return null;
            }
        }
    }

    /**
     * Try fetching with alternative headers
     * @param {string} videoId - YouTube video ID
     * @returns {Promise<Array>} - Array of transcript segments
     * @private
     */
    async _tryAlternativeHeaders(videoId) {
        this._log('info', 'Attempting alternative headers approach');

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        
        const response = await axios.get(videoUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 30000
        });

        const html = response.data;
        this._log('info', `Fetched page with alternative headers: ${html.length} characters`);

        // Try to extract player response with different patterns
        const patterns = [
            /ytInitialPlayerResponse\s*=\s*({.+?});/,
            /window\["ytInitialPlayerResponse"\]\s*=\s*({.+?});/,
            /"ytInitialPlayerResponse":({.+?}),"ytInitialData"/
        ];

        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match) {
                try {
                    const playerResponse = JSON.parse(match[1]);
                    const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
                    
                    if (captions && captions.length > 0) {
                        this._log('info', `Found ${captions.length} caption tracks with alternative headers`);
                        
                        const selectedTrack = this._selectBestCaptionTrack(captions);
                        return await this._fetchAndParseCaptions(selectedTrack);
                    }
                } catch (parseError) {
                    this._log('warn', `Error parsing with alternative headers: ${parseError.message}`);
                }
            }
        }

        throw new Error('No valid player response found with alternative headers');
    }

    /**
     * Try fetching with mobile user agent
     * @param {string} videoId - YouTube video ID
     * @returns {Promise<Array>} - Array of transcript segments
     * @private
     */
    async _tryMobileUserAgent(videoId) {
        this._log('info', 'Attempting mobile user agent approach');

        const videoUrl = `https://m.youtube.com/watch?v=${videoId}`;
        
        const response = await axios.get(videoUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            timeout: 30000
        });

        const html = response.data;
        this._log('info', `Fetched mobile page: ${html.length} characters`);

        // Mobile pages might have different structure
        const mobilePatterns = [
            /ytInitialPlayerResponse\s*=\s*({.+?});/,
            /"playerResponse":"({.+?})"/,
            /player_response['"]\s*:\s*['"](.*?)['"]/
        ];

        for (const pattern of mobilePatterns) {
            const match = html.match(pattern);
            if (match) {
                try {
                    let playerResponseStr = match[1];
                    
                    // Handle escaped JSON
                    if (playerResponseStr.includes('\\"')) {
                        playerResponseStr = playerResponseStr.replace(/\\"/g, '"');
                    }
                    
                    const playerResponse = JSON.parse(playerResponseStr);
                    const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
                    
                    if (captions && captions.length > 0) {
                        this._log('info', `Found ${captions.length} caption tracks on mobile page`);
                        
                        const selectedTrack = this._selectBestCaptionTrack(captions);
                        return await this._fetchAndParseCaptions(selectedTrack);
                    }
                } catch (parseError) {
                    this._log('warn', `Error parsing mobile response: ${parseError.message}`);
                }
            }
        }

        throw new Error('No valid player response found on mobile page');
    }

    /**
     * Select the best caption track (prioritize English)
     * @param {Array} captionTracks - Array of available caption tracks
     * @returns {Object} - Selected caption track
     * @private
     */
    _selectBestCaptionTrack(captionTracks) {
        // Priority order for language selection
        const languagePriority = ['en', 'en-US', 'en-GB', 'en-CA', 'en-AU'];

        // First, try to find exact language matches
        for (const lang of languagePriority) {
            const track = captionTracks.find(track => track.languageCode === lang);
            if (track) {
                this._log('info', `Selected exact language match: ${lang}`);
                return track;
            }
        }

        // Then try to find tracks that start with 'en'
        const englishTrack = captionTracks.find(track => 
            track.languageCode && track.languageCode.startsWith('en')
        );
        if (englishTrack) {
            this._log('info', `Selected English variant: ${englishTrack.languageCode}`);
            return englishTrack;
        }

        // Finally, use the first available track
        this._log('info', `No English track found, using first available: ${captionTracks[0].languageCode}`);
        return captionTracks[0];
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

module.exports = AlternativePageParsingStrategy;