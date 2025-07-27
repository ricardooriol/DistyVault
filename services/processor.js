/**
 * Processor service for SAWRON
 * Orchestrates the content extraction, distillation, and storage process
 */
const contentExtractor = require('./contentExtractor');
const ollamaService = require('./ollama');
const database = require('./database');
const Distillation = require('../models/distillation');
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
            return AIProviderFactory.createProvider({
                type: 'ollama',
                model: 'llama2',
                endpoint: 'http://localhost:11434'
            });
        }
    }

    /**
     * Process a URL for distillation
     * @param {string} url - The URL to process
     * @returns {Promise<Distillation>} - The created distillation object
     */
    async processUrl(url) {
        // Start URL processing

        // Check if this is a YouTube playlist
        if (contentExtractor.isYoutubeUrl(url) && contentExtractor.classifyYoutubeUrl(url) === 'playlist') {
            return await this.processYoutubePlaylist(url);
        }

        // Create initial distillation record
        const distillation = new Distillation({
            title: 'Processing URL...',
            sourceUrl: url,
            sourceType: this.detectUrlType(url),
            status: 'initializing',
            processingStep: 'Initializing processing',
            startTime: new Date()
        });

        // Add initial log with system information
        distillation.addLog(`🚀 Starting processing of URL: ${url}`);
        distillation.addLog(`📋 Process ID: ${distillation.id}`);
        distillation.addLog(`⏰ Started at: ${new Date().toISOString()}`);
        distillation.addLog(`🌐 User Agent: ${process.env.USER_AGENT || 'SAWRON/1.0'}`);

        // Save initial record to database
        await database.saveDistillation(distillation);

        // Start processing in background
        this.processInBackground(distillation.id, async () => {
            try {
                const startTime = Date.now();
                const distillationObj = await database.getDistillation(distillation.id);

                distillationObj.addLog(`🔄 Background processing started`);
                distillationObj.addLog(`📊 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);

                // Update status to extracting
                await database.updateDistillationStatus(
                    distillation.id,
                    'extracting',
                    'Extracting content from URL'
                );

                distillationObj.addLog(`🔍 Phase 1: Content Extraction`);
                distillationObj.addLog(`🌐 Target URL: ${url}`);
                distillationObj.addLog(`⏱️ Extraction timeout: 5 minutes`);
                await database.saveDistillation(distillationObj);

                console.log(`[${distillation.id}] Extracting content from URL: ${url}`);

                // Extract content with timeout
                const extractionPromise = contentExtractor.extractFromUrl(url);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Content extraction timed out after 5 minutes')), 5 * 60 * 1000)
                );

                const extractionResult = await Promise.race([extractionPromise, timeoutPromise]);
                const { text, title, contentType, extractionMethod, fallbackUsed, metadata } = extractionResult;

                const extractionTime = Date.now() - startTime;
                const updatedDistillation = await database.getDistillation(distillation.id);

                updatedDistillation.addLog(`✅ Content extraction completed in ${(extractionTime / 1000).toFixed(2)}s`);
                updatedDistillation.addLog(`📄 Title: "${title}"`);
                updatedDistillation.addLog(`📝 Content length: ${text.length.toLocaleString()} characters`);
                updatedDistillation.addLog(`🔧 Extraction method: ${extractionMethod}`);
                updatedDistillation.addLog(`📋 Content type: ${contentType}`);
                updatedDistillation.addLog(`🔄 Fallback used: ${fallbackUsed ? 'Yes' : 'No'}`);

                if (metadata) {
                    if (metadata.duration) updatedDistillation.addLog(`⏱️ Video duration: ${metadata.duration}`);
                    if (metadata.viewCount) updatedDistillation.addLog(`👁️ View count: ${metadata.viewCount.toLocaleString()}`);
                    if (metadata.author) updatedDistillation.addLog(`👤 Author: ${metadata.author}`);
                    if (metadata.publishDate) updatedDistillation.addLog(`📅 Published: ${metadata.publishDate}`);
                }

                await database.saveDistillation(updatedDistillation);

                console.log(`[${distillation.id}] Content extracted successfully. Title: ${title}, Content length: ${text.length} chars`);
                console.log(`[${distillation.id}] Extraction details - Method: ${extractionMethod}, Type: ${contentType}, Fallback used: ${fallbackUsed}`);

                // Update status to distilling
                await database.updateDistillationStatus(
                    distillation.id,
                    'distilling',
                    'Generating distillation with AI provider'
                );

                // Store raw content and enhanced extraction metadata
                distillationObj.rawContent = text;
                distillationObj.title = title;

                distillationObj.addLog(`🤖 Phase 2: AI Distillation`);
                distillationObj.addLog(`📊 Text preprocessing started`);

                // Get AI provider info for logging
                const aiProvider = await this.getCurrentAIProvider();
                distillationObj.addLog(`🧠 AI Provider: ${aiProvider.name}`);
                distillationObj.addLog(`🎯 Model: ${aiProvider.model}`);
                distillationObj.addLog(`🔗 Endpoint: ${aiProvider.endpoint || 'Default'}`);

                distillationObj.extractionMetadata = {
                    contentType,
                    extractionMethod,
                    fallbackUsed,
                    ...metadata
                };
                await database.saveDistillation(distillationObj);

                console.log(`[${distillation.id}] Starting distillation with AI provider`);
                const distillationContent = await aiProvider.generateSummary(text);

                console.log(`[${distillation.id}] Distillation generated successfully. Length: ${distillationContent.length} chars`);

                // Calculate processing time and word count
                const processingTime = (Date.now() - startTime) / 1000;
                const wordCount = distillationContent.split(/\s+/).length;

                console.log(`[${distillation.id}] Processing completed in ${processingTime.toFixed(2)}s. Word count: ${wordCount}`);

                // Update distillation in database
                await database.updateDistillationContent(
                    distillation.id,
                    distillationContent,
                    text,
                    processingTime,
                    wordCount
                );

                // Update title
                await this.updateDistillationTitle(distillation.id, title);

                // Add final completion logs
                const completedDistillation = await database.getDistillation(distillation.id);
                completedDistillation.addLog(`✅ Processing completed successfully`);
                completedDistillation.addLog(`📊 Final statistics:`);
                completedDistillation.addLog(`   • Original content: ${text.length.toLocaleString()} chars`);
                completedDistillation.addLog(`   • Distilled content: ${distillationContent.length.toLocaleString()} chars`);
                completedDistillation.addLog(`   • Word count: ${wordCount.toLocaleString()} words`);
                completedDistillation.addLog(`   • Processing time: ${processingTime.toFixed(2)}s`);
                completedDistillation.addLog(`   • Compression: ${((1 - distillationContent.length / text.length) * 100).toFixed(1)}%`);
                completedDistillation.addLog(`🎯 Ready for review and export`);
                await database.saveDistillation(completedDistillation);

                return { success: true };
            } catch (error) {
                console.error(`[${distillation.id}] Error processing URL ${url}:`, error);

                // Add detailed error logging
                const errorDistillation = await database.getDistillation(distillation.id);
                if (errorDistillation) {
                    errorDistillation.addLog(`❌ Processing failed with error`, 'error');
                    errorDistillation.addLog(`🔍 Error type: ${error.constructor.name}`, 'error');
                    errorDistillation.addLog(`📝 Error message: ${error.message}`, 'error');
                    errorDistillation.addLog(`📊 Processing time before error: ${((Date.now() - startTime) / 1000).toFixed(2)}s`, 'error');

                    if (error.stack) {
                        const stackLines = error.stack.split('\n').slice(0, 3);
                        errorDistillation.addLog(`🔧 Stack trace: ${stackLines.join(' → ')}`, 'error');
                    }

                    await database.saveDistillation(errorDistillation);
                }

                await database.updateDistillationStatus(
                    distillation.id,
                    'error',
                    `Error: ${error.message}`,
                    error.message
                );
                return { success: false, error: error.message };
            }
        });

        return distillation;
    }

    /**
     * Process a YouTube playlist by extracting individual videos and processing each one
     * @param {string} playlistUrl - The YouTube playlist URL
     * @returns {Promise<Distillation>} - The created distillation object for tracking
     */
    async processYoutubePlaylist(playlistUrl) {
        console.log(`Processing YouTube playlist: ${playlistUrl}`);

        // Create a tracking distillation for the playlist processing
        const trackingDistillation = new Distillation({
            title: 'Processing YouTube Playlist...',
            sourceUrl: playlistUrl,
            sourceType: 'youtube',
            status: 'initializing',
            processingStep: 'Extracting playlist videos',
            startTime: new Date()
        });

        trackingDistillation.addLog(`Starting playlist processing: ${playlistUrl}`);
        await database.saveDistillation(trackingDistillation);

        // Start processing in background
        this.processInBackground(trackingDistillation.id, async () => {
            try {
                // Update status
                await database.updateDistillationStatus(
                    trackingDistillation.id,
                    'extracting',
                    'Extracting video URLs from playlist'
                );

                // Extract playlist videos using a simple approach
                const videoUrls = await this.extractPlaylistVideos(playlistUrl);

                if (!videoUrls || videoUrls.length === 0) {
                    throw new Error('No videos found in playlist. The playlist may be private or empty.');
                }

                console.log(`[${trackingDistillation.id}] Found ${videoUrls.length} videos in playlist`);

                // Update status
                await database.updateDistillationStatus(
                    trackingDistillation.id,
                    'distilling',
                    `Processing ${videoUrls.length} videos from playlist`
                );

                // Process each video individually
                const processedVideos = [];
                for (let i = 0; i < videoUrls.length; i++) {
                    const videoUrl = videoUrls[i];
                    console.log(`[${trackingDistillation.id}] Processing video ${i + 1}/${videoUrls.length}: ${videoUrl}`);

                    try {
                        // Create individual video distillation
                        const videoDistillation = await this.processUrl(videoUrl);
                        processedVideos.push(videoDistillation);

                        // Update progress
                        await database.updateDistillationStatus(
                            trackingDistillation.id,
                            'distilling',
                            `Processed ${i + 1}/${videoUrls.length} videos from playlist`
                        );
                    } catch (error) {
                        console.error(`[${trackingDistillation.id}] Error processing video ${videoUrl}:`, error);
                        // Continue with other videos even if one fails
                    }
                }

                // Delete the tracking distillation since all individual videos are now processed
                await database.deleteDistillation(trackingDistillation.id);
                console.log(`[${trackingDistillation.id}] Playlist processing completed and tracking distillation deleted. Successfully processed ${processedVideos.length} out of ${videoUrls.length} videos.`);

                return { success: true, processedVideos: processedVideos.length };
            } catch (error) {
                console.error(`[${trackingDistillation.id}] Error processing playlist ${playlistUrl}:`, error);
                await database.updateDistillationStatus(
                    trackingDistillation.id,
                    'error',
                    `Error: ${error.message}`,
                    error.message
                );
                return { success: false, error: error.message };
            }
        });

        return trackingDistillation;
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

            // Extract playlist videos using direct HTTP request

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
     * Process a file for distillation
     * @param {Object} file - The uploaded file object
     * @returns {Promise<Distillation>} - The created distillation object
     */
    async processFile(file) {
        console.log(`Starting file processing: ${file.originalname} (${file.size} bytes)`);

        // Create initial distillation record
        const distillation = new Distillation({
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

        // Add initial log with file information
        distillation.addLog(`🚀 Starting processing of file: ${file.originalname}`);
        distillation.addLog(`📋 Process ID: ${distillation.id}`);
        distillation.addLog(`⏰ Started at: ${new Date().toISOString()}`);
        distillation.addLog(`📄 File details:`);
        distillation.addLog(`   • Name: ${file.originalname}`);
        distillation.addLog(`   • Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
        distillation.addLog(`   • Type: ${file.mimetype}`);

        // Save initial record to database
        await database.saveDistillation(distillation);

        // Start processing in background
        this.processInBackground(distillation.id, async () => {
            try {
                const startTime = Date.now();
                const distillationObj = await database.getDistillation(distillation.id);

                distillationObj.addLog(`🔄 Background processing started`);
                distillationObj.addLog(`📊 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);

                // Update status to extracting
                await database.updateDistillationStatus(
                    distillation.id,
                    'extracting',
                    `Extracting content from ${file.originalname}`
                );

                distillationObj.addLog(`🔍 Phase 1: Content Extraction`);
                distillationObj.addLog(`📁 Processing file: ${file.originalname}`);
                distillationObj.addLog(`⏱️ Extraction timeout: 5 minutes`);
                await database.saveDistillation(distillationObj);

                console.log(`[${distillation.id}] Extracting content from file: ${file.originalname}`);

                // Extract content with timeout
                const extractionPromise = contentExtractor.extractFromFile(file);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('File extraction timed out after 5 minutes')), 5 * 60 * 1000)
                );

                const extractionResult = await Promise.race([extractionPromise, timeoutPromise]);
                const { text, title, contentType, extractionMethod, fallbackUsed, metadata } = extractionResult;

                console.log(`[${distillation.id}] File content extracted successfully. Content length: ${text.length} chars`);
                console.log(`[${distillation.id}] Extraction details - Method: ${extractionMethod}, Type: ${contentType}, Fallback used: ${fallbackUsed}`);

                // Update status to distilling
                await database.updateDistillationStatus(
                    distillation.id,
                    'distilling',
                    'Generating distillation with AI provider'
                );

                // Store raw content and enhanced extraction metadata
                distillationObj.rawContent = text;
                if (title !== distillation.title) {
                    distillationObj.title = title;
                }
                distillationObj.extractionMetadata = {
                    contentType,
                    extractionMethod,
                    fallbackUsed,
                    ...metadata
                };
                await database.saveDistillation(distillationObj);

                console.log(`[${distillation.id}] Starting distillation with AI provider`);

                // Get current AI provider and generate distillation
                const aiProvider = await this.getCurrentAIProvider();
                const distillationContent = await aiProvider.generateSummary(text);

                console.log(`[${distillation.id}] Distillation generated successfully. Length: ${distillationContent.length} chars`);

                // Calculate processing time and word count
                const processingTime = (Date.now() - startTime) / 1000;
                const wordCount = distillationContent.split(/\s+/).length;

                console.log(`[${distillation.id}] Processing completed in ${processingTime.toFixed(2)}s. Word count: ${wordCount}`);

                // Update distillation in database
                await database.updateDistillationContent(
                    distillation.id,
                    distillationContent,
                    text,
                    processingTime,
                    wordCount
                );

                // Update title if needed
                if (title !== distillation.title) {
                    await this.updateDistillationTitle(distillation.id, title);
                }

                // Clean up temporary file
                try {
                    await fs.unlink(file.path);
                    console.log(`[${distillation.id}] Temporary file deleted: ${file.path}`);
                } catch (err) {
                    console.warn(`[${distillation.id}] Failed to delete temporary file:`, err);
                }

                return { success: true };
            } catch (error) {
                console.error(`[${distillation.id}] Error processing file ${file.originalname}:`, error);

                // Add detailed error logging
                const errorDistillation = await database.getDistillation(distillation.id);
                if (errorDistillation) {
                    errorDistillation.addLog(`❌ File processing failed with error`, 'error');
                    errorDistillation.addLog(`🔍 Error type: ${error.constructor.name}`, 'error');
                    errorDistillation.addLog(`📝 Error message: ${error.message}`, 'error');
                    errorDistillation.addLog(`📊 Processing time before error: ${((Date.now() - startTime) / 1000).toFixed(2)}s`, 'error');
                    errorDistillation.addLog(`📁 File: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)} MB)`, 'error');

                    if (error.stack) {
                        const stackLines = error.stack.split('\n').slice(0, 3);
                        errorDistillation.addLog(`🔧 Stack trace: ${stackLines.join(' → ')}`, 'error');
                    }

                    await database.saveDistillation(errorDistillation);
                }

                await database.updateDistillationStatus(
                    distillation.id,
                    'error',
                    `Error: ${error.message}`,
                    error.message
                );

                // Clean up temporary file even on error
                try {
                    await fs.unlink(file.path);
                    console.log(`[${distillation.id}] Temporary file deleted after error: ${file.path}`);

                    if (errorDistillation) {
                        errorDistillation.addLog(`🧹 Temporary file cleaned up: ${file.path}`);
                        await database.saveDistillation(errorDistillation);
                    }
                } catch (err) {
                    console.warn(`[${distillation.id}] Failed to delete temporary file:`, err);
                    if (errorDistillation) {
                        errorDistillation.addLog(`⚠️ Failed to clean up temporary file: ${err.message}`, 'warn');
                        await database.saveDistillation(errorDistillation);
                    }
                }

                return { success: false, error: error.message };
            }
        });

        return distillation;
    }

    /**
     * Process a task in the background
     * @param {string} distillationId - The ID of the distillation to process
     * @param {Function} processFn - The function to execute
     */
    async processInBackground(distillationId, processFn) {
        // Use the processing queue to manage concurrent processing
        try {
            await processingQueue.addToQueue(distillationId, async () => {
                try {
                    await processFn();
                } catch (error) {
                    console.error(`Background processing error for distillation ${distillationId}:`, error);
                    await database.updateDistillationStatus(distillationId, 'error', error.message);
                    throw error; // Re-throw to be handled by queue
                }
            });
        } catch (error) {
            console.error(`Failed to add distillation ${distillationId} to processing queue:`, error);
        }
    }

    /**
     * Update the title of a distillation
     * @param {string} distillationId - The ID of the distillation to update
     * @param {string} title - The new title
     */
    async updateDistillationTitle(distillationId, title) {
        try {
            const distillation = await database.getDistillation(distillationId);
            if (distillation) {
                distillation.title = title;
                await database.saveDistillation(distillation);
            }
        } catch (error) {
            console.error(`Error updating distillation title ${distillationId}:`, error);
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
     * Generate a PDF from a distillation
     * @param {string} distillationId - The ID of the distillation to convert
     * @returns {Promise<{buffer: Buffer, filename: string}>} - The PDF buffer and filename
     */
    async generatePdf(distillationId) {
        try {
            const distillation = await database.getDistillation(distillationId);
            if (!distillation) {
                throw new Error('Distillation not found');
            }

            if (distillation.status !== 'completed') {
                throw new Error('Distillation is not yet completed');
            }

            // Generate PDF for distillation

            const puppeteer = require('puppeteer');

            // Launch browser
            const browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();

            // Create HTML content with beautiful styling
            const htmlContent = this.createPdfHtml(distillation);

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
            const filename = this.generatePdfFilename(distillation.title);

            // PDF generated successfully
            return { buffer: pdfBuffer, filename };

        } catch (error) {
            console.error(`Error generating PDF for distillation ${distillationId}:`, error);
            throw new Error(`PDF generation failed: ${error.message}`);
        }
    }

    /**
     * Create HTML content for PDF generation
     * @param {Distillation} distillation - The distillation object
     * @returns {string} - HTML content
     */
    createPdfHtml(distillation) {
        const formattedDate = new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(distillation.createdAt);

        // Convert markdown to HTML
        const contentHtml = this.markdownToHtml(distillation.content || '');

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${distillation.title}</title>
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
                <h1 class="title">${distillation.title}</h1>
                <div class="meta">
                    ${distillation.sourceUrl ? `<strong>Source:</strong> ${distillation.sourceUrl}<br>` : ''}
                    ${distillation.sourceFile ? `<strong>Source:</strong> ${distillation.sourceFile.name}<br>` : ''}
                    <strong>Generated:</strong> ${formattedDate}<br>
                    ${distillation.wordCount ? `<strong>Word Count:</strong> ${distillation.wordCount} words<br>` : ''}
                    ${distillation.processingTime ? `<strong>Processing Time:</strong> ${distillation.processingTime.toFixed(1)}s<br>` : ''}
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
     * Generate a clean filename from the distillation title
     * @param {string} title - The distillation title
     * @returns {string} - Clean filename
     */
    generatePdfFilename(title) {
        if (!title) return 'distillation.pdf';

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
        if (!filename) filename = 'distillation';

        return `${filename}.pdf`;
    }

    /**
     * Stop a running distillation process
     * @param {string} distillationId - The ID of the distillation to stop
     * @returns {Promise<boolean>} - True if the process was stopped
     */
    async stopProcess(distillationId) {
        // Since we're using setTimeout for background processing,
        // we can't actually stop a running process.
        // In a real implementation with a job queue, you would cancel the job.

        // For now, just mark it as error/cancelled
        try {
            await database.updateDistillationStatus(distillationId, 'error', 'Process cancelled by user');
            return true;
        } catch (error) {
            console.error(`Error stopping process ${distillationId}:`, error);
            return false;
        }
    }
}

module.exports = new Processor();