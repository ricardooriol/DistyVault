/**
 * ApiClient - Client-side API for DistyVault using IndexedDB + sql.js
 */
class ApiClient {
    constructor() {
        this.database = new Database();
        this.processor = new Processor();
        this.aiService = new AIService();
    }

    // Client-side methods that replace server API calls

    /**
     * Get all summaries/distillations
     */
    async getSummaries() {
        return await this.database.getAllSummaries();
    }

    /**
     * Get single summary by ID
     */
    async getSummary(id) {
        const summary = await this.database.getDistillation(id);
        if (!summary) {
            throw new Error('Distillation not found');
        }
        return summary;
    }

    /**
     * Delete summary by ID
     */
    async deleteSummary(id) {
        const success = await this.database.deleteDistillation(id);
        if (!success) {
            throw new Error('Distillation not found');
        }
        return { status: 'ok' };
    }

    /**
     * Retry distillation by ID
     */
    async retryDistillation(id) {
        const distillation = await this.database.getDistillation(id);
        if (!distillation) {
            throw new Error('Distillation not found');
        }

        // Delete the old distillation
        await this.database.deleteDistillation(id);

        // Create new distillation for retry
        let result;
        if (distillation.sourceUrl) {
            result = await this.processor.processUrl(distillation.sourceUrl);
        } else if (distillation.sourceFile) {
            // For file retries, we'll need to handle this differently
            // since we don't have the original file object
            throw new Error('File retry not supported in client-side mode');
        } else {
            throw new Error('Cannot determine how to retry this distillation');
        }

        return {
            status: 'ok',
            message: 'Distillation retry initiated successfully',
            newId: result.id
        };
    }

    /**
     * Stop processing by ID
     */
    async stopProcessing(id) {
        // In client-side mode, we can't really "stop" processing
        // but we can mark it as cancelled
        await this.database.updateDistillationStatus(id, 'cancelled', 'Processing cancelled by user');
        return { status: 'ok', message: 'Process cancelled' };
    }

    /**
     * Download PDF by ID
     */
    async downloadPdf(id, options = {}) {
        const result = await this.processor.generatePdf(id);
        const blob = new Blob([result.buffer], { type: 'text/plain' });
        
        return {
            blob: blob,
            headers: new Headers({
                'Content-Type': 'text/plain',
                'Content-Disposition': `attachment; filename="${result.filename}"`
            }),
            status: 200
        };
    }

    /**
     * Bulk download PDFs
     */
    async bulkDownload(ids, options = {}) {
        // For simplicity, create a ZIP-like text file with all content
        let combinedContent = '';
        
        for (const id of ids) {
            try {
                const distillation = await this.database.getDistillation(id);
                if (distillation && distillation.status === 'completed') {
                    combinedContent += `\n\n=== ${distillation.title} ===\n`;
                    combinedContent += `Source: ${distillation.sourceUrl || 'File'}\n`;
                    combinedContent += `Created: ${distillation.createdAt}\n\n`;
                    combinedContent += distillation.content;
                    combinedContent += '\n\n' + '='.repeat(50);
                }
            } catch (error) {
                console.error(`Error processing distillation ${id}:`, error);
            }
        }

        const blob = new Blob([combinedContent], { type: 'text/plain' });
        
        return {
            blob: blob,
            headers: new Headers({
                'Content-Type': 'text/plain',
                'Content-Disposition': 'attachment; filename="distyvault-download.txt"'
            }),
            status: 200
        };
    }

    /**
     * Bulk delete summaries
     */
    async bulkDelete(ids) {
        let deletedCount = 0;
        const errors = [];

        for (const id of ids) {
            try {
                const success = await this.database.deleteDistillation(id);
                if (success) {
                    deletedCount++;
                } else {
                    errors.push({ id, error: 'Distillation not found' });
                }
            } catch (error) {
                errors.push({ id, error: error.message });
            }
        }

        return { deletedCount, errors };
    }

    /**
     * Process URL
     */
    async processUrl(url) {
        return await this.processor.processUrl(url);
    }

    /**
     * Process uploaded file
     */
    async processFile(file) {
        return await this.processor.processFile(file);
    }

    /**
     * Get AI settings
     */
    async getAiSettings() {
        return this.aiService.config;
    }

    /**
     * Save AI settings
     */
    async saveAiSettings(settings) {
        this.aiService.saveConfig(settings);
        return { status: 'ok', message: 'Settings saved successfully' };
    }

    /**
     * Test AI provider
     */
    async testAiProvider(config) {
        return await this.aiService.testConnection(config);
    }

    /**
     * Validate AI configuration
     */
    async validateAiConfig(config) {
        // Basic validation
        if (config.mode === 'offline') {
            if (!config.ollamaEndpoint || !config.ollamaModel) {
                return { valid: false, message: 'Ollama configuration is incomplete' };
            }
        } else {
            if (!config.provider || !config.apiKey) {
                return { valid: false, message: 'Provider configuration is incomplete' };
            }
        }
        return { valid: true, message: 'Configuration is valid' };
    }

    /**
     * Test Ollama connection
     */
    async testOllamaConnection(config) {
        return await this.aiService.testOllamaConnection(config);
    }

    /**
     * Test AI provider connection
     */
    async testProviderConnection(config) {
        return await this.aiService.testProviderConnection(config);
    }

    /**
     * Update processing queue settings
     */
    async updateProcessingQueueSettings(settings) {
        if (settings.maxConcurrent) {
            this.processor.maxConcurrent = settings.maxConcurrent;
        }
        return { status: 'ok', message: 'Queue settings updated' };
    }

    /**
     * Check if server is responsive (always return true for client-side)
     */
    async isServerResponsive() {
        return true;
    }
}

// Export for use in other modules
window.ApiClient = ApiClient;