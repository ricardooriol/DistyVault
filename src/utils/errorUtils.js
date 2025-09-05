/**
 * Error Handling Utilities
 * Provides centralized error handling, logging, and user-friendly error messages.
 */
class ErrorUtils {
    /**
     * Log error to console with context
     * @param {string} context - Context where error occurred
     * @param {Error} error - Error object
     * @param {Object} additionalData - Additional data to log
     */
    static logError(context, error, additionalData = {}) {
        console.error(`Error in ${context}:`, error);
        if (Object.keys(additionalData).length > 0) {
            console.error('Additional context:', additionalData);
        }
    }

    /**
     * Get user-friendly error message from error object
     * @param {Error} error - Error object
     * @param {string} defaultMessage - Default message if error message is not available
     * @returns {string} User-friendly error message
     */
    static getUserFriendlyMessage(error, defaultMessage = 'An unexpected error occurred') {
        if (!error) return defaultMessage;

        // Handle network errors
        if (error.message.includes('network') || error.message.includes('fetch') || error.name === 'NetworkError') {
            return 'Network error. Please check your internet connection and try again.';
        }

        // Handle server errors
        if (error.message.includes('Server error: 5') || (error.status && error.status >= 500)) {
            return 'Server error occurred. Please try again later.';
        }

        // Handle client errors
        if (error.status && error.status >= 400 && error.status < 500) {
            return error.message || 'Request failed. Please check your input and try again.';
        }

        // Handle abort errors (user cancelled)
        if (error.name === 'AbortError') {
            return 'Operation was cancelled.';
        }

        // Return the error message if it's user-friendly, otherwise use default
        return error.message || defaultMessage;
    }

    /**
     * Handle API errors with consistent logging and user feedback
     * @param {string} context - Context where error occurred
     * @param {Error} error - Error object
     * @param {Object} options - Options for error handling
     * @param {boolean} options.showAlert - Whether to show alert to user
     * @param {string} options.defaultMessage - Default message for user
     * @param {Function} options.onError - Callback function for additional error handling
     * @returns {string} User-friendly error message
     */
    static handleApiError(context, error, options = {}) {
        const {
            showAlert = false,
            defaultMessage = 'An error occurred',
            onError = null
        } = options;

        // Log the error
        this.logError(context, error);

        // Get user-friendly message
        const userMessage = this.getUserFriendlyMessage(error, defaultMessage);

        // Show alert if requested
        if (showAlert) {
            alert(userMessage);
        }

        // Call additional error handler if provided
        if (typeof onError === 'function') {
            onError(error, userMessage);
        }

        return userMessage;
    }

    /**
     * Handle async operations with error handling
     * @param {Function} asyncOperation - Async function to execute
     * @param {string} context - Context for error logging
     * @param {Object} options - Error handling options
     * @returns {Promise} Promise that resolves with result or handles error
     */
    static async handleAsync(asyncOperation, context, options = {}) {
        try {
            return await asyncOperation();
        } catch (error) {
            return this.handleApiError(context, error, options);
        }
    }

    /**
     * Create error handler function for event listeners
     * @param {string} context - Context for error logging
     * @param {Object} options - Error handling options
     * @returns {Function} Error handler function
     */
    static createErrorHandler(context, options = {}) {
        return (error) => {
            this.handleApiError(context, error, options);
        };
    }

    /**
     * Wrap a function with error handling
     * @param {Function} func - Function to wrap
     * @param {string} context - Context for error logging
     * @param {Object} options - Error handling options
     * @returns {Function} Wrapped function with error handling
     */
    static wrapWithErrorHandling(func, context, options = {}) {
        return async (...args) => {
            try {
                return await func(...args);
            } catch (error) {
                this.handleApiError(context, error, options);
                throw error; // Re-throw if caller needs to handle it
            }
        };
    }

    /**
     * Check if error is a user cancellation (AbortError)
     * @param {Error} error - Error to check
     * @returns {boolean} True if error is user cancellation
     */
    static isUserCancellation(error) {
        return error && error.name === 'AbortError';
    }

    /**
     * Check if error is a network error
     * @param {Error} error - Error to check
     * @returns {boolean} True if error is network-related
     */
    static isNetworkError(error) {
        return error && (
            error.message.includes('network') ||
            error.message.includes('fetch') ||
            error.name === 'NetworkError' ||
            error.name === 'TypeError' && error.message.includes('fetch')
        );
    }

    /**
     * Check if error is a server error (5xx)
     * @param {Error} error - Error to check
     * @returns {boolean} True if error is server error
     */
    static isServerError(error) {
        return error && (
            error.message.includes('Server error: 5') ||
            (error.status && error.status >= 500)
        );
    }

    /**
     * Format error for display in UI components
     * @param {Error} error - Error to format
     * @param {Object} options - Formatting options
     * @returns {Object} Formatted error object with icon, message, and class
     */
    static formatErrorForDisplay(error, options = {}) {
        const { includeIcon = true, includeClass = true } = options;
        
        const result = {
            message: this.getUserFriendlyMessage(error)
        };

        if (includeIcon) {
            result.icon = '❌';
        }

        if (includeClass) {
            if (this.isNetworkError(error)) {
                result.class = 'error-network';
            } else if (this.isServerError(error)) {
                result.class = 'error-server';
            } else if (this.isUserCancellation(error)) {
                result.class = 'error-cancelled';
            } else {
                result.class = 'error-general';
            }
        }

        return result;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorUtils;
} else {
    window.ErrorUtils = ErrorUtils;
}