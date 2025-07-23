/**
 * Content Extractor service for SAWRON
 * Handles extraction of content from various sources
 */
const axios = require('axios');
const cheerio = require('cheerio');
const YoutubeTranscript = require('youtube-transcript');

// YouTube Transcript Library loaded successfully
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs').promises;
const path = require('path');

class ContentExtractor {
    /**
     * Extract content from a URL
     * @param {string} url - The URL to extract content from
     * @returns {Promise<{text: string, title: string, contentType: string, extractionMethod: string, fallbackUsed: boolean}>} - The extracted content and metadata
     */
    async extractFromUrl(url) {
        console.log(`Starting content extraction from URL: ${url}`);
        const startTime = Date.now();

        try {
            // Check if it's a YouTube URL
            if (this.isYoutubeUrl(url)) {
                console.log(`Detected YouTube URL (${this.classifyYoutubeUrl(url)}), extracting content...`);
                const result = await this.extractFromYoutube(url);

                const duration = (Date.now() - startTime) / 1000;
                console.log(`YouTube processing completed in ${duration.toFixed(2)}s`);
                console.log(`Final result - Method: ${result.extractionMethod}, Content length: ${result.text.length} characters, Fallback used: ${result.fallbackUsed}`);

                return result;
            }

            // Otherwise, treat as a regular web page
            console.log(`Processing as regular web page...`);
            return await this.extractFromWebpage(url, startTime);

        } catch (error) {
            console.error(`Unexpected error during URL extraction: ${error.message}`, error);

            const duration = (Date.now() - startTime) / 1000;

            // Return fallback content instead of throwing
            return {
                text: `An unexpected error occurred while processing the URL "${url}": ${error.message}. This could be due to network issues, the website being unavailable, or the site blocking automated access.`,
                title: `Error: ${url}`,
                contentType: 'webpage',
                extractionMethod: 'error-fallback',
                fallbackUsed: true,
                metadata: {
                    url: url,
                    processingTime: duration,
                    error: error.message
                }
            };
        }
    }

    /**
     * Extract content from a regular webpage
     * @param {string} url - The webpage URL
     * @param {number} startTime - Processing start time
     * @returns {Promise<{text: string, title: string, contentType: string, extractionMethod: string, fallbackUsed: boolean}>} - Extraction result
     */
    async extractFromWebpage(url, startTime) {
        try {
            console.log(`Fetching web page content from: ${url}`);

            // Create a promise with timeout
            const fetchWithTimeout = async (url, options, timeout = 30000) => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                try {
                    const response = await axios.get(url, {
                        ...options,
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                    return response;
                } catch (error) {
                    clearTimeout(timeoutId);
                    throw error;
                }
            };

            let response;
            try {
                // First attempt with standard headers
                console.log(`Attempting to fetch with standard browser headers...`);
                response = await fetchWithTimeout(url, {
                    timeout: 30000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1',
                        'Cache-Control': 'max-age=0'
                    }
                });

                console.log(`Web page fetched successfully (${response.data.length} bytes)`);
            } catch (fetchError) {
                console.warn(`Standard fetch failed: ${fetchError.message}, trying mobile user agent...`);

                try {
                    response = await fetchWithTimeout(url, {
                        timeout: 30000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.5'
                        }
                    });

                    console.log(`Web page fetched with mobile user agent (${response.data.length} bytes)`);
                } catch (secondError) {
                    console.error(`All fetch attempts failed: ${secondError.message}`);
                    throw new Error(`Could not access website: ${fetchError.message}`);
                }
            }

            const $ = cheerio.load(response.data);

            // Extract title
            const title = $('title').text() || url;
            console.log(`Page title: "${title}"`);

            // Remove unwanted elements
            console.log(`Cleaning page content...`);
            $('script, style, nav, footer, header, aside, .ads, .comments, .sidebar').remove();

            // Extract main content
            let content = '';
            let extractionMethod = 'body-content';

            // Try to find main content container
            const mainSelectors = ['main', 'article', '.content', '.post', '.entry', '#content', '.main'];
            let mainContent = null;

            for (const selector of mainSelectors) {
                if ($(selector).length) {
                    console.log(`Found main content using selector: ${selector}`);
                    mainContent = $(selector);
                    extractionMethod = `main-content-${selector}`;
                    break;
                }
            }

            if (mainContent) {
                content = mainContent.text();
            } else {
                console.log(`No main content container found, using body content`);
                content = $('body').text();
            }

            // Clean up the text
            content = this.cleanText(content);

            // Check if content is too short
            if (!content || content.length < 100) {
                console.warn(`Extracted content is too short (${content.length} chars), trying meta description fallback`);

                const metaDescription = $('meta[name="description"]').attr('content') ||
                    $('meta[property="og:description"]').attr('content');

                if (metaDescription && metaDescription.length > 50) {
                    content = `${metaDescription}\n\nNote: Full content could not be extracted from this page.`;
                    extractionMethod = 'meta-description-fallback';
                } else {
                    content = `This page at ${url} with title "${title}" appears to have limited textual content that could be extracted. It might be a primarily visual page, a login page, or have content loaded dynamically via JavaScript.`;
                    extractionMethod = 'minimal-content-fallback';
                }
            }

            const duration = (Date.now() - startTime) / 1000;
            console.log(`Web page extraction completed in ${duration.toFixed(2)}s`);
            console.log(`Final result - Method: ${extractionMethod}, Content length: ${content.length} characters`);

            return {
                text: content,
                title: title,
                contentType: 'webpage',
                extractionMethod: extractionMethod,
                fallbackUsed: extractionMethod.includes('fallback'),
                metadata: {
                    url: url,
                    processingTime: duration
                }
            };

        } catch (error) {
            console.error(`Error extracting webpage content: ${error.message}`);

            const duration = (Date.now() - startTime) / 1000;

            // Return fallback content
            return {
                text: `Unable to access the content at ${url}. Error: ${error.message}. This could be due to network issues, the website being unavailable, or the site blocking automated access. The URL appears to be for a web page that might contain relevant information, but it couldn't be retrieved at this time.`,
                title: `Inaccessible Content: ${url}`,
                contentType: 'webpage',
                extractionMethod: 'access-error-fallback',
                fallbackUsed: true,
                metadata: {
                    url: url,
                    processingTime: duration,
                    error: error.message
                }
            };
        }
    }

    /**
     * Extract content from a YouTube video
     * @param {string} url - The YouTube URL
     * @returns {Promise<{text: string, title: string, contentType: string, extractionMethod: string, fallbackUsed: boolean}>} - The extracted transcript and metadata
     */
    async extractFromYoutube(url) {
        console.log(`Extracting transcript from YouTube URL: ${url}`);
        const startTime = Date.now();

        const videoId = this.extractYoutubeId(url);
        if (!videoId) {
            return {
                text: `Unable to extract video ID from YouTube URL: ${url}. Please check if the URL is valid.`,
                title: 'Invalid YouTube URL',
                contentType: 'youtube-video',
                extractionMethod: 'error',
                fallbackUsed: true
            };
        }

        console.log(`Extracted video ID: ${videoId}`);

        // Get enhanced video metadata
        const metadata = await this.extractYoutubeMetadata(videoId);

        // Try multiple transcript extraction strategies
        const transcriptResult = await this.tryMultipleTranscriptMethods(videoId);

        const duration = (Date.now() - startTime) / 1000;
        console.log(`YouTube processing completed in ${duration.toFixed(2)}s`);

        return {
            text: transcriptResult.text,
            title: metadata.title,
            contentType: 'youtube-video',
            extractionMethod: transcriptResult.method,
            fallbackUsed: transcriptResult.fallbackUsed,
            metadata: {
                videoId: videoId,
                channelName: metadata.channelName,
                description: metadata.description,
                duration: duration
            }
        };
    }

    /**
     * Try multiple methods to extract YouTube transcript
     * @param {string} videoId - The YouTube video ID
     * @returns {Promise<{text: string, method: string, fallbackUsed: boolean}>} - Extraction result
     */
    async tryMultipleTranscriptMethods(videoId) {
        console.log(`Starting transcript extraction for video ID: ${videoId}`);

        // The library exports YoutubeTranscript as a property of the module
        const YTTranscript = YoutubeTranscript.YoutubeTranscript;

        // The logs show the library finds transcripts in 'en' but our calls return empty arrays
        // This suggests the API might be different than expected. Let's try the correct approach.
        const strategies = [
            {
                name: 'correct-api-call',
                execute: async () => {
                    console.log(`Attempting correct API call for ${videoId}...`);
                    
                    // Based on youtube-transcript v1.2.1 documentation, the correct usage is:
                    // YoutubeTranscript.fetchTranscript(videoId, config)
                    if (!YTTranscript || typeof YTTranscript.fetchTranscript !== 'function') {
                        throw new Error('YTTranscript.fetchTranscript method not available');
                    }
                    
                    // Try without any language specification first
                    console.log('Calling YTTranscript.fetchTranscript with just videoId...');
                    const result = await YTTranscript.fetchTranscript(videoId);
                    
                    console.log(`API call result:`, {
                        type: typeof result,
                        isArray: Array.isArray(result),
                        length: Array.isArray(result) ? result.length : 'N/A',
                        firstItem: Array.isArray(result) && result.length > 0 ? result[0] : null
                    });
                    
                    return result;
                }
            },
            {
                name: 'with-language-config',
                execute: async () => {
                    console.log(`Attempting with language configuration...`);
                    
                    if (!YTTranscript || typeof YTTranscript.fetchTranscript !== 'function') {
                        throw new Error('YTTranscript.fetchTranscript method not available');
                    }
                    
                    // Try with language configuration object
                    console.log('Calling with language config...');
                    const result = await YTTranscript.fetchTranscript(videoId, { lang: 'en' });
                    
                    console.log(`Language config result:`, {
                        type: typeof result,
                        isArray: Array.isArray(result),
                        length: Array.isArray(result) ? result.length : 'N/A',
                        firstItem: Array.isArray(result) && result.length > 0 ? result[0] : null
                    });
                    
                    return result;
                }
            },
            {
                name: 'try-different-video',
                execute: async () => {
                    console.log(`Testing with a known working video to verify library function...`);
                    
                    if (!YTTranscript || typeof YTTranscript.fetchTranscript !== 'function') {
                        throw new Error('YTTranscript.fetchTranscript method not available');
                    }
                    
                    // Test with a known video that should have transcripts
                    const testVideoId = 'dQw4w9WgXcQ'; // Rick Roll - known to have captions
                    console.log(`Testing with known video: ${testVideoId}`);
                    
                    try {
                        const testResult = await YTTranscript.fetchTranscript(testVideoId);
                        console.log(`Test video result:`, {
                            type: typeof testResult,
                            isArray: Array.isArray(testResult),
                            length: Array.isArray(testResult) ? testResult.length : 'N/A'
                        });
                        
                        if (Array.isArray(testResult) && testResult.length > 0) {
                            console.log('✅ Library is working with test video, trying original video again...');
                            // Library works, try original video again
                            const originalResult = await YTTranscript.fetchTranscript(videoId);
                            return originalResult;
                        } else {
                            throw new Error('Test video also returned empty result - library issue');
                        }
                    } catch (testError) {
                        console.log(`Test video failed: ${testError.message}`);
                        throw new Error(`Library test failed: ${testError.message}`);
                    }
                }
            },
            {
                name: 'manual-language-detection',
                execute: async () => {
                    console.log(`Attempting manual language detection approach...`);
                    
                    if (!YTTranscript || typeof YTTranscript.fetchTranscript !== 'function') {
                        throw new Error('YTTranscript.fetchTranscript method not available');
                    }
                    
                    // The error messages show available languages, let's try to parse that
                    const languagesToTry = ['en', 'en-US', 'en-GB', 'auto'];
                    
                    for (const lang of languagesToTry) {
                        try {
                            console.log(`Trying language: ${lang}`);
                            const result = await YTTranscript.fetchTranscript(videoId, { lang });
                            
                            if (Array.isArray(result) && result.length > 0) {
                                console.log(`✅ Success with language ${lang}: ${result.length} items`);
                                return result;
                            } else {
                                console.log(`Language ${lang} returned empty result`);
                            }
                        } catch (langError) {
                            console.log(`Language ${lang} failed: ${langError.message}`);
                            
                            // Parse the error message to find available languages
                            if (langError.message.includes('Available languages:')) {
                                const availableMatch = langError.message.match(/Available languages: (.+)/);
                                if (availableMatch) {
                                    const availableLanguages = availableMatch[1].split(',').map(l => l.trim());
                                    console.log(`Found available languages: ${availableLanguages.join(', ')}`);
                                    
                                    // Try the first available language
                                    if (availableLanguages.length > 0) {
                                        try {
                                            const availableLang = availableLanguages[0];
                                            console.log(`Trying detected available language: ${availableLang}`);
                                            const result = await YTTranscript.fetchTranscript(videoId, { lang: availableLang });
                                            
                                            if (Array.isArray(result) && result.length > 0) {
                                                console.log(`✅ Success with detected language ${availableLang}: ${result.length} items`);
                                                return result;
                                            }
                                        } catch (detectedError) {
                                            console.log(`Detected language failed: ${detectedError.message}`);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    throw new Error('No working language found');
                }
            }
        ];

        // Try each strategy
        for (const strategy of strategies) {
            try {
                console.log(`Trying strategy: ${strategy.name}`);
                const result = await strategy.execute();

                console.log(`Strategy ${strategy.name} result type:`, typeof result);
                console.log(`Strategy ${strategy.name} is array:`, Array.isArray(result));
                console.log(`Strategy ${strategy.name} length:`, Array.isArray(result) ? result.length : 'N/A');

                // Handle different result types more robustly
                if (Array.isArray(result)) {
                    console.log(`Result is array with ${result.length} items`);

                    if (result.length > 0) {
                        console.log(`First item structure:`, JSON.stringify(result[0], null, 2));
                        console.log(`Sample items:`, result.slice(0, 3).map(item => JSON.stringify(item)));

                        // Try to extract text from the transcript items with more robust handling
                        const transcript = result
                            .map(item => {
                                // Handle different possible structures
                                if (typeof item === 'string') {
                                    return item.trim();
                                }
                                if (typeof item === 'object' && item !== null) {
                                    // Try common property names
                                    const textProps = ['text', 'snippet', 'content', 'transcript', 'caption', 'subtitle'];
                                    for (const prop of textProps) {
                                        if (item[prop] && typeof item[prop] === 'string') {
                                            return item[prop].trim();
                                        }
                                    }
                                    
                                    // If it's an object with unknown structure, try to stringify and extract meaningful content
                                    const itemStr = JSON.stringify(item);
                                    if (itemStr.length > 10 && itemStr !== '{}') {
                                        return itemStr;
                                    }
                                }
                                
                                // Last resort - convert to string
                                const str = String(item).trim();
                                return str.length > 0 ? str : null;
                            })
                            .filter(text => text && text.length > 0)
                            .join(' ')
                            .trim();

                        if (transcript && transcript.length > 10) {
                            console.log(`✅ Transcript extracted successfully using ${strategy.name}: ${transcript.length} characters`);
                            console.log(`Preview: ${transcript.substring(0, 200)}...`);
                            return {
                                text: transcript,
                                method: strategy.name,
                                fallbackUsed: false
                            };
                        } else {
                            console.warn(`⚠️ Strategy ${strategy.name} returned insufficient content: ${transcript?.length || 0} chars`);
                            console.warn(`Raw items sample:`, result.slice(0, 3));
                            
                            // Even if we got little content, let's not completely discard it
                            if (transcript && transcript.length > 0) {
                                console.log(`Keeping minimal content: "${transcript}"`);
                                return {
                                    text: transcript,
                                    method: strategy.name + '-minimal',
                                    fallbackUsed: false
                                };
                            }
                        }
                    } else {
                        console.warn(`⚠️ Strategy ${strategy.name} returned empty array`);
                    }
                } else if (typeof result === 'string') {
                    const cleanResult = result.trim();
                    if (cleanResult.length > 0) {
                        console.log(`✅ Transcript extracted as string using ${strategy.name}: ${cleanResult.length} characters`);
                        return {
                            text: cleanResult,
                            method: strategy.name,
                            fallbackUsed: false
                        };
                    } else {
                        console.warn(`⚠️ Strategy ${strategy.name} returned empty string`);
                    }
                } else if (result && typeof result === 'object') {
                    console.log(`Strategy ${strategy.name} returned object:`, JSON.stringify(result, null, 2));
                    
                    // Maybe the result is wrapped in an object
                    const possibleArrayProps = ['transcripts', 'captions', 'items', 'data', 'results'];
                    for (const prop of possibleArrayProps) {
                        if (Array.isArray(result[prop]) && result[prop].length > 0) {
                            console.log(`Found array in property '${prop}', retrying with that data...`);
                            // Recursively process the found array
                            const nestedResult = { ...result, [prop]: result[prop] };
                            return await this.processTranscriptResult(nestedResult[prop], strategy.name + '-nested');
                        }
                    }
                    
                    console.warn(`⚠️ Strategy ${strategy.name} returned object but no usable array found`);
                } else {
                    console.warn(`⚠️ Strategy ${strategy.name} returned unexpected format:`, typeof result, result);
                }
            } catch (error) {
                console.error(`❌ Strategy ${strategy.name} failed:`, error.message);
            }
        }

        // If all strategies fail, create fallback content
        console.log(`❌ All transcript extraction strategies failed, creating fallback content`);
        return await this.createYoutubeFallbackContent(videoId);
    }

    /**
     * Helper method to process transcript results consistently
     * @param {Array} result - The transcript array result
     * @param {string} methodName - The method name for logging
     * @returns {Object} - Processed transcript result
     */
    async processTranscriptResult(result, methodName) {
        if (!Array.isArray(result) || result.length === 0) {
            throw new Error('Invalid or empty transcript result');
        }

        console.log(`Processing ${result.length} transcript items with method ${methodName}`);
        console.log(`First item:`, JSON.stringify(result[0], null, 2));

        const transcript = result
            .map(item => {
                if (typeof item === 'string') {
                    return item.trim();
                }
                if (typeof item === 'object' && item !== null) {
                    const textProps = ['text', 'snippet', 'content', 'transcript', 'caption', 'subtitle'];
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

        if (transcript && transcript.length > 10) {
            console.log(`✅ Successfully processed transcript: ${transcript.length} characters`);
            return {
                text: transcript,
                method: methodName,
                fallbackUsed: false
            };
        } else {
            throw new Error(`Processed transcript too short: ${transcript?.length || 0} characters`);
        }
    }

    /**
     * Extract enhanced YouTube metadata
     * @param {string} videoId - The YouTube video ID
     * @returns {Promise<{title: string, channelName: string, description: string}>} - Video metadata
     */
    async extractYoutubeMetadata(videoId) {
        console.log(`Fetching enhanced video metadata for ${videoId}...`);

        let title = 'YouTube Video';
        let channelName = '';
        let description = '';

        try {
            // Get basic metadata from oEmbed
            const oembedResponse = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
                timeout: 10000
            });

            title = oembedResponse.data.title || 'YouTube Video';
            channelName = oembedResponse.data.author_name || '';

            console.log(`Basic metadata: "${title}" by ${channelName}`);
        } catch (oembedError) {
            console.warn(`Could not fetch oEmbed metadata: ${oembedError.message}`);
        }

        try {
            // Try to get additional metadata from the video page
            const videoPageResponse = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            // Extract description from meta tags
            const descriptionMatch = videoPageResponse.data.match(/<meta name="description" content="([^"]+)"/);
            if (descriptionMatch && descriptionMatch[1]) {
                description = descriptionMatch[1];
                console.log(`Found video description: ${description.substring(0, 100)}...`);
            }

            // Try to extract title from page if oEmbed failed
            if (title === 'YouTube Video') {
                const titleMatch = videoPageResponse.data.match(/<title>([^<]+)<\/title>/);
                if (titleMatch && titleMatch[1]) {
                    title = titleMatch[1].replace(' - YouTube', '');
                }
            }
        } catch (pageError) {
            console.warn(`Could not fetch video page metadata: ${pageError.message}`);
        }

        return { title, channelName, description };
    }

    /**
     * Create fallback content for YouTube videos when transcript extraction fails
     * @param {string} videoId - The YouTube video ID
     * @returns {Promise<{text: string, method: string, fallbackUsed: boolean}>} - Fallback content
     */
    async createYoutubeFallbackContent(videoId) {
        const metadata = await this.extractYoutubeMetadata(videoId);

        let fallbackText = `This is a YouTube video titled "${metadata.title}"`;

        if (metadata.channelName) {
            fallbackText += ` by ${metadata.channelName}`;
        }

        fallbackText += `. No transcript is available for this video.`;

        if (metadata.description) {
            fallbackText += ` The video description is: ${metadata.description}`;
        }

        fallbackText += ` The video ID is ${videoId} and can be viewed at https://www.youtube.com/watch?v=${videoId}.`;
        fallbackText += ` This video may not have captions enabled, the captions may be in a language that couldn't be automatically detected, or the video may be restricted.`;

        return {
            text: fallbackText,
            method: 'metadata-fallback',
            fallbackUsed: true
        };
    }

    /**
     * Extract content from a file
     * @param {Object} file - The file object
     * @returns {Promise<{text: string, title: string, contentType: string, extractionMethod: string, fallbackUsed: boolean}>} - The extracted content and metadata
     */
    async extractFromFile(file) {
        console.log(`Starting content extraction from file: ${file.originalname}`);
        const startTime = Date.now();

        const filePath = file.path;
        const fileName = file.originalname || path.basename(filePath);
        const fileExt = path.extname(fileName).toLowerCase();

        console.log(`File details - Name: ${fileName}, Type: ${fileExt}, Size: ${file.size} bytes, Path: ${filePath}`);

        let extractionResult = {
            text: '',
            method: 'unknown',
            fallbackUsed: false
        };

        try {
            switch (fileExt) {
                case '.pdf':
                    console.log(`Processing PDF file...`);
                    try {
                        const pdfData = await fs.readFile(filePath);
                        console.log(`PDF file read successfully (${pdfData.length} bytes), attempting extraction...`);

                        extractionResult = await this.tryMultiplePdfMethods(filePath, pdfData);
                        console.log(`PDF extraction completed using method: ${extractionResult.method}`);
                    } catch (pdfError) {
                        console.error(`PDF processing failed: ${pdfError.message}`);
                        extractionResult = await this.createPdfFallbackContent(filePath, null);
                    }
                    break;

                case '.docx':
                    console.log(`Processing DOCX file...`);
                    try {
                        const docxResult = await mammoth.extractRawText({ path: filePath });
                        extractionResult.text = docxResult.value;
                        extractionResult.method = 'mammoth-docx';
                        console.log(`DOCX parsed successfully: ${extractionResult.text.length} characters`);
                    } catch (docxError) {
                        console.error(`DOCX processing failed: ${docxError.message}`);
                        extractionResult = {
                            text: `This DOCX document "${fileName}" (${(file.size / 1024 / 1024).toFixed(2)} MB) could not be processed. Error: ${docxError.message}. The file may be corrupted or in an unsupported format.`,
                            method: 'docx-fallback',
                            fallbackUsed: true
                        };
                    }
                    break;

                case '.txt':
                    console.log(`Processing TXT file...`);
                    try {
                        extractionResult.text = await fs.readFile(filePath, 'utf8');
                        extractionResult.method = 'direct-text-read';
                        console.log(`TXT file read successfully: ${extractionResult.text.length} characters`);
                    } catch (txtError) {
                        console.error(`TXT processing failed: ${txtError.message}`);
                        extractionResult = {
                            text: `This text file "${fileName}" could not be read. Error: ${txtError.message}. The file may be corrupted or have encoding issues.`,
                            method: 'txt-fallback',
                            fallbackUsed: true
                        };
                    }
                    break;

                default:
                    console.warn(`Unsupported file type: ${fileExt}`);
                    extractionResult = {
                        text: `This file "${fileName}" has an unsupported file type (${fileExt}). Supported formats are: PDF (.pdf), Word documents (.docx), and text files (.txt). The file is ${(file.size / 1024 / 1024).toFixed(2)} MB in size.`,
                        method: 'unsupported-type-fallback',
                        fallbackUsed: true
                    };
            }

            // Clean the text if extraction was successful
            if (!extractionResult.fallbackUsed && extractionResult.text) {
                extractionResult.text = this.cleanText(extractionResult.text);
            }

            // Validate extraction result
            if (!extractionResult.text || extractionResult.text.trim().length < 10) {
                console.warn(`Extraction yielded insufficient content, creating enhanced fallback`);
                extractionResult = {
                    text: `This file "${fileName}" (${fileExt.toUpperCase()}, ${(file.size / 1024 / 1024).toFixed(2)} MB) appears to contain no extractable text content or the content is too short. This may be because the file consists primarily of images, has complex formatting, or contains content that cannot be automatically extracted as text.`,
                    method: 'insufficient-content-fallback',
                    fallbackUsed: true
                };
            }

            const duration = (Date.now() - startTime) / 1000;
            console.log(`File extraction completed in ${duration.toFixed(2)}s`);
            console.log(`Final result - Method: ${extractionResult.method}, Content length: ${extractionResult.text.length} characters, Fallback used: ${extractionResult.fallbackUsed}`);

            return {
                text: extractionResult.text,
                title: fileName,
                contentType: `file-${fileExt.substring(1)}`,
                extractionMethod: extractionResult.method,
                fallbackUsed: extractionResult.fallbackUsed,
                metadata: {
                    fileName: fileName,
                    fileSize: file.size,
                    fileType: fileExt,
                    processingTime: duration
                }
            };

        } catch (error) {
            console.error(`Unexpected error during file extraction: ${error.message}`, error);

            // Return fallback content instead of throwing
            return {
                text: `An unexpected error occurred while processing the file "${fileName}": ${error.message}. The file is ${(file.size / 1024 / 1024).toFixed(2)} MB in size and has the extension ${fileExt}.`,
                title: fileName,
                contentType: `file-${fileExt.substring(1)}`,
                extractionMethod: 'error-fallback',
                fallbackUsed: true,
                metadata: {
                    fileName: fileName,
                    fileSize: file.size,
                    fileType: fileExt,
                    error: error.message
                }
            };
        }
    }

    /**
     * Try multiple methods to extract PDF content
     * @param {string} filePath - Path to the PDF file
     * @param {Buffer} pdfData - PDF file data as buffer
     * @returns {Promise<{text: string, method: string}>} - Extraction result
     */
    async tryMultiplePdfMethods(filePath, pdfData) {
        const strategies = [
            {
                name: 'standard-pdf-parse',
                execute: async () => {
                    console.log(`Attempting standard PDF parsing...`);
                    const result = await pdf(pdfData);
                    console.log(`Standard parsing: ${result.numpages} pages, ${result.text.length} characters`);
                    return result.text;
                }
            },
            {
                name: 'pdf-parse-with-options',
                execute: async () => {
                    console.log(`Attempting PDF parsing with custom options...`);
                    const result = await pdf(pdfData, {
                        max: 0, // No page limit
                        version: 'v2.0.550',
                        pagerender: function (pageData) {
                            return pageData.getTextContent().then(function (textContent) {
                                let lastY, text = '';
                                for (let item of textContent.items) {
                                    if (lastY != item.transform[5] || !lastY) {
                                        text += '\n';
                                    }
                                    text += item.str;
                                    lastY = item.transform[5];
                                }
                                return text;
                            });
                        }
                    });
                    console.log(`Custom parsing: ${result.numpages} pages, ${result.text.length} characters`);
                    return result.text;
                }
            },
            {
                name: 'page-by-page-extraction',
                execute: async () => {
                    console.log(`Attempting page-by-page PDF extraction...`);
                    const result = await pdf(pdfData, {
                        pagerender: function (pageData) {
                            return pageData.getTextContent().then(function (textContent) {
                                return textContent.items.map(item => item.str).join(' ');
                            });
                        }
                    });
                    console.log(`Page-by-page: ${result.numpages} pages, ${result.text.length} characters`);
                    return result.text;
                }
            },
            {
                name: 'simple-text-extraction',
                execute: async () => {
                    console.log(`Attempting simple text extraction...`);
                    const result = await pdf(pdfData, {
                        normalizeWhitespace: false,
                        disableCombineTextItems: false
                    });
                    console.log(`Simple extraction: ${result.numpages} pages, ${result.text.length} characters`);
                    return result.text;
                }
            }
        ];

        // Try each strategy
        for (const strategy of strategies) {
            try {
                const extractedText = await strategy.execute();

                if (extractedText && extractedText.trim().length > 50) {
                    console.log(`PDF text extracted successfully using ${strategy.name}: ${extractedText.length} characters`);
                    return {
                        text: extractedText,
                        method: strategy.name
                    };
                } else {
                    console.warn(`Strategy ${strategy.name} yielded insufficient content: ${extractedText ? extractedText.length : 0} characters`);
                }
            } catch (error) {
                console.warn(`Strategy ${strategy.name} failed: ${error.message}`);
            }
        }

        // If all strategies fail, create fallback content
        console.log(`All PDF extraction strategies failed, creating fallback content`);
        return await this.createPdfFallbackContent(filePath, pdfData);
    }

    /**
     * Create fallback content for PDFs when extraction fails
     * @param {string} filePath - Path to the PDF file
     * @param {Buffer} pdfData - PDF file data (can be null if file couldn't be read)
     * @returns {Promise<{text: string, method: string}>} - Fallback content
     */
    async createPdfFallbackContent(filePath, pdfData) {
        const fileName = path.basename(filePath);

        let fallbackText = `This PDF document "${fileName}"`;

        // Add file size if available
        if (pdfData) {
            const fileSizeMB = (pdfData.length / 1024 / 1024).toFixed(2);
            fallbackText += ` (${fileSizeMB} MB)`;
        }

        fallbackText += ` could not have its text content extracted automatically. `;

        // Try to get basic PDF info if data is available
        if (pdfData) {
            try {
                const basicInfo = await pdf(pdfData);
                if (basicInfo.numpages) {
                    fallbackText += `The document contains ${basicInfo.numpages} pages. `;
                }
                if (basicInfo.info && basicInfo.info.Title) {
                    fallbackText += `The document title appears to be: "${basicInfo.info.Title}". `;
                }
                if (basicInfo.info && basicInfo.info.Author) {
                    fallbackText += `The document author appears to be: ${basicInfo.info.Author}. `;
                }
            } catch (infoError) {
                console.warn(`Could not extract basic PDF info: ${infoError.message}`);
                fallbackText += `Basic document information could not be retrieved. `;
            }
        }

        fallbackText += `This may be because the PDF consists primarily of scanned images, has complex formatting, `;
        fallbackText += `is password-protected, corrupted, or contains content that cannot be automatically extracted as text. `;
        fallbackText += `Common reasons include: scanned documents without OCR, image-based PDFs, encrypted files, `;
        fallbackText += `or documents with unusual encoding. For better results, consider converting this PDF to text manually, `;
        fallbackText += `using OCR software, or ensuring the PDF contains selectable text rather than just images.`;

        return {
            text: fallbackText,
            method: 'pdf-metadata-fallback'
        };
    }

    /**
     * Validate extraction result and ensure it's substantial enough for processing
     * @param {string} text - Extracted text
     * @param {string} source - Source description (for logging)
     * @returns {boolean} - Whether the text is substantial enough
     */
    validateExtractionResult(text, source) {
        if (!text || typeof text !== 'string') {
            console.warn(`${source}: No text content extracted`);
            return false;
        }

        const trimmedText = text.trim();
        if (trimmedText.length < 10) {
            console.warn(`${source}: Extracted text too short (${trimmedText.length} characters)`);
            return false;
        }

        // Check for meaningful content (not just whitespace or repeated characters)
        const uniqueChars = new Set(trimmedText.toLowerCase().replace(/\s/g, '')).size;
        if (uniqueChars < 5) {
            console.warn(`${source}: Extracted text lacks diversity (${uniqueChars} unique characters)`);
            return false;
        }

        console.log(`${source}: Extraction validation passed (${trimmedText.length} characters, ${uniqueChars} unique chars)`);
        return true;
    }

    /**
     * Create generic fallback content for any extraction failure
     * @param {string} source - Source description (URL, filename, etc.)
     * @param {string} type - Content type (youtube-video, pdf, webpage, etc.)
     * @param {string} error - Error message
     * @param {Object} metadata - Additional metadata
     * @returns {string} - Fallback content
     */
    createGenericFallbackContent(source, type, error, metadata = {}) {
        let fallbackText = `Content extraction failed for ${type}: "${source}". `;

        if (error) {
            fallbackText += `Error: ${error}. `;
        }

        // Add type-specific information
        switch (type) {
            case 'youtube-video':
                fallbackText += `This appears to be a YouTube video that may not have captions enabled, `;
                fallbackText += `may be in a language that couldn't be detected, or may be restricted. `;
                if (metadata.videoId) {
                    fallbackText += `Video ID: ${metadata.videoId}. `;
                }
                break;

            case 'pdf':
                fallbackText += `This appears to be a PDF document that may consist of scanned images, `;
                fallbackText += `have complex formatting, or be password-protected. `;
                if (metadata.fileSize) {
                    fallbackText += `File size: ${(metadata.fileSize / 1024 / 1024).toFixed(2)} MB. `;
                }
                break;

            case 'webpage':
                fallbackText += `This appears to be a webpage that may be blocking automated access, `;
                fallbackText += `require authentication, or have content loaded dynamically. `;
                break;

            default:
                fallbackText += `This content type may not be fully supported or may have specific access requirements. `;
        }

        fallbackText += `While the original content couldn't be extracted, this information may still be useful for understanding what was attempted.`;

        return fallbackText;
    }

    /**
     * Clean up extracted text
     * @param {string} text - The text to clean
     * @returns {string} - The cleaned text
     */
    cleanText(text) {
        if (!text) return '';

        return text
            .replace(/\s+/g, ' ')           // Replace multiple spaces with a single space
            .replace(/\n+/g, '\n')          // Replace multiple newlines with a single newline
            .replace(/\t/g, ' ')            // Replace tabs with spaces
            .replace(/\r/g, '')             // Remove carriage returns
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
            .trim();                        // Remove leading/trailing whitespace
    }

    /**
     * Check if a URL is a YouTube URL
     * @param {string} url - The URL to check
     * @returns {boolean} - True if the URL is a YouTube URL
     */
    isYoutubeUrl(url) {
        return url.includes('youtube.com/watch') ||
            url.includes('youtu.be/') ||
            url.includes('youtube.com/embed/') ||
            url.includes('m.youtube.com/watch');
    }

    /**
     * Classify the type of YouTube URL
     * @param {string} url - The YouTube URL
     * @returns {string} - The URL type ('video', 'playlist', 'channel', 'unknown')
     */
    classifyYoutubeUrl(url) {
        // Check for individual video (even with playlist parameters)
        if (url.includes('youtube.com/watch') && url.includes('v=')) {
            return 'video'; // Individual video, even if part of a playlist
        }

        if (url.includes('youtu.be/')) {
            return 'video'; // Short URL format is always individual video
        }

        if (url.includes('youtube.com/embed/')) {
            return 'video'; // Embed format is always individual video
        }

        // Check for playlist-only URLs
        if (url.includes('youtube.com/playlist') && url.includes('list=')) {
            return 'playlist';
        }

        // Check for channel URLs
        if (url.includes('youtube.com/channel/') || url.includes('youtube.com/c/') || url.includes('youtube.com/@')) {
            return 'channel';
        }

        return 'unknown';
    }

    /**
     * Extract the YouTube video ID from a URL, handling playlist parameters properly
     * @param {string} url - The YouTube URL
     * @returns {string|null} - The YouTube video ID or null if not found
     */
    extractYoutubeId(url) {
        console.log(`Extracting video ID from URL: ${url}`);

        // Handle different YouTube URL formats
        let videoId = null;

        try {
            // youtu.be format: https://youtu.be/VIDEO_ID?t=123
            if (url.includes('youtu.be/')) {
                const match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
                videoId = match ? match[1] : null;
            }
            // youtube.com/watch format: https://www.youtube.com/watch?v=VIDEO_ID&list=PLAYLIST_ID
            else if (url.includes('youtube.com/watch') || url.includes('m.youtube.com/watch')) {
                const urlObj = new URL(url);
                videoId = urlObj.searchParams.get('v');
            }
            // youtube.com/embed format: https://www.youtube.com/embed/VIDEO_ID
            else if (url.includes('youtube.com/embed/')) {
                const match = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
                videoId = match ? match[1] : null;
            }

            // Validate video ID (should be exactly 11 characters and alphanumeric with - and _)
            if (videoId && videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(videoId)) {
                console.log(`Successfully extracted video ID: ${videoId}`);
                return videoId;
            }

        } catch (error) {
            console.error(`Error parsing YouTube URL: ${error.message}`);
        }

        console.error(`Could not extract valid video ID from URL: ${url}`);
        return null;
    }

    /**
     * Extract playlist ID from YouTube URL if present
     * @param {string} url - The YouTube URL
     * @returns {string|null} - The playlist ID or null if not found
     */
    extractYoutubePlaylistId(url) {
        try {
            const urlObj = new URL(url);
            const playlistId = urlObj.searchParams.get('list');

            if (playlistId && playlistId.length > 10) {
                console.log(`Found playlist ID: ${playlistId}`);
                return playlistId;
            }
        } catch (error) {
            console.warn(`Could not extract playlist ID: ${error.message}`);
        }

        return null;
    }
}

module.exports = new ContentExtractor();