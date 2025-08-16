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

                try {
                    const result = await this.extractFromYoutube(url);

                    const duration = (Date.now() - startTime) / 1000;
                    console.log(`YouTube processing completed in ${duration.toFixed(2)}s`);
                    console.log(`Final result - Method: ${result.extractionMethod}, Content length: ${result.text.length} characters, Fallback used: ${result.fallbackUsed}`);

                    return result;
                } catch (youtubeError) {
                    // For YouTube transcript extraction failures, throw the error to be handled by the processor
                    console.error(`YouTube transcript extraction failed: ${youtubeError.message}`);
                    throw youtubeError;
                }
            }

            // Otherwise, treat as a regular web page
            console.log(`Processing as regular web page...`);
            return await this.extractFromWebpage(url, startTime);

        } catch (error) {
            // Only catch non-YouTube errors for fallback handling
            if (this.isYoutubeUrl(url)) {
                // Re-throw YouTube errors so they can be handled properly by the processor
                throw error;
            }

            console.error(`Unexpected error during URL extraction: ${error.message}`, error);

            const duration = (Date.now() - startTime) / 1000;

            // Return fallback content for non-YouTube URLs
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
            throw new Error(`Unable to extract video ID from YouTube URL: ${url}. Please check if the URL is valid.`);
        }

        console.log(`Extracted video ID: ${videoId}`);

        // Get enhanced video metadata
        const metadata = await this.extractYoutubeMetadata(videoId);

        try {
            // Try transcript extraction using LangChain
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
        } catch (error) {
            const duration = (Date.now() - startTime) / 1000;
            console.error(`❌ YouTube transcript extraction failed after ${duration.toFixed(2)}s: ${error.message}`);
            console.error(`📋 Unable to extract transcript for video "${metadata.title}" (${videoId})`);

            // Throw the error so it can be handled upstream with proper status setting
            throw new Error(`Unable to extract transcript: ${error.message}`);
        }
    }

    /**
     * Extract YouTube transcript using simplified LangChain-only approach
     * @param {string} videoId - The YouTube video ID
     * @returns {Promise<{text: string, method: string, fallbackUsed: boolean}>} - Extraction result
     */
    async tryMultipleTranscriptMethods(videoId) {
        const YouTubeTranscriptExtractor = require('./youtubeTranscriptExtractor');
        const extractor = new YouTubeTranscriptExtractor();

        console.log(`🎬 Starting transcript extraction for video ID: ${videoId}`);
        const startTime = Date.now();

        try {
            const result = await extractor.extractTranscript(videoId);
            const processingTime = Date.now() - startTime;

            if (result.success) {
                console.log(`✅ Transcript extracted successfully: ${result.transcript.length} characters in ${processingTime}ms`);

                return {
                    text: result.transcript,
                    method: 'langchain-youtube-loader',
                    fallbackUsed: false,
                    processingTime: processingTime
                };
            } else {
                console.error(`❌ Transcript extraction failed: ${result.error}`);
                throw new Error(`Unable to extract transcript: ${result.error}`);
            }

        } catch (error) {
            const processingTime = Date.now() - startTime;
            console.error(`💥 Transcript extraction failed after ${processingTime}ms: ${error.message}`);
            throw new Error(`Failed to extract transcript from video ${videoId}: ${error.message}`);
        }
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
                const basicInfo = await pdf(pdfData, { max: 1 });
                if (basicInfo.numpages) {
                    fallbackText += `The document appears to have ${basicInfo.numpages} pages. `;
                }
            } catch (infoError) {
                // Ignore errors when trying to get basic info
            }
        }

        fallbackText += `This could be due to the PDF being image-based (scanned), password-protected, corrupted, or having complex formatting that prevents text extraction. The document may contain valuable information, but it would need to be processed manually or with specialized OCR tools.`;

        return {
            text: fallbackText,
            method: 'pdf-fallback',
            fallbackUsed: true
        };
    }

    /**
     * Check if a URL is a YouTube URL
     * @param {string} url - The URL to check
     * @returns {boolean} - True if it's a YouTube URL
     */
    isYoutubeUrl(url) {
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)/i;
        return youtubeRegex.test(url);
    }

    /**
     * Classify YouTube URL type
     * @param {string} url - The YouTube URL
     * @returns {string} - URL type: 'video', 'playlist', 'channel', or 'unknown'
     */
    classifyYoutubeUrl(url) {
        if (url.includes('list=')) {
            return 'playlist';
        } else if (url.includes('watch?v=') || url.includes('youtu.be/')) {
            return 'video';
        } else if (url.includes('/channel/') || url.includes('/c/') || url.includes('/@')) {
            return 'channel';
        } else {
            return 'unknown';
        }
    }

    /**
     * Extract YouTube video ID from URL
     * @param {string} url - The YouTube URL
     * @returns {string|null} - The video ID or null if not found
     */
    extractYoutubeId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }

        return null;
    }

    /**
     * Extract YouTube playlist ID from URL
     * @param {string} url - The YouTube URL
     * @returns {string|null} - The playlist ID or null if not found
     */
    extractYoutubePlaylistId(url) {
        const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
    }

    /**
     * Clean extracted text
     * @param {string} text - The raw text
     * @returns {string} - Cleaned text
     */
    cleanText(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }

        return text
            // Normalize whitespace
            .replace(/\s+/g, ' ')
            // Remove excessive line breaks
            .replace(/\n{3,}/g, '\n\n')
            // Trim
            .trim();
    }
}

module.exports = new ContentExtractor();