/**
 * Client-side Processing service for DistyVault
 * Handles content processing without backend dependencies
 */
class Processor {
    constructor() {
        this.database = new Database();
        this.aiService = new AIService();
        this.processingQueue = [];
        this.isProcessing = false;
        this.maxConcurrent = 1;
    }

    async processUrl(url) {
        const distillation = this.createDistillation({
            sourceUrl: url,
            sourceType: this.determineSourceType(url),
            title: this.extractTitleFromUrl(url)
        });

        await this.database.saveDistillation(distillation);
        this.addToQueue(distillation);
        
        return { id: distillation.id, status: 'queued' };
    }

    async processFile(file) {
        const distillation = this.createDistillation({
            sourceType: 'file',
            sourceFile: {
                name: file.name,
                type: file.type,
                size: file.size
            },
            title: file.name
        });

        await this.database.saveDistillation(distillation);
        this.addToQueue(distillation, file);
        
        return { id: distillation.id, status: 'queued' };
    }

    createDistillation(options) {
        return {
            id: this.generateId(),
            title: options.title || 'Untitled',
            content: '',
            sourceUrl: options.sourceUrl || null,
            sourceType: options.sourceType,
            sourceFile: options.sourceFile || null,
            status: 'queued',
            processingStep: 'Queued for processing',
            rawContent: '',
            createdAt: new Date(),
            completedAt: null,
            processingTime: 0,
            elapsedTime: 0,
            startTime: new Date(),
            distillingStartTime: null,
            wordCount: 0,
            error: null,
            logs: [],
            queuePosition: null
        };
    }

    generateId() {
        return 'dist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    determineSourceType(url) {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            return 'youtube';
        }
        return 'url';
    }

    extractTitleFromUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname + urlObj.pathname;
        } catch {
            return url;
        }
    }

    addToQueue(distillation, file = null) {
        this.processingQueue.push({ distillation, file });
        this.processQueue();
    }

    async processQueue() {
        if (this.isProcessing || this.processingQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        try {
            while (this.processingQueue.length > 0) {
                const { distillation, file } = this.processingQueue.shift();
                await this.processItem(distillation, file);
            }
        } finally {
            this.isProcessing = false;
        }
    }

    async processItem(distillation, file = null) {
        try {
            await this.database.updateDistillationStatus(
                distillation.id, 
                'processing', 
                'Extracting content...'
            );

            let rawContent = '';
            let title = distillation.title;

            if (distillation.sourceType === 'file' && file) {
                const result = await this.extractFileContent(file);
                rawContent = result.content;
                title = result.title || title;
            } else if (distillation.sourceUrl) {
                const result = await this.extractUrlContent(distillation.sourceUrl);
                rawContent = result.content;
                title = result.title || title;
            }

            if (!rawContent.trim()) {
                throw new Error('No content could be extracted');
            }

            // Update with extracted content
            distillation.rawContent = rawContent;
            distillation.title = title;
            await this.database.saveDistillation(distillation);

            // Start distillation
            await this.database.updateDistillationStatus(
                distillation.id, 
                'distilling', 
                'Processing with AI...'
            );

            const distilledContent = await this.aiService.distillContent(rawContent);
            const wordCount = distilledContent.split(/\s+/).length;

            await this.database.updateDistillationContent(
                distillation.id,
                distilledContent,
                rawContent,
                0, // Processing time - would need to track this properly
                wordCount
            );

            console.log(`Successfully processed distillation ${distillation.id}`);

        } catch (error) {
            console.error(`Error processing distillation ${distillation.id}:`, error);
            await this.database.updateDistillationStatus(
                distillation.id,
                'failed',
                'Processing failed',
                error.message
            );
        }
    }

    async extractFileContent(file) {
        const fileType = file.type.toLowerCase();
        
        if (fileType.includes('pdf')) {
            return await this.extractPdfContent(file);
        } else if (fileType.includes('text')) {
            return await this.extractTextContent(file);
        } else if (fileType.includes('word') || fileType.includes('document')) {
            return await this.extractDocxContent(file);
        } else {
            throw new Error(`Unsupported file type: ${fileType}`);
        }
    }

    async extractTextContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                resolve({
                    content: e.target.result,
                    title: file.name.replace(/\.[^/.]+$/, "")
                });
            };
            reader.onerror = () => reject(new Error('Failed to read text file'));
            reader.readAsText(file);
        });
    }

    async extractPdfContent(file) {
        // For now, return a placeholder - would need pdf.js or similar
        return {
            content: `PDF content extraction not yet implemented for: ${file.name}`,
            title: file.name.replace(/\.[^/.]+$/, "")
        };
    }

    async extractDocxContent(file) {
        // For now, return a placeholder - would need mammoth.js or similar
        return {
            content: `DOCX content extraction not yet implemented for: ${file.name}`,
            title: file.name.replace(/\.[^/.]+$/, "")
        };
    }

    async extractUrlContent(url) {
        // For client-side URL extraction, we're limited by CORS
        // This would typically require a proxy service or browser extension
        return {
            content: `URL content extraction requires server-side processing: ${url}`,
            title: this.extractTitleFromUrl(url)
        };
    }

    async generatePdf(distillationId) {
        const distillation = await this.database.getDistillation(distillationId);
        if (!distillation) {
            throw new Error('Distillation not found');
        }

        // For now, return a simple text representation
        // Would need jsPDF or similar for actual PDF generation
        const content = `
Title: ${distillation.title}
Source: ${distillation.sourceUrl || 'File'}
Created: ${distillation.createdAt}
Status: ${distillation.status}

Content:
${distillation.content}
        `;

        const blob = new Blob([content], { type: 'text/plain' });
        const buffer = await blob.arrayBuffer();
        
        return {
            buffer: new Uint8Array(buffer),
            filename: `${distillation.title.replace(/[^a-z0-9]/gi, '_')}.txt`
        };
    }
}

window.Processor = Processor;