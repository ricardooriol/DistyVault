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
const path = require('path');
const fs = require('fs').promises;

class Processor {
    constructor() {
        this.aiSettingsManager = new AISettingsManager();
    }

    /**
     * Get the current AI provider based on settings
     * @returns {Promise<AIProvider>} - Configured AI provider instance
     */
    async getCurrentAIProvider() {
        try {
            const config = this.aiSettingsManager.getCurrentProviderConfig();
            console.log(`Using AI provider: ${config.type} with model: ${config.model}`);
            return AIProviderFactory.createProvider(config);
        } catch (error) {
            console.warn(`Failed to create AI provider from settings: ${error.message}`);
            console.log('Falling back to Ollama with default settings');
            
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
        console.log(`Starting URL processing: ${url}`);

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
        // We're using a simple setTimeout to run the process asynchronously
        // In a production app, you might want to use a proper job queue
        setTimeout(async () => {
            try {
                await processFn();
            } catch (error) {
                console.error(`Background processing error for summary ${summaryId}:`, error);
                await database.updateSummaryStatus(summaryId, 'error', error.message);
            }
        }, 0);
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
                return 'playlist';
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
     * @returns {Promise<Buffer>} - The PDF buffer
     */
    async generatePdf(summaryId) {
        // TODO: Implement PDF generation
        throw new Error('PDF generation not yet implemented');
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