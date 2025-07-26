/**
 * Processor service for SAWRON
 * Orchestrates the content extraction, summarization, and storage process
 */
const contentExtractor = require('./contentExtractor');
const ollamaService = require('./ollama');
const database = require('./database');
const Summary = require('../models/summary');
const AIProviderFactory = require('./ai/AIProviderFactory');
const AISettingsManager = require('./ai/AISettingsManager');
const processingQueue = require('./ProcessingQueue');
const path = require('path');
const fs = require('fs').promises;

class Processor {
    constructor() {
        this.aiSettingsManager = AISettingsManager.getInstance();
        this.initializeProcessingQueue();
    }

    /**
     * Initialize processing queue with current settings
     */
    async initializeProcessingQueue() {
        try {
            const settings = this.aiSettingsManager.loadSettings();
            const concurrentLimit = settings.concurrentProcessing || 1;
            processingQueue.setMaxConcurrent(concurrentLimit);
        } catch (error) {
            processingQueue.setMaxConcurrent(1);
        }
    }

    /**
     * Get the current AI provider based on settings
     * @returns {Promise<AIProvider>} - Configured AI provider instance
     */
    async getCurrentAIProvider() {
        try {
            const settings = this.aiSettingsManager.loadSettings();
            const config = this.aiSettingsManager.getCurrentProviderConfig();
            return AIProviderFactory.createProvider(config);
        } catch (error) {
            // Fallback to Ollama with default settings
            
            // Fallback to Ollama with default settings
            return AIProviderFactory.createProvider({
                type: 'ollama',
                model: 'llama2',
                endpoint: 'http://localhost:11434'
            });
        }
    }

    /**
     * Process a URL for summarization
     * @param {string} url - The URL to process
     * @returns {Promise<Summary>} - The created summary object
     */
    async processUrl(url) {
        // Start URL processing

        // Check if this is a YouTube playlist
        if (contentExtractor.isYoutubeUrl(url) && contentExtractor.classifyYoutubeUrl(url) === 'playlist') {
            return await this.processYoutubePlaylist(url);
        }

        // Create initial summary record
        const summary = new Summary({
            title: 'Processing URL...',
            sourceUrl: url,
            sourceType: this.detectUrlType(url),
            status: 'initializing',
            processingStep: 'Initializing processing',
            startTime: new Date()
        });

        // Add initial log
        summary.addLog(`Starting processing of URL: ${url}`);

        // Save initial record to database
        await database.saveSummary(summary);

        // Start processing in background
        this.processInBackground(summary.id, async () => {
            try {
                const startTime = Date.now();

                // Update status to extracting
                await database.updateSummaryStatus(
                    summary.id,
                    'extracting',
                    'Extracting content from URL'
                );

                console.log(`[${summary.id}] Extracting content from URL: ${url}`);

                // Extract content with timeout
                const extractionPromise = contentExtractor.extractFromUrl(url);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Content extraction timed out after 5 minutes')), 5 * 60 * 1000)
                );

                const extractionResult = await Promise.race([extractionPromise, timeoutPromise]);
                const { text, title, contentType, extractionMethod, fallbackUsed, metadata } = extractionResult;

                console.log(`[${summary.id}] Content extracted successfully. Title: ${title}, Content length: ${text.length} chars`);
                console.log(`[${summary.id}] Extraction details - Method: ${extractionMethod}, Type: ${contentType}, Fallback used: ${fallbackUsed}`);

                // Update status to summarizing
                await database.updateSummaryStatus(
                    summary.id,
                    'summarizing',
                    'Generating summary with AI provider'
                );

                // Store raw content and enhanced extraction metadata
                const summaryObj = await database.getSummary(summary.id);
                summaryObj.rawContent = text;
                summaryObj.title = title;
                summaryObj.extractionMetadata = {
                    contentType,
                    extractionMethod,
                    fallbackUsed,
                    ...metadata
                };
                await database.saveSummary(summaryObj);

                console.log(`[${summary.id}] Starting summarization with AI provider`);

                // Get current AI provider and generate summary
                const aiProvider = await this.getCurrentAIProvider();
                const summaryContent = await aiProvider.generateSummary(text);

                console.log(`[${summary.id}] Summary generated successfully. Length: ${summaryContent.length} chars`);

                // Calculate processing time and word count
                const processingTime = (Date.now() - startTime) / 1000;
                const wordCount = summaryContent.split(/\s+/).length;

                console.log(`[${summary.id}] Processing completed in ${processingTime.toFixed(2)}s. Word count: ${wordCount}`);

                // Update summary in database
                await database.updateSummaryContent(
                    summary.id,
                    summaryContent,
                    text,
                    processingTime,
                    wordCount
                );

                // Update title
                await this.updateSummaryTitle(summary.id, title);

                return { success: true };
            } catch (error) {
                console.error(`[${summary.id}] Error processing URL ${url}:`, error);
                await database.updateSummaryStatus(
                    summary.id,
                    'error',
                    `Error: ${error.message}`,
                    error.message
                );
                return { success: false, error: error.message };
            }
        });

        return summary;
    }

    /**
     * Process a YouTube playlist by extracting individual videos and processing each one
     * @param {string} playlistUrl - The YouTube playlist URL
     * @returns {Promise<Summary>} - The created summary object for tracking
     */
    async processYoutubePlaylist(playlistUrl) {
        console.log(`Processing YouTube playlist: ${playlistUrl}`);

        // Create a tracking summary for the playlist processing
        const trackingSummary = new Summary({
            title: 'Processing YouTube Playlist...',
            sourceUrl: playlistUrl,
            sourceType: 'youtube',
            status: 'initializing',
            processingStep: 'Extracting playlist videos',
            startTime: new Date()
        });

        trackingSummary.addLog(`Starting playlist processing: ${playlistUrl}`);
        await database.saveSummary(trackingSummary);

        // Start processing in background
        this.processInBackground(trackingSummary.id, async () => {
            try {
                // Update status
                await database.updateSummaryStatus(
                    trackingSummary.id,
                    'extracting',
                    'Extracting video URLs from playlist'
                );

                // Extract playlist videos using a simple approach
                const videoUrls = await this.extractPlaylistVideos(playlistUrl);
                
                if (!videoUrls || videoUrls.length === 0) {
                    throw new Error('No videos found in playlist. The playlist may be private or empty.');
                }

                console.log(`[${trackingSummary.id}] Found ${videoUrls.length} videos in playlist`);

                // Update status
                await database.updateSummaryStatus(
                    trackingSummary.id,
                    'summarizing',
                    `Processing ${videoUrls.length} videos from playlist`
                );

                // Process each video individually
                const processedVideos = [];
                for (let i = 0; i < videoUrls.length; i++) {
                    const videoUrl = videoUrls[i];
                    console.log(`[${trackingSummary.id}] Processing video ${i + 1}/${videoUrls.length}: ${videoUrl}`);

                    try {
                        // Create individual video summary
                        const videoSummary = await this.processUrl(videoUrl);
                        processedVideos.push(videoSummary);

                        // Update progress
                        await database.updateSummaryStatus(
                            trackingSummary.id,
                            'summarizing',
                            `Processed ${i + 1}/${videoUrls.length} videos from playlist`
                        );
                    } catch (error) {
                        console.error(`[${trackingSummary.id}] Error processing video ${videoUrl}:`, error);
                        // Continue with other videos even if one fails
                    }
                }

                // Delete the tracking summary since all individual videos are now processed
                await database.deleteSummary(trackingSummary.id);
                console.log(`[${trackingSummary.id}] Playlist processing completed and tracking summary deleted. Successfully processed ${processedVideos.length} out of ${videoUrls.length} videos.`);

                return { success: true, processedVideos: processedVideos.length };
            } catch (error) {
                console.error(`[${trackingSummary.id}] Error processing playlist ${playlistUrl}:`, error);
                await database.updateSummaryStatus(
                    trackingSummary.id,
                    'error',
                    `Error: ${error.message}`,
                    error.message
                );
                return { success: false, error: error.message };
            }
        });

        return trackingSummary;
    }

    /**
     * Extract video URLs from a YouTube playlist
     * @param {string} playlistUrl - The playlist URL
     * @returns {Promise<string[]>} - Array of video URLs
     */
    async extractPlaylistVideos(playlistUrl) {
        try {
            console.log(`Extracting videos from playlist: ${playlistUrl}`);

            // Extract playlist ID
            const playlistId = contentExtractor.extractYoutubePlaylistId(playlistUrl);
            if (!playlistId) {
                throw new Error('Could not extract playlist ID from URL');
            }

            // Use youtube-transcript library to get playlist videos
            const { YoutubeTranscript } = require('youtube-transcript');
            
            // Try to get the playlist page to extract video IDs
            const axios = require('axios');
            
            try {
                const response = await axios.get(`https://www.youtube.com/playlist?list=${playlistId}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    timeout: 30000
                });

                const html = response.data;

                // Check for private playlist indicators
                if (html.includes('This playlist is private') || 
                    html.includes('Private playlist') ||
                    html.includes('"isPrivate":true') ||
                    html.includes('playlist-header-banner-private')) {
                    throw new Error('This YouTube playlist is private, cannot access the videos.');
                }

                // More robust video ID extraction
                const videoIdMatches = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/g) || 
                                     html.match(/watch\?v=([a-zA-Z0-9_-]{11})/g);
                
                if (!videoIdMatches || videoIdMatches.length === 0) {
                    // Try alternative extraction methods
                    const altMatches = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/g);
                    if (!altMatches || altMatches.length === 0) {
                        throw new Error('This YouTube playlist is private, cannot access the videos.');
                    }
                    
                    // Process alternative matches
                    const videoIds = [...new Set(altMatches.map(match => 
                        match.replace('/watch?v=', '')
                    ))];
                    
                    const videoUrls = videoIds.map(id => `https://www.youtube.com/watch?v=${id}`);
                    console.log(`Successfully extracted ${videoUrls.length} unique videos from playlist (alternative method)`);
                    return videoUrls;
                }

                // Process standard matches
                const videoIds = [...new Set(videoIdMatches.map(match => {
                    if (match.includes('"videoId":"')) {
                        return match.replace('"videoId":"', '').replace('"', '');
                    } else {
                        return match.replace('watch?v=', '');
                    }
                }))];

                const videoUrls = videoIds.map(id => `https://www.youtube.com/watch?v=${id}`);
                
                console.log(`Successfully extracted ${videoUrls.length} unique videos from playlist`);
                return videoUrls;

            } catch (axiosError) {
                if (axiosError.response && axiosError.response.status === 404) {
                    throw new Error('This YouTube playlist is unavailable or does not exist.');
                }
                throw axiosError;
            }

        } catch (error) {
            console.error('Error extracting playlist videos:', error);
            
            // Handle specific errors
            if (error.message.includes('private') || error.message.includes('Private')) {
                throw new Error('This YouTube playlist is private, cannot access the videos.');
            }
            
            if (error.message.includes('not found') || error.message.includes('404') || error.message.includes('unavailable')) {
                throw new Error('This YouTube playlist is unavailable or does not exist.');
            }
            
            if (error.message.includes('empty') || error.message.includes('no videos')) {
                throw new Error('This YouTube playlist is empty.');
            }
            
            // Generic error
            throw new Error(`Failed to extract playlist videos: ${error.message}`);
        }
    }

    /**
     * Process a file for summarization
     * @param {Object} file - The uploaded file object
     * @returns {Promise<Summary>} - The created summary object
     */
    async processFile(file) {
        console.log(`Starting file processing: ${file.originalname} (${file.size} bytes)`);

        // Create initial summary record
        const summary = new Summary({
            title: `Processing ${file.originalname}...`,
            sourceType: 'file',
            sourceFile: {
                name: file.originalname,
                type: file.mimetype,
                size: file.size
            },
            status: 'initializing',
            processingStep: 'Initializing file processing',
            startTime: new Date()
        });

        // Add initial log
        summary.addLog(`Starting processing of file: ${file.originalname} (${file.size} bytes)`);

        // Save initial record to database
        await database.saveSummary(summary);

        // Start processing in background
        this.processInBackground(summary.id, async () => {
            try {
                const startTime = Date.now();

                // Update status to extracting
                await database.updateSummaryStatus(
                    summary.id,
                    'extracting',
                    `Extracting content from ${file.originalname}`
                );

                console.log(`[${summary.id}] Extracting content from file: ${file.originalname}`);

                // Extract content with timeout
                const extractionPromise = contentExtractor.extractFromFile(file);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('File extraction timed out after 5 minutes')), 5 * 60 * 1000)
                );

                const extractionResult = await Promise.race([extractionPromise, timeoutPromise]);
                const { text, title, contentType, extractionMethod, fallbackUsed, metadata } = extractionResult;

                console.log(`[${summary.id}] File content extracted successfully. Content length: ${text.length} chars`);
                console.log(`[${summary.id}] Extraction details - Method: ${extractionMethod}, Type: ${contentType}, Fallback used: ${fallbackUsed}`);

                // Update status to summarizing
                await database.updateSummaryStatus(
                    summary.id,
                    'summarizing',
                    'Generating summary with AI provider'
                );

                // Store raw content and enhanced extraction metadata
                const summaryObj = await database.getSummary(summary.id);
                summaryObj.rawContent = text;
                if (title !== summary.title) {
                    summaryObj.title = title;
                }
                summaryObj.extractionMetadata = {
                    contentType,
                    extractionMethod,
                    fallbackUsed,
                    ...metadata
                };
                await database.saveSummary(summaryObj);

                console.log(`[${summary.id}] Starting summarization with AI provider`);

                // Get current AI provider and generate summary
                const aiProvider = await this.getCurrentAIProvider();
                const summaryContent = await aiProvider.generateSummary(text);

                console.log(`[${summary.id}] Summary generated successfully. Length: ${summaryContent.length} chars`);

                // Calculate processing time and word count
                const processingTime = (Date.now() - startTime) / 1000;
                const wordCount = summaryContent.split(/\s+/).length;

                console.log(`[${summary.id}] Processing completed in ${processingTime.toFixed(2)}s. Word count: ${wordCount}`);

                // Update summary in database
                await database.updateSummaryContent(
                    summary.id,
                    summaryContent,
                    text,
                    processingTime,
                    wordCount
                );

                // Update title if needed
                if (title !== summary.title) {
                    await this.updateSummaryTitle(summary.id, title);
                }

                // Clean up temporary file
                try {
                    await fs.unlink(file.path);
                    console.log(`[${summary.id}] Temporary file deleted: ${file.path}`);
                } catch (err) {
                    console.warn(`[${summary.id}] Failed to delete temporary file:`, err);
                }

                return { success: true };
            } catch (error) {
                console.error(`[${summary.id}] Error processing file ${file.originalname}:`, error);
                await database.updateSummaryStatus(
                    summary.id,
                    'error',
                    `Error: ${error.message}`,
                    error.message
                );

                // Clean up temporary file even on error
                try {
                    await fs.unlink(file.path);
                    console.log(`[${summary.id}] Temporary file deleted after error: ${file.path}`);
                } catch (err) {
                    console.warn(`[${summary.id}] Failed to delete temporary file:`, err);
                }

                return { success: false, error: error.message };
            }
        });

        return summary;
    }

    /**
     * Process a task in the background
     * @param {string} summaryId - The ID of the summary to process
     * @param {Function} processFn - The function to execute
     */
    async processInBackground(summaryId, processFn) {
        // Use the processing queue to manage concurrent processing
        try {
            await processingQueue.addToQueue(summaryId, async () => {
                try {
                    await processFn();
                } catch (error) {
                    console.error(`Background processing error for summary ${summaryId}:`, error);
                    await database.updateSummaryStatus(summaryId, 'error', error.message);
                    throw error; // Re-throw to be handled by queue
                }
            });
        } catch (error) {
            console.error(`Failed to add summary ${summaryId} to processing queue:`, error);
        }
    }

    /**
     * Update the title of a summary
     * @param {string} summaryId - The ID of the summary to update
     * @param {string} title - The new title
     */
    async updateSummaryTitle(summaryId, title) {
        try {
            const summary = await database.getSummary(summaryId);
            if (summary) {
                summary.title = title;
                await database.saveSummary(summary);
            }
        } catch (error) {
            console.error(`Error updating summary title ${summaryId}:`, error);
        }
    }

    /**
     * Detect the type of URL
     * @param {string} url - The URL to check
     * @returns {string} - The detected URL type
     */
    detectUrlType(url) {
        console.log(`Detecting URL type for: ${url}`);

        // Use the content extractor's classification logic
        if (contentExtractor.isYoutubeUrl(url)) {
            const youtubeType = contentExtractor.classifyYoutubeUrl(url);
            
            if (youtubeType === 'video') {
                console.log(`Detected as YouTube video`);
                return 'youtube';
            } else if (youtubeType === 'playlist') {
                console.log(`Detected as YouTube playlist`);
                return 'youtube'; // Changed from 'playlist' to 'youtube' since we'll process individual videos
            } else if (youtubeType === 'channel') {
                console.log(`Detected as YouTube channel`);
                return 'channel';
            }
        }

        // Default to regular URL
        console.log(`Detected as regular web URL`);
        return 'url';
    }

    /**
     * Generate a PDF from a summary
     * @param {string} summaryId - The ID of the summary to convert
     * @returns {Promise<{buffer: Buffer, filename: string}>} - The PDF buffer and filename
     */
    async generatePdf(summaryId) {
        try {
            const summary = await database.getSummary(summaryId);
            if (!summary) {
                throw new Error('Summary not found');
            }

            if (summary.status !== 'completed') {
                throw new Error('Summary is not yet completed');
            }

            // Generate PDF for summary

            const puppeteer = require('puppeteer');
            
            // Launch browser
            const browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();

            // Create HTML content with beautiful styling
            const htmlContent = this.createPdfHtml(summary);

            // Set content and generate PDF
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
            
            // Add a small delay to ensure content is fully rendered
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const pdfBuffer = await page.pdf({
                format: 'A4',
                margin: {
                    top: '20mm',
                    right: '20mm',
                    bottom: '20mm',
                    left: '20mm'
                },
                printBackground: true,
                preferCSSPageSize: false,
                displayHeaderFooter: false
            });

            // PDF buffer generated successfully

            await browser.close();

            // Generate filename from title
            const filename = this.generatePdfFilename(summary.title);

            // PDF generated successfully
            return { buffer: pdfBuffer, filename };

        } catch (error) {
            console.error(`Error generating PDF for summary ${summaryId}:`, error);
            throw new Error(`PDF generation failed: ${error.message}`);
        }
    }

    /**
     * Create HTML content for PDF generation
     * @param {Summary} summary - The summary object
     * @returns {string} - HTML content
     */
    createPdfHtml(summary) {
        const formattedDate = new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(summary.createdAt);

        // Convert markdown to HTML
        const contentHtml = this.markdownToHtml(summary.content || '');

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${summary.title}</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }
                
                .header {
                    border-bottom: 3px solid #007acc;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                
                .title {
                    font-size: 28px;
                    font-weight: bold;
                    color: #007acc;
                    margin: 0 0 10px 0;
                }
                
                .meta {
                    color: #666;
                    font-size: 14px;
                    margin-bottom: 5px;
                }
                
                .meta strong {
                    color: #333;
                }
                
                .content {
                    font-size: 16px;
                    line-height: 1.8;
                }
                
                .content h1 {
                    color: #007acc;
                    font-size: 24px;
                    margin-top: 30px;
                    margin-bottom: 15px;
                    border-bottom: 2px solid #007acc;
                    padding-bottom: 5px;
                }
                
                .content h2 {
                    color: #0066cc;
                    font-size: 20px;
                    margin-top: 25px;
                    margin-bottom: 12px;
                }
                
                .content h3 {
                    color: #0066cc;
                    font-size: 18px;
                    margin-top: 20px;
                    margin-bottom: 10px;
                }
                
                .content p {
                    margin-bottom: 15px;
                    text-align: justify;
                }
                
                .content ul, .content ol {
                    margin-bottom: 15px;
                    padding-left: 25px;
                }
                
                /* Manual numbered list styling for PDF */
                .content ol.manual-numbered {
                    list-style: none;
                    padding-left: 0;
                    margin-left: 0;
                    counter-reset: none;
                }
                
                .content ol.manual-numbered li {
                    display: block;
                    margin-bottom: 8px;
                    position: relative;
                    list-style: none;
                }
                
                .content ol.manual-numbered li .list-number {
                    font-weight: bold;
                    color: #007acc;
                    margin-right: 8px;
                    display: inline-block;
                    min-width: 20px;
                }
                
                /* Fallback for regular ol elements */
                .content ol:not(.manual-numbered) {
                    counter-reset: item;
                }
                
                .content ol:not(.manual-numbered) > li {
                    display: block;
                    margin-bottom: 8px;
                    position: relative;
                }
                
                .content ol:not(.manual-numbered) > li:before {
                    content: counter(item) ". ";
                    counter-increment: item;
                    font-weight: bold;
                    position: absolute;
                    left: -25px;
                }
                
                .content ul > li {
                    margin-bottom: 8px;
                }
                
                .content strong {
                    color: #333;
                    font-weight: 600;
                }
                
                .content em {
                    font-style: italic;
                    color: #555;
                }
                
                .content code {
                    background-color: #f5f5f5;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-family: 'Monaco', 'Consolas', monospace;
                    font-size: 14px;
                }
                
                .content pre {
                    background-color: #f8f8f8;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                    padding: 15px;
                    overflow-x: auto;
                    margin-bottom: 15px;
                }
                
                .content pre code {
                    background: none;
                    padding: 0;
                }
                
                .content a {
                    color: #007acc;
                    text-decoration: none;
                }
                
                .content a:hover {
                    text-decoration: underline;
                }
                
                .footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #ddd;
                    font-size: 12px;
                    color: #666;
                    text-align: center;
                }
                
                @media print {
                    body {
                        margin: 0;
                        padding: 15px;
                    }
                    
                    .header {
                        page-break-after: avoid;
                    }
                    
                    .content h1, .content h2, .content h3 {
                        page-break-after: avoid;
                    }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1 class="title">${summary.title}</h1>
                <div class="meta">
                    ${summary.sourceUrl ? `<strong>Source:</strong> ${summary.sourceUrl}<br>` : ''}
                    ${summary.sourceFile ? `<strong>Source:</strong> ${summary.sourceFile.name}<br>` : ''}
                    <strong>Generated:</strong> ${formattedDate}<br>
                    ${summary.wordCount ? `<strong>Word Count:</strong> ${summary.wordCount} words<br>` : ''}
                    ${summary.processingTime ? `<strong>Processing Time:</strong> ${summary.processingTime.toFixed(1)}s<br>` : ''}
                </div>
            </div>
            
            <div class="content">
                ${contentHtml}
            </div>
            
            <div class="footer">
                Generated by SAWRON Knowledge Processing System
            </div>
        </body>
        </html>
        `;
    }

    /**
     * Convert markdown to HTML for PDF generation
     * @param {string} markdown - Markdown content
     * @returns {string} - HTML content
     */
    markdownToHtml(markdown) {
        if (!markdown) return '';

        // Process markdown and convert numbered lists to sequential numbering
        let numberedItemCounter = 0;
        const lines = markdown.split('\n');
        const result = [];
        let currentParagraph = [];
        let inList = false;
        let listType = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            // Empty line - end current paragraph or list
            if (!trimmedLine) {
                if (currentParagraph.length > 0) {
                    result.push(`<p>${currentParagraph.join('<br>')}</p>`);
                    currentParagraph = [];
                }
                if (inList) {
                    result.push(`</${listType}>`);
                    inList = false;
                    listType = null;
                    numberedItemCounter = 0; // Reset counter when list ends
                }
                continue;
            }

            // Headers
            if (trimmedLine.startsWith('### ')) {
                const state = this.flushParagraph(result, currentParagraph, inList, listType);
                inList = state.inList;
                listType = state.listType;
                numberedItemCounter = 0; // Reset counter after headers
                result.push(`<h3>${trimmedLine.substring(4)}</h3>`);
                continue;
            }
            if (trimmedLine.startsWith('## ')) {
                const state = this.flushParagraph(result, currentParagraph, inList, listType);
                inList = state.inList;
                listType = state.listType;
                numberedItemCounter = 0; // Reset counter after headers
                result.push(`<h2>${trimmedLine.substring(3)}</h2>`);
                continue;
            }
            if (trimmedLine.startsWith('# ')) {
                const state = this.flushParagraph(result, currentParagraph, inList, listType);
                inList = state.inList;
                listType = state.listType;
                numberedItemCounter = 0; // Reset counter after headers
                result.push(`<h1>${trimmedLine.substring(2)}</h1>`);
                continue;
            }

            // Unordered list items
            if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
                if (currentParagraph.length > 0) {
                    result.push(`<p>${currentParagraph.join('<br>')}</p>`);
                    currentParagraph = [];
                }
                if (!inList || listType !== 'ul') {
                    if (inList) result.push(`</${listType}>`);
                    result.push('<ul>');
                    inList = true;
                    listType = 'ul';
                    numberedItemCounter = 0; // Reset counter for unordered lists
                }
                const content = this.processInlineMarkdown(trimmedLine.substring(2));
                result.push(`<li>${content}</li>`);
                continue;
            }

            // SIMPLE NUMBERED LIST SOLUTION - Just increment counter for ANY numbered item
            const orderedMatch = trimmedLine.match(/^\d+\. (.+)$/);
            if (orderedMatch) {
                if (currentParagraph.length > 0) {
                    result.push(`<p>${currentParagraph.join('<br>')}</p>`);
                    currentParagraph = [];
                }
                
                if (!inList || listType !== 'ol') {
                    if (inList) result.push(`</${listType}>`);
                    result.push('<ol class="manual-numbered">');
                    inList = true;
                    listType = 'ol';
                    // DON'T reset counter here - keep incrementing across the entire document
                }
                
                numberedItemCounter++;
                const content = this.processInlineMarkdown(orderedMatch[1]);
                const listItem = `<li><span class="list-number">${numberedItemCounter}.</span> ${content}</li>`;
                result.push(listItem);
                continue;
            }

            // Regular paragraph line
            if (inList) {
                result.push(`</${listType}>`);
                inList = false;
                listType = null;
                // DON'T reset numberedItemCounter here - keep it going
            }

            const processedLine = this.processInlineMarkdown(trimmedLine);
            currentParagraph.push(processedLine);
        }

        // Flush any remaining content
        this.flushParagraph(result, currentParagraph, inList, listType);
        return result.join('\n');
    }

    /**
     * Helper method to flush current paragraph and close lists
     */
    flushParagraph(result, currentParagraph, inList, listType) {
        if (currentParagraph.length > 0) {
            result.push(`<p>${currentParagraph.join('<br>')}</p>`);
            currentParagraph.length = 0;
        }
        if (inList) {
            result.push(`</${listType}>`);
            inList = false;
            listType = null;
        }
        return { inList: false, listType: null };
    }

    /**
     * Process inline markdown (bold, italic, code, links)
     * @param {string} text - Text to process
     * @returns {string} - Processed text
     */
    processInlineMarkdown(text) {
        if (!text) return '';

        let processed = text;

        // Code blocks (do first to avoid processing markdown inside code)
        processed = processed.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        processed = processed.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Bold text
        processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        processed = processed.replace(/__(.*?)__/g, '<strong>$1</strong>');

        // Italic text (avoid conflicts with bold)
        processed = processed.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
        processed = processed.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>');

        // Links
        processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

        return processed;
    }

    /**
     * Generate a clean filename from the summary title
     * @param {string} title - The summary title
     * @returns {string} - Clean filename
     */
    generatePdfFilename(title) {
        if (!title) return 'summary.pdf';
        
        // Clean the title for use as filename
        let filename = title
            .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
            .toLowerCase()
            .substring(0, 50); // Limit length
        
        // Remove leading/trailing hyphens
        filename = filename.replace(/^-+|-+$/g, '');
        
        // Ensure it's not empty
        if (!filename) filename = 'summary';
        
        return `${filename}.pdf`;
    }

    /**
     * Stop a running summarization process
     * @param {string} summaryId - The ID of the summary to stop
     * @returns {Promise<boolean>} - True if the process was stopped
     */
    async stopProcess(summaryId) {
        // Since we're using setTimeout for background processing,
        // we can't actually stop a running process.
        // In a real implementation with a job queue, you would cancel the job.

        // For now, just mark it as error/cancelled
        try {
            await database.updateSummaryStatus(summaryId, 'error', 'Process cancelled by user');
            return true;
        } catch (error) {
            console.error(`Error stopping process ${summaryId}:`, error);
            return false;
        }
    }
}

module.exports = new Processor();