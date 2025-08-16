/**
 * Processor service for DistyVault
 * Orchestrates the content extraction, distillation, and storage process
 */
const contentExtractor = require('./contentExtractor');
const ollamaService = require('./ollama');
const database = require('./database');
const Distillation = require('./distillation');
const AIProviderFactory = require('./ai/aiProviderFactory');
const AISettingsManager = require('./ai/aiSettingsManager');
const processingQueue = require('./processingQueue');
const path = require('path');
const fs = require('fs').promises;

class Processor {
    constructor() {
        this.aiSettingsManager = AISettingsManager.getInstance();
        this.initializeProcessingQueue();
        // Track active processes for cancellation
        this.activeProcesses = new Map(); // distillationId -> { cancelled: boolean, abortController: AbortController }
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
     * Check if a distillation process has been stopped or cancelled
     * @param {string} distillationId - The ID to check
     * @returns {Promise<boolean>} - True if the process has been stopped
     */
    async isProcessStopped(distillationId) {
        try {
            // First check our active processes tracking (fastest)
            const processInfo = this.activeProcesses.get(distillationId);
            if (processInfo && processInfo.cancelled) {
                console.log(`[${distillationId}] PROCESS CANCELLED - STOPPING IMMEDIATELY`);
                return true;
            }

            // Then check database status
            const distillation = await database.getDistillation(distillationId);
            const isStopped = distillation && distillation.status === 'stopped';

            if (isStopped) {
                console.log(`[${distillationId}] PROCESS STOPPED IN DATABASE - STOPPING IMMEDIATELY`);
                // Also mark as cancelled in our tracking
                if (processInfo) {
                    processInfo.cancelled = true;
                }
            }

            return isStopped;
        } catch (error) {
            console.error(`Error checking if process ${distillationId} is stopped:`, error);
            return false;
        }
    }

    /**
     * Throw an error if the process has been cancelled
     * @param {string} distillationId - The ID to check
     */
    async throwIfCancelled(distillationId) {
        if (await this.isProcessStopped(distillationId)) {
            throw new Error(`Process ${distillationId} was cancelled by user`);
        }
    }    /**

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
            status: 'pending',
            processingStep: 'Queued for processing'
        });

        // Add initial log with system information
        distillation.addLog(`🚀 Starting processing of URL: ${url}`);
        distillation.addLog(`📋 Process ID: ${distillation.id}`);
        distillation.addLog(`⏰ Started at: ${new Date().toISOString()}`);
        distillation.addLog(`🌐 User Agent: ${process.env.USER_AGENT || 'DistyVault/1.0'}`);

        // Save initial record to database
        await database.saveDistillation(distillation);

        // Start processing in background
        this.processInBackground(distillation.id, async () => {
            try {
                const startTime = Date.now();
                const distillationObj = await database.getDistillation(distillation.id);

                if (!distillationObj) {
                    throw new Error(`Distillation object not found for ID: ${distillation.id}`);
                }

                // Update status to initializing and set actual start time when background processing begins
                await database.updateDistillationStatus(
                    distillation.id,
                    'extracting',
                    'Extracting content from URL'
                );

                // Set the actual start time when processing begins (not when queued)
                distillationObj.startTime = new Date(startTime);
                await database.saveDistillation(distillationObj);

                distillationObj.addLog(`🔄 Background processing started`);
                distillationObj.addLog(`📊 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);

                // Check if process has been stopped
                if (await this.isProcessStopped(distillation.id)) {
                    console.log(`[${distillation.id}] Process stopped during initialization`);
                    return { success: false, stopped: true };
                }

                // Delay to ensure frontend can see the extracting status
                await new Promise(resolve => setTimeout(resolve, 2000));

                distillationObj.addLog(`🔍 Phase 1: Content Extraction`);
                distillationObj.addLog(`🌐 Target URL: ${url}`);
                distillationObj.addLog(`⏱️ Extraction timeout: 5 minutes`);
                // Status already set to 'extracting' by updateDistillationStatus above

                // Extracting content from URL

                // Extract content with timeout AND cancellation checking
                const extractionPromise = contentExtractor.extractFromUrl(url);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Content extraction timed out after 5 minutes')), 5 * 60 * 1000)
                );

                // Add periodic cancellation checking during extraction
                const cancellationChecker = setInterval(async () => {
                    if (await this.isProcessStopped(distillation.id)) {
                        console.log(`[${distillation.id}] CANCELLATION DETECTED DURING EXTRACTION - THROWING ERROR`);
                        clearInterval(cancellationChecker);
                        throw new Error(`Process ${distillation.id} was cancelled by user`);
                    }
                }, 500); // Check every 500ms

                let extractionResult;
                try {
                    extractionResult = await Promise.race([extractionPromise, timeoutPromise]);
                    clearInterval(cancellationChecker);
                } catch (error) {
                    clearInterval(cancellationChecker);
                    throw error;
                }

                // Check if process has been stopped immediately after extraction
                if (await this.isProcessStopped(distillation.id)) {
                    console.log(`[${distillation.id}] Process stopped during content extraction`);
                    return { success: false, stopped: true };
                }

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

                // Content extracted successfully

                // Check if process has been stopped after extraction
                if (await this.isProcessStopped(distillation.id)) {
                    console.log(`[${distillation.id}] Process stopped after extraction`);
                    return { success: false, stopped: true };
                }

                // Delay to ensure frontend can see the extracting status
                await new Promise(resolve => setTimeout(resolve, 3000));

                // Update status to distilling
                await database.updateDistillationStatus(
                    distillation.id,
                    'distilling',
                    'Generating distillation with AI provider'
                );
                // Delay to ensure frontend can see the distilling status
                await new Promise(resolve => setTimeout(resolve, 2000));

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
                // Status already set to 'distilling' by updateDistillationStatus above

                // Check if process has been stopped before AI distillation
                await this.throwIfCancelled(distillation.id);

                // Add periodic cancellation checking during AI distillation
                const aiCancellationChecker = setInterval(async () => {
                    if (await this.isProcessStopped(distillation.id)) {
                        console.log(`[${distillation.id}] CANCELLATION DETECTED DURING AI DISTILLATION - THROWING ERROR`);
                        clearInterval(aiCancellationChecker);
                        throw new Error(`Process ${distillation.id} was cancelled by user`);
                    }
                }, 500); // Check every 500ms

                let distillationContent;
                try {
                    // Add timeout wrapper for AI generation
                    const aiGenerationPromise = aiProvider.generateSummary(text);
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('AI distillation timed out after 10 minutes')), 10 * 60 * 1000)
                    );

                    distillationContent = await Promise.race([aiGenerationPromise, timeoutPromise]);
                    clearInterval(aiCancellationChecker);

                    // Validate that we got actual content
                    if (!distillationContent || typeof distillationContent !== 'string' || distillationContent.trim().length < 10) {
                        throw new Error('AI provider returned empty or invalid content');
                    }

                    distillationObj.addLog(`✅ AI distillation completed successfully`);
                    distillationObj.addLog(`📝 Generated content length: ${distillationContent.length} characters`);

                } catch (error) {
                    clearInterval(aiCancellationChecker);

                    // Enhanced error logging for AI failures
                    distillationObj.addLog(`❌ AI distillation failed: ${error.message}`, 'error');

                    if (error.message.includes('timeout')) {
                        distillationObj.addLog(`⏰ AI processing exceeded 10-minute timeout`, 'error');
                    } else if (error.message.includes('API key')) {
                        distillationObj.addLog(`🔑 API key issue - check AI provider configuration`, 'error');
                    } else if (error.message.includes('rate limit')) {
                        distillationObj.addLog(`🚦 API rate limit exceeded - try again later`, 'error');
                    }

                    await database.saveDistillation(distillationObj);
                    throw error;
                }

                // Check if process has been stopped after AI distillation
                await this.throwIfCancelled(distillation.id);

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

                if (completedDistillation) {
                    completedDistillation.addLog(`✅ Processing completed successfully`);
                    completedDistillation.addLog(`📊 Final statistics:`);
                    completedDistillation.addLog(`   • Original content: ${text.length.toLocaleString()} chars`);
                    completedDistillation.addLog(`   • Distilled content: ${distillationContent.length.toLocaleString()} chars`);
                    completedDistillation.addLog(`   • Word count: ${wordCount.toLocaleString()} words`);
                    completedDistillation.addLog(`   • Processing time: ${processingTime.toFixed(2)}s`);
                    completedDistillation.addLog(`   • Compression: ${((1 - distillationContent.length / text.length) * 100).toFixed(1)}%`);
                    completedDistillation.addLog(`🎯 Ready for review and export`);
                    await database.saveDistillation(completedDistillation);
                }

                return { success: true };
            } catch (error) {
                console.error(`[${distillation.id}] Error processing URL ${url}:`, error);

                // Check if this is a cancellation error - don't override stopped status
                if (error.message && error.message.includes('cancelled by user')) {
                    console.log(`[${distillation.id}] Process was cancelled by user - keeping stopped status`);
                    return { success: false, stopped: true };
                }

                // Add detailed error logging
                const errorDistillation = await database.getDistillation(distillation.id);
                if (errorDistillation) {
                    errorDistillation.addLog(`❌ Processing failed with error`, 'error');
                    errorDistillation.addLog(`🔍 Error type: ${error.constructor.name}`, 'error');
                    errorDistillation.addLog(`📝 Error message: ${error.message}`, 'error');

                    // Calculate processing time if startTime is available
                    const processingTime = errorDistillation.startTime ?
                        ((Date.now() - new Date(errorDistillation.startTime).getTime()) / 1000).toFixed(2) :
                        'unknown';
                    errorDistillation.addLog(`📊 Processing time before error: ${processingTime}s`, 'error');

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
            status: 'pending',
            processingStep: 'Queued for processing'
        });

        trackingDistillation.addLog(`Starting playlist processing: ${playlistUrl}`);
        await database.saveDistillation(trackingDistillation);

        // Start processing in background
        this.processInBackground(trackingDistillation.id, async () => {
            try {
                // Update status to initializing when background processing starts
                await database.updateDistillationStatus(
                    trackingDistillation.id,
                    'extracting',
                    'Extracting video URLs from playlist'
                );

                // Update status to extracting
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

                // Process each video individually with proper ordering
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

                        // Add a small delay to ensure proper timestamp ordering
                        // This ensures that videos are processed in the correct order
                        if (i < videoUrls.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
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
    }    /**

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
            status: 'pending',
            processingStep: 'Queued for processing'
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

                if (!distillationObj) {
                    throw new Error(`Distillation object not found for ID: ${distillation.id}`);
                }

                // Update status to initializing when background processing starts
                await database.updateDistillationStatus(
                    distillation.id,
                    'extracting',
                    `Extracting content from ${file.originalname}`
                );

                // Set the actual start time when processing begins (not when queued)
                distillationObj.startTime = new Date(startTime);
                await database.saveDistillation(distillationObj);

                distillationObj.addLog(`🔄 Background processing started`);
                distillationObj.addLog(`📊 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);

                // Check if process has been stopped
                if (await this.isProcessStopped(distillation.id)) {
                    console.log(`[${distillation.id}] Process stopped during initialization`);
                    return { success: false, stopped: true };
                }

                // Delay to ensure frontend can see the extracting status
                await new Promise(resolve => setTimeout(resolve, 2000));

                distillationObj.addLog(`🔍 Phase 1: File Content Extraction`);
                distillationObj.addLog(`📄 File: ${file.originalname}`);
                distillationObj.addLog(`📊 Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
                distillationObj.addLog(`🔧 Type: ${file.mimetype}`);

                // Extract content from file
                const extractionResult = await contentExtractor.extractFromFile(file);

                // Check if process has been stopped after extraction
                if (await this.isProcessStopped(distillation.id)) {
                    console.log(`[${distillation.id}] Process stopped after file extraction`);
                    return { success: false, stopped: true };
                }

                const { text, title, contentType, extractionMethod, fallbackUsed, metadata } = extractionResult;

                const extractionTime = Date.now() - startTime;
                const updatedDistillation = await database.getDistillation(distillation.id);

                updatedDistillation.addLog(`✅ File extraction completed in ${(extractionTime / 1000).toFixed(2)}s`);
                updatedDistillation.addLog(`📄 Title: "${title}"`);
                updatedDistillation.addLog(`📝 Content length: ${text.length.toLocaleString()} characters`);
                updatedDistillation.addLog(`🔧 Extraction method: ${extractionMethod}`);
                updatedDistillation.addLog(`📋 Content type: ${contentType}`);
                updatedDistillation.addLog(`🔄 Fallback used: ${fallbackUsed ? 'Yes' : 'No'}`);

                if (metadata) {
                    if (metadata.fileName) updatedDistillation.addLog(`📄 File name: ${metadata.fileName}`);
                    if (metadata.fileSize) updatedDistillation.addLog(`📊 File size: ${(metadata.fileSize / 1024 / 1024).toFixed(2)} MB`);
                    if (metadata.fileType) updatedDistillation.addLog(`🔧 File type: ${metadata.fileType}`);
                }

                await database.saveDistillation(updatedDistillation);

                // Check if process has been stopped before AI distillation
                if (await this.isProcessStopped(distillation.id)) {
                    console.log(`[${distillation.id}] Process stopped before AI distillation`);
                    return { success: false, stopped: true };
                }

                // Delay to ensure frontend can see the extracting status
                await new Promise(resolve => setTimeout(resolve, 3000));

                // Update status to distilling
                await database.updateDistillationStatus(
                    distillation.id,
                    'distilling',
                    'Generating distillation with AI provider'
                );

                // Delay to ensure frontend can see the distilling status
                await new Promise(resolve => setTimeout(resolve, 2000));

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

                // Check if process has been stopped before AI distillation
                await this.throwIfCancelled(distillation.id);

                // Generate distillation using AI provider
                const distillationContent = await aiProvider.generateSummary(text);

                // Validate that we got actual content
                if (!distillationContent || typeof distillationContent !== 'string' || distillationContent.trim().length < 10) {
                    throw new Error('AI provider returned empty or invalid content');
                }

                distillationObj.addLog(`✅ AI distillation completed successfully`);
                distillationObj.addLog(`📝 Generated content length: ${distillationContent.length} characters`);

                // Check if process has been stopped after AI distillation
                await this.throwIfCancelled(distillation.id);

                // Calculate processing time and word count
                const processingTime = (Date.now() - startTime) / 1000;
                const wordCount = distillationContent.split(/\s+/).length;

                console.log(`[${distillation.id}] File processing completed in ${processingTime.toFixed(2)}s. Word count: ${wordCount}`);

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

                if (completedDistillation) {
                    completedDistillation.addLog(`✅ Processing completed successfully`);
                    completedDistillation.addLog(`📊 Final statistics:`);
                    completedDistillation.addLog(`   • Original content: ${text.length.toLocaleString()} chars`);
                    completedDistillation.addLog(`   • Distilled content: ${distillationContent.length.toLocaleString()} chars`);
                    completedDistillation.addLog(`   • Word count: ${wordCount.toLocaleString()} words`);
                    completedDistillation.addLog(`   • Processing time: ${processingTime.toFixed(2)}s`);
                    completedDistillation.addLog(`   • Compression: ${((1 - distillationContent.length / text.length) * 100).toFixed(1)}%`);
                    completedDistillation.addLog(`🎯 Ready for review and export`);
                    await database.saveDistillation(completedDistillation);
                }

                return { success: true };
            } catch (error) {
                console.error(`[${distillation.id}] Error processing file ${file.originalname}:`, error);

                // Check if this is a cancellation error - don't override stopped status
                if (error.message && error.message.includes('cancelled by user')) {
                    console.log(`[${distillation.id}] Process was cancelled by user - keeping stopped status`);
                    return { success: false, stopped: true };
                }

                // Add detailed error logging
                const errorDistillation = await database.getDistillation(distillation.id);
                if (errorDistillation) {
                    errorDistillation.addLog(`❌ Processing failed with error`, 'error');
                    errorDistillation.addLog(`🔍 Error type: ${error.constructor.name}`, 'error');
                    errorDistillation.addLog(`📝 Error message: ${error.message}`, 'error');

                    // Calculate processing time if startTime is available
                    const processingTime = errorDistillation.startTime ?
                        ((Date.now() - new Date(errorDistillation.startTime).getTime()) / 1000).toFixed(2) :
                        'unknown';
                    errorDistillation.addLog(`📊 Processing time before error: ${processingTime}s`, 'error');

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
    }    /**
 
    * Process a task in the background using the processing queue
     * @param {string} id - Unique identifier for the task
     * @param {Function} processingFunction - Async function to execute
     */
    processInBackground(id, processingFunction) {
        // Track this process for cancellation
        this.activeProcesses.set(id, { cancelled: false });

        // Add to processing queue
        processingQueue.addToQueue(id, processingFunction)
            .then(result => {
                console.log(`[${id}] Background processing completed:`, result);
            })
            .catch(error => {
                console.error(`[${id}] Background processing failed:`, error);
            })
            .finally(() => {
                // Clean up tracking
                this.activeProcesses.delete(id);
            });
    }

    /**
     * Stop a processing task
     * @param {string} id - The distillation ID to stop
     * @returns {Promise<boolean>} - True if stopped successfully
     */
    async stopProcessing(id) {
        try {
            console.log(`[${id}] Stopping processing...`);

            // Remove from processing queue if it's there
            const removedFromQueue = processingQueue.removeFromQueue(id);
            if (removedFromQueue) {
                console.log(`[${id}] Removed from processing queue`);
            }

            // Mark as cancelled in our tracking
            const processInfo = this.activeProcesses.get(id);
            if (processInfo) {
                processInfo.cancelled = true;
                console.log(`[${id}] Marked as cancelled in active processes`);

                // Clean up the process info
                this.activeProcesses.delete(id);
            }

            // Update database status
            await database.updateDistillationStatus(id, 'stopped', 'Processing stopped by user');
            console.log(`[${id}] Database status updated to stopped`);

            return true;
        } catch (error) {
            console.error(`[${id}] Error stopping processing:`, error);
            return false;
        }
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

            await browser.close();

            // Generate filename from title with ID for uniqueness
            const filename = this.generatePdfFilename(distillation.title, distillationId);

            return { buffer: pdfBuffer, filename };

        } catch (error) {
            console.error(`Error generating PDF for distillation ${distillationId}:`, error);
            throw new Error(`PDF generation failed: ${error.message}`);
        }
    }

    /**
     * Generate a clean filename from the distillation title
     * @param {string} title - The distillation title
     * @param {string} distillationId - The distillation ID for uniqueness
     * @returns {string} - Clean filename
     */
    generatePdfFilename(title, distillationId) {
        if (!title) return `distillation-${distillationId}.pdf`;

        // Clean the title for use as filename
        let filename = title
            .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
            .toLowerCase()
            .substring(0, 80); // Limit to 80 characters

        // Remove leading/trailing hyphens
        filename = filename.replace(/^-+|-+$/g, '');

        // Ensure it's not empty
        if (!filename) filename = 'distillation';

        // Add distillation ID to ensure uniqueness
        return `${filename}-${distillationId}.pdf`;
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

        // Convert content to HTML with basic formatting
        const contentHtml = this.formatContent(distillation.content || '');

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
                
                .content h1, .content h2, .content h3 {
                    color: #007acc;
                    margin-top: 25px;
                    margin-bottom: 15px;
                }
                
                .content p {
                    margin-bottom: 15px;
                    text-align: justify;
                }
                
                .content strong {
                    font-weight: bold;
                    font-weight: 700;
                    color: #333;
                }
                
                .content br {
                    line-height: 2;
                    margin: 10px 0;
                }
                
                .content ul, .content ol {
                    margin-bottom: 15px;
                    padding-left: 25px;
                }
                
                .content li {
                    margin-bottom: 8px;
                }
                
                .footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #ddd;
                    font-size: 12px;
                    color: #666;
                    text-align: center;
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
                💠 Distilled by DistyVault 💠
            </div>
        </body>
        </html>
        `;
    }

    /**
     * Format content for HTML display
     * @param {string} content - Content to format
     * @returns {string} - Formatted HTML content
     */
    formatContent(content) {
        if (!content) return '';

        // Check if content is already HTML formatted (contains HTML tags)
        if (content.includes('<p>') && content.includes('<strong>')) {
            // Content is already HTML formatted from NumberingProcessor
            return content;
        }

        // Fallback: Simple formatting for plain text content
        return content
            .split('\n\n')
            .map(paragraph => paragraph.trim())
            .filter(paragraph => paragraph.length > 0)
            .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
            .join('');
    }

    /**
     * Detect URL type for categorization
     * @param {string} url - The URL to analyze
     * @returns {string} - URL type
     */
    detectUrlType(url) {
        if (contentExtractor.isYoutubeUrl(url)) {
            return 'youtube';
        }
        return 'url';
    }

    /**
     * Update distillation title in database
     * @param {string} id - Distillation ID
     * @param {string} title - New title
     */
    async updateDistillationTitle(id, title) {
        try {
            const distillation = await database.getDistillation(id);
            if (distillation) {
                distillation.title = title;
                await database.saveDistillation(distillation);
            }
        } catch (error) {
            console.error(`Error updating title for ${id}:`, error);
        }
    }

    /**
     * Get processing queue status
     * @returns {Object} - Queue status information
     */
    getQueueStatus() {
        return processingQueue.getStatus();
    }

    /**
     * Clear the processing queue
     */
    clearQueue() {
        processingQueue.clearQueue();
    }
}

module.exports = new Processor();