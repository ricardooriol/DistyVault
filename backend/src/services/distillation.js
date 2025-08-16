/**
 * Enhanced Distillation model for DistyVault
 * Represents a processed content distillation with metadata and validation
 */
class Distillation {
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
        distillingStartTime = null,
        wordCount = 0,
        error = null,
        logs = []
    }) {
        this.id = id || this.generateId();
        this.title = title;
        this.content = content;
        this.sourceUrl = sourceUrl;
        this.sourceType = sourceType; // 'url', 'youtube', 'file'
        this.sourceFile = sourceFile;
        this.status = status; // 'pending', 'initializing', 'extracting', 'distilling', 'completed', 'error', 'stopped'
        this.processingStep = processingStep; // More detailed status message
        this.rawContent = rawContent; // Store the raw extracted content for debugging
        this.createdAt = createdAt;
        this.completedAt = completedAt;
        this.processingTime = processingTime; // in seconds (actual processing time)
        this.elapsedTime = elapsedTime; // in seconds (total elapsed time including waiting)
        this.startTime = startTime; // When processing actually started
        this.distillingStartTime = distillingStartTime; // When AI distillation started
        this.wordCount = wordCount;
        this.error = error;
        this.logs = logs || []; // Processing logs for debugging
        
        // Validate the instance after construction
        this.validate();
    }

    /**
     * Generate a unique ID for the distillation
     * @returns {string} - Unique identifier
     */
    generateId() {
        return `dist_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * Validate the distillation instance
     * @throws {Error} - If validation fails
     */
    validate() {
        const errors = [];

        // Validate required fields
        if (!this.id || typeof this.id !== 'string') {
            errors.push('ID must be a non-empty string');
        }

        if (typeof this.title !== 'string') {
            errors.push('Title must be a string');
        }

        if (typeof this.content !== 'string') {
            errors.push('Content must be a string');
        }

        // Validate sourceType
        const validSourceTypes = ['url', 'youtube', 'file'];
        if (this.sourceType && !validSourceTypes.includes(this.sourceType)) {
            errors.push(`Source type must be one of: ${validSourceTypes.join(', ')}`);
        }

        // Validate status
        const validStatuses = ['pending', 'initializing', 'extracting', 'distilling', 'completed', 'error', 'stopped'];
        if (!validStatuses.includes(this.status)) {
            errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
        }

        // Validate dates
        if (!(this.createdAt instanceof Date)) {
            errors.push('Created at must be a Date object');
        }

        if (this.completedAt && !(this.completedAt instanceof Date)) {
            errors.push('Completed at must be a Date object or null');
        }

        if (this.startTime && !(this.startTime instanceof Date)) {
            errors.push('Start time must be a Date object or null');
        }

        if (this.distillingStartTime && !(this.distillingStartTime instanceof Date)) {
            errors.push('Distilling start time must be a Date object or null');
        }

        // Validate numeric fields
        if (typeof this.processingTime !== 'number' || this.processingTime < 0) {
            errors.push('Processing time must be a non-negative number');
        }

        if (typeof this.elapsedTime !== 'number' || this.elapsedTime < 0) {
            errors.push('Elapsed time must be a non-negative number');
        }

        if (typeof this.wordCount !== 'number' || this.wordCount < 0) {
            errors.push('Word count must be a non-negative number');
        }

        // Validate logs array
        if (!Array.isArray(this.logs)) {
            errors.push('Logs must be an array');
        }

        if (errors.length > 0) {
            throw new Error(`Distillation validation failed: ${errors.join(', ')}`);
        }
    }

    /**
     * Convert to JSON representation
     * @returns {Object} - JSON representation
     */
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
            createdAt: this.createdAt.toISOString(),
            completedAt: this.completedAt ? this.completedAt.toISOString() : null,
            processingTime: this.processingTime,
            elapsedTime: this.elapsedTime,
            startTime: this.startTime ? this.startTime.toISOString() : null,
            distillingStartTime: this.distillingStartTime ? this.distillingStartTime.toISOString() : null,
            wordCount: this.wordCount,
            error: this.error,
            logs: this.logs
        };
    }

    /**
     * Create from JSON representation
     * @param {Object} json - JSON data
     * @returns {Distillation} - New Distillation instance
     */
    static fromJSON(json) {
        return new Distillation({
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
            distillingStartTime: json.distillingStartTime ? new Date(json.distillingStartTime) : null,
            wordCount: json.wordCount,
            error: json.error,
            logs: json.logs || []
        });
    }

    /**
     * Create from database row
     * @param {Object} row - Database row
     * @returns {Distillation} - New Distillation instance
     */
    static fromDatabase(row) {
        return new Distillation({
            id: row.id,
            title: row.title,
            content: row.content,
            sourceUrl: row.sourceUrl,
            sourceType: row.sourceType,
            sourceFile: row.sourceFile ? JSON.parse(row.sourceFile) : null,
            status: row.status,
            processingStep: row.processingStep,
            rawContent: row.rawContent,
            createdAt: new Date(row.createdAt),
            completedAt: row.completedAt ? new Date(row.completedAt) : null,
            processingTime: row.processingTime,
            elapsedTime: row.elapsedTime,
            startTime: row.startTime ? new Date(row.startTime) : null,
            distillingStartTime: row.distillingStartTime ? new Date(row.distillingStartTime) : null,
            wordCount: row.wordCount,
            error: row.error,
            logs: row.logs ? JSON.parse(row.logs) : []
        });
    }

    /**
     * Add a log entry to the distillation
     * @param {string} message - The log message
     * @param {string} level - The log level (info, warn, error)
     * @returns {Distillation} - This instance for chaining
     */
    addLog(message, level = 'info') {
        const timestamp = new Date();
        this.logs.push({
            timestamp: timestamp.toISOString(),
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
     * Update the processing step and status
     * @param {string} step - The current processing step
     * @param {string} status - The status to update to (optional)
     * @returns {Distillation} - This instance for chaining
     */
    updateStep(step, status = null) {
        this.processingStep = step;
        if (status) {
            this.updateStatus(status);
        }
        
        this.addLog(`Processing step: ${step} (Status: ${this.status})`);
        return this;
    }

    /**
     * Update the status with automatic timestamp handling
     * @param {string} status - The new status
     * @returns {Distillation} - This instance for chaining
     */
    updateStatus(status) {
        const oldStatus = this.status;
        this.status = status;
        
        // Handle automatic timestamp updates
        const now = new Date();
        
        // Start timing if this is the first step
        if (!this.startTime && (status === 'extracting' || status === 'initializing')) {
            this.startTime = now;
        }
        
        // Set distilling start time
        if (status === 'distilling' && !this.distillingStartTime) {
            this.distillingStartTime = now;
        }
        
        // Set completion time
        if (status === 'completed') {
            this.completedAt = now;
        }
        
        // Calculate elapsed time
        if (this.startTime) {
            this.elapsedTime = (now - this.startTime) / 1000;
        }
        
        this.addLog(`Status changed from ${oldStatus} to ${status}`);
        return this;
    }

    /**
     * Calculate processing time based on current state
     * @returns {number} - Processing time in seconds
     */
    calculateProcessingTime() {
        if (this.completedAt && this.startTime) {
            return (this.completedAt - this.startTime) / 1000;
        } else if (this.startTime) {
            return (new Date() - this.startTime) / 1000;
        }
        return 0;
    }

    /**
     * Get processing statistics
     * @returns {Object} - Processing statistics
     */
    getStats() {
        return {
            id: this.id,
            status: this.status,
            processingTime: this.calculateProcessingTime(),
            elapsedTime: this.elapsedTime,
            wordCount: this.wordCount,
            contentLength: this.content.length,
            rawContentLength: this.rawContent.length,
            logCount: this.logs.length,
            hasError: !!this.error,
            isCompleted: this.status === 'completed',
            compressionRatio: this.rawContent.length > 0 ? 
                ((this.rawContent.length - this.content.length) / this.rawContent.length * 100).toFixed(1) : 0
        };
    }

    /**
     * Check if the distillation is in a final state
     * @returns {boolean} - True if in final state
     */
    isFinal() {
        return ['completed', 'error', 'stopped'].includes(this.status);
    }

    /**
     * Check if the distillation is currently processing
     * @returns {boolean} - True if processing
     */
    isProcessing() {
        return ['initializing', 'extracting', 'distilling'].includes(this.status);
    }

    /**
     * Get logs filtered by level
     * @param {string} level - Log level to filter by
     * @returns {Array} - Filtered logs
     */
    getLogsByLevel(level) {
        return this.logs.filter(log => log.level === level);
    }

    /**
     * Get error logs
     * @returns {Array} - Error logs
     */
    getErrorLogs() {
        return this.getLogsByLevel('error');
    }

    /**
     * Clone the distillation
     * @returns {Distillation} - New cloned instance
     */
    clone() {
        return new Distillation({
            id: this.generateId(), // Generate new ID for clone
            title: this.title,
            content: this.content,
            sourceUrl: this.sourceUrl,
            sourceType: this.sourceType,
            sourceFile: this.sourceFile ? { ...this.sourceFile } : null,
            status: 'pending', // Reset status for clone
            processingStep: '',
            rawContent: this.rawContent,
            createdAt: new Date(), // New creation time
            completedAt: null,
            processingTime: 0,
            elapsedTime: 0,
            startTime: null,
            distillingStartTime: null,
            wordCount: 0,
            error: null,
            logs: []
        });
    }

    /**
     * Create a new distillation instance with validation
     * @param {Object} data - Distillation data
     * @returns {Distillation} - New validated instance
     */
    static create(data) {
        return new Distillation(data);
    }
}

module.exports = Distillation;