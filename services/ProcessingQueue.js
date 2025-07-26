/**
 * Processing Queue Manager
 * Manages concurrent processing limits to avoid API rate limits
 */
class ProcessingQueue {
    constructor() {
        this.queue = [];
        this.activeProcessing = new Set();
        this.maxConcurrent = 1; // Default to 1 to avoid rate limits
        this.isProcessing = false;
    }

    /**
     * Set the maximum number of concurrent processing tasks
     * @param {number} limit - Maximum concurrent tasks (1-10)
     */
    setMaxConcurrent(limit) {
        this.maxConcurrent = Math.max(1, Math.min(10, limit));
        console.log(`Processing queue limit set to: ${this.maxConcurrent}`);
        
        // Process any queued items if we increased the limit
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    /**
     * Add a processing task to the queue
     * @param {string} id - Unique identifier for the task
     * @param {Function} processingFunction - Async function to execute
     * @returns {Promise} - Promise that resolves when the task completes
     */
    async addToQueue(id, processingFunction) {
        return new Promise((resolve, reject) => {
            const task = {
                id,
                processingFunction,
                resolve,
                reject,
                addedAt: new Date()
            };

            this.queue.push(task);
            console.log(`[ProcessingQueue] Added task ${id} to queue. Queue length: ${this.queue.length}`);

            // Start processing if not already running
            if (!this.isProcessing) {
                this.processQueue();
            }
        });
    }

    /**
     * Process the queue
     */
    async processQueue() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;

        while (this.queue.length > 0 && this.activeProcessing.size < this.maxConcurrent) {
            const task = this.queue.shift();
            
            console.log(`[ProcessingQueue] Starting task ${task.id}. Active: ${this.activeProcessing.size}/${this.maxConcurrent}`);
            
            this.activeProcessing.add(task.id);
            
            // Execute the task
            this.executeTask(task);
        }

        this.isProcessing = false;
    }

    /**
     * Execute a single task
     * @param {Object} task - Task object
     */
    async executeTask(task) {
        try {
            const result = await task.processingFunction();
            task.resolve(result);
            console.log(`[ProcessingQueue] Task ${task.id} completed successfully`);
        } catch (error) {
            task.reject(error);
            console.error(`[ProcessingQueue] Task ${task.id} failed:`, error.message);
        } finally {
            this.activeProcessing.delete(task.id);
            
            // Continue processing queue if there are more items
            if (this.queue.length > 0) {
                setTimeout(() => this.processQueue(), 100);
            }
        }
    }

    /**
     * Get queue status
     * @returns {Object} - Queue status information
     */
    getStatus() {
        return {
            queueLength: this.queue.length,
            activeProcessing: this.activeProcessing.size,
            maxConcurrent: this.maxConcurrent,
            isProcessing: this.isProcessing
        };
    }

    /**
     * Clear the queue (for emergency stops)
     */
    clearQueue() {
        console.log(`[ProcessingQueue] Clearing queue. ${this.queue.length} tasks cancelled.`);
        
        // Reject all queued tasks
        this.queue.forEach(task => {
            task.reject(new Error('Processing queue cleared'));
        });
        
        this.queue = [];
    }
}

// Export singleton instance
module.exports = new ProcessingQueue();