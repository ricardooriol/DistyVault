/**
 * TranscriptLogger - Enhanced logging and monitoring system for YouTube transcript extraction
 * Provides structured logging with performance timing and detailed context
 */
class TranscriptLogger {
    constructor(context = 'TranscriptExtraction') {
        this.context = context;
        this.startTime = Date.now();
        this.operations = [];
        this.currentOperation = null;
    }

    /**
     * Start a new operation with timing
     * @param {string} operationName - Name of the operation
     * @param {Object} details - Additional operation details
     */
    startOperation(operationName, details = {}) {
        const operation = {
            name: operationName,
            startTime: Date.now(),
            details: details,
            logs: [],
            subOperations: []
        };

        this.currentOperation = operation;
        this.operations.push(operation);

        this._log('info', `🚀 Starting operation: ${operationName}`, details);
        return operation;
    }

    /**
     * End the current operation
     * @param {boolean} success - Whether the operation succeeded
     * @param {Object} result - Operation result
     */
    endOperation(success = true, result = {}) {
        if (!this.currentOperation) {
            this._log('warn', 'No active operation to end');
            return;
        }

        const operation = this.currentOperation;
        operation.endTime = Date.now();
        operation.duration = operation.endTime - operation.startTime;
        operation.success = success;
        operation.result = result;

        const statusIcon = success ? '✅' : '❌';
        const durationText = `${(operation.duration / 1000).toFixed(2)}s`;
        
        this._log(success ? 'info' : 'error', 
            `${statusIcon} Operation completed: ${operation.name} (${durationText})`, 
            { success, duration: operation.duration, result }
        );

        this.currentOperation = null;
        return operation;
    }

    /**
     * Log a message within the current operation context
     * @param {string} level - Log level (info, warn, error, debug)
     * @param {string} message - Log message
     * @param {Object} data - Additional data
     */
    log(level, message, data = {}) {
        const logEntry = {
            timestamp: Date.now(),
            level,
            message,
            data,
            operation: this.currentOperation?.name || 'global'
        };

        if (this.currentOperation) {
            this.currentOperation.logs.push(logEntry);
        }

        this._log(level, message, data);
    }

    /**
     * Log strategy attempt
     * @param {string} strategyName - Name of the strategy
     * @param {string} videoId - Video ID being processed
     */
    logStrategyAttempt(strategyName, videoId) {
        this.log('info', `🎯 Attempting strategy: ${strategyName}`, { 
            strategy: strategyName, 
            videoId,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Log strategy success
     * @param {string} strategyName - Name of the strategy
     * @param {Object} result - Strategy result
     */
    logStrategySuccess(strategyName, result) {
        this.log('info', `✅ Strategy succeeded: ${strategyName}`, {
            strategy: strategyName,
            segmentCount: result.segments?.length || 0,
            transcriptLength: result.transcript?.length || 0,
            processingTime: result.processingTime || 0
        });
    }

    /**
     * Log strategy failure
     * @param {string} strategyName - Name of the strategy
     * @param {string} error - Error message
     * @param {Object} details - Additional error details
     */
    logStrategyFailure(strategyName, error, details = {}) {
        this.log('warn', `❌ Strategy failed: ${strategyName}`, {
            strategy: strategyName,
            error: error,
            details: details
        });
    }

    /**
     * Log HTML parsing step
     * @param {string} step - Parsing step description
     * @param {Object} data - Parsing data
     */
    logHtmlParsing(step, data = {}) {
        this.log('debug', `🔍 HTML Parsing: ${step}`, data);
    }

    /**
     * Log caption processing step
     * @param {string} step - Processing step description
     * @param {Object} data - Processing data
     */
    logCaptionProcessing(step, data = {}) {
        this.log('debug', `📝 Caption Processing: ${step}`, data);
    }

    /**
     * Log validation step
     * @param {string} step - Validation step description
     * @param {Object} data - Validation data
     */
    logValidation(step, data = {}) {
        this.log('debug', `✔️ Validation: ${step}`, data);
    }

    /**
     * Log performance metrics
     * @param {string} metric - Metric name
     * @param {number} value - Metric value
     * @param {string} unit - Metric unit
     */
    logPerformance(metric, value, unit = 'ms') {
        this.log('info', `📊 Performance: ${metric} = ${value}${unit}`, {
            metric,
            value,
            unit,
            timestamp: Date.now()
        });
    }

    /**
     * Generate comprehensive summary report
     * @returns {Object} - Summary report
     */
    generateSummary() {
        const totalDuration = Date.now() - this.startTime;
        const successfulOperations = this.operations.filter(op => op.success);
        const failedOperations = this.operations.filter(op => op.success === false);

        const summary = {
            context: this.context,
            totalDuration: totalDuration,
            totalOperations: this.operations.length,
            successfulOperations: successfulOperations.length,
            failedOperations: failedOperations.length,
            successRate: this.operations.length > 0 ? (successfulOperations.length / this.operations.length * 100).toFixed(1) : 0,
            operations: this.operations.map(op => ({
                name: op.name,
                duration: op.duration,
                success: op.success,
                logCount: op.logs.length,
                details: op.details
            })),
            timestamp: new Date().toISOString()
        };

        this._log('info', `📋 Summary Report Generated`, summary);
        return summary;
    }

    /**
     * Export logs for debugging
     * @returns {Object} - Complete log export
     */
    exportLogs() {
        return {
            context: this.context,
            startTime: this.startTime,
            operations: this.operations,
            summary: this.generateSummary()
        };
    }

    /**
     * Internal logging method
     * @param {string} level - Log level
     * @param {string} message - Message
     * @param {Object} data - Additional data
     * @private
     */
    _log(level, message, data = {}) {
        const timestamp = new Date().toISOString();
        const contextPrefix = `[${this.context}]`;
        const operationPrefix = this.currentOperation ? `[${this.currentOperation.name}]` : '';
        const fullMessage = `${contextPrefix}${operationPrefix} ${message}`;

        // Format data for logging
        const dataStr = Object.keys(data).length > 0 ? 
            ` ${JSON.stringify(data, null, 2)}` : '';

        switch (level) {
            case 'info':
                console.log(`${timestamp} INFO ${fullMessage}${dataStr}`);
                break;
            case 'warn':
                console.warn(`${timestamp} WARN ${fullMessage}${dataStr}`);
                break;
            case 'error':
                console.error(`${timestamp} ERROR ${fullMessage}${dataStr}`);
                break;
            case 'debug':
                if (process.env.DEBUG_TRANSCRIPT) {
                    console.log(`${timestamp} DEBUG ${fullMessage}${dataStr}`);
                }
                break;
            default:
                console.log(`${timestamp} ${level.toUpperCase()} ${fullMessage}${dataStr}`);
        }
    }

    /**
     * Create a child logger for sub-operations
     * @param {string} subContext - Sub-context name
     * @returns {TranscriptLogger} - Child logger
     */
    createChildLogger(subContext) {
        const childLogger = new TranscriptLogger(`${this.context}:${subContext}`);
        
        if (this.currentOperation) {
            this.currentOperation.subOperations.push(childLogger);
        }
        
        return childLogger;
    }

    /**
     * Log system information
     */
    logSystemInfo() {
        const systemInfo = {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            memory: process.memoryUsage(),
            uptime: process.uptime()
        };

        this.log('info', '🖥️ System Information', systemInfo);
    }

    /**
     * Log error with stack trace
     * @param {Error} error - Error object
     * @param {string} context - Error context
     */
    logError(error, context = 'Unknown') {
        this.log('error', `💥 Error in ${context}: ${error.message}`, {
            error: error.message,
            stack: error.stack,
            context: context,
            timestamp: new Date().toISOString()
        });
    }
}

module.exports = TranscriptLogger;