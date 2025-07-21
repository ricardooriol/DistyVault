/**
 * Summary model for SAWRON
 * Represents a processed content summary with metadata
 */
class Summary {
    constructor({
        id = null,
        title = '',
        content = '',
        sourceUrl = '',
        sourceType = '',
        sourceFile = null,
        status = 'pending',
        processingStep = '',
        rawContent = '',
        createdAt = new Date(),
        completedAt = null,
        processingTime = 0,
        elapsedTime = 0,
        startTime = null,
        wordCount = 0,
        error = null,
        logs = []
    }) {
        this.id = id || Date.now().toString();
        this.title = title;
        this.content = content;
        this.sourceUrl = sourceUrl;
        this.sourceType = sourceType; // 'url', 'youtube', 'file'
        this.sourceFile = sourceFile;
        this.status = status; // 'pending', 'initializing', 'extracting', 'summarizing', 'completed', 'error'
        this.processingStep = processingStep; // More detailed status message
        this.rawContent = rawContent; // Store the raw extracted content for debugging
        this.createdAt = createdAt;
        this.completedAt = completedAt;
        this.processingTime = processingTime; // in seconds (actual processing time)
        this.elapsedTime = elapsedTime; // in seconds (total elapsed time including waiting)
        this.startTime = startTime; // When processing actually started
        this.wordCount = wordCount;
        this.error = error;
        this.logs = logs || []; // Processing logs for debugging
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            content: this.content,
            sourceUrl: this.sourceUrl,
            sourceType: this.sourceType,
            sourceFile: this.sourceFile ? {
                name: this.sourceFile.name,
                type: this.sourceFile.type,
                size: this.sourceFile.size
            } : null,
            status: this.status,
            processingStep: this.processingStep,
            rawContent: this.rawContent,
            createdAt: this.createdAt,
            completedAt: this.completedAt,
            processingTime: this.processingTime,
            elapsedTime: this.elapsedTime,
            startTime: this.startTime,
            wordCount: this.wordCount,
            error: this.error,
            logs: this.logs
        };
    }

    static fromJSON(json) {
        return new Summary({
            id: json.id,
            title: json.title,
            content: json.content,
            sourceUrl: json.sourceUrl,
            sourceType: json.sourceType,
            sourceFile: json.sourceFile,
            status: json.status,
            processingStep: json.processingStep,
            rawContent: json.rawContent,
            createdAt: new Date(json.createdAt),
            completedAt: json.completedAt ? new Date(json.completedAt) : null,
            processingTime: json.processingTime,
            elapsedTime: json.elapsedTime,
            startTime: json.startTime ? new Date(json.startTime) : null,
            wordCount: json.wordCount,
            error: json.error,
            logs: json.logs || []
        });
    }
    
    /**
     * Add a log entry to the summary
     * @param {string} message - The log message
     * @param {string} level - The log level (info, warn, error)
     */
    addLog(message, level = 'info') {
        const timestamp = new Date();
        this.logs.push({
            timestamp,
            message,
            level
        });
        
        // Calculate elapsed time if processing has started
        if (this.startTime) {
            this.elapsedTime = (new Date() - this.startTime) / 1000;
        }
        
        console.log(`[${level.toUpperCase()}] [${this.id}] ${message}`);
        return this;
    }
    
    /**
     * Update the processing step
     * @param {string} step - The current processing step
     * @param {string} status - The status to update to
     */
    updateStep(step, status = null) {
        this.processingStep = step;
        if (status) {
            this.status = status;
        }
        
        // Start timing if this is the first step
        if (!this.startTime && (status === 'extracting' || status === 'initializing')) {
            this.startTime = new Date();
        }
        
        // Calculate elapsed time
        if (this.startTime) {
            this.elapsedTime = (new Date() - this.startTime) / 1000;
        }
        
        this.addLog(`Processing step: ${step} (Status: ${this.status})`);
        return this;
    }
}

module.exports = Summary;