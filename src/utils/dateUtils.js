/**
 * Date and Time Utilities
 * Provides utilities for date formatting, time calculations, and duration display.
 */
class DateUtils {
    /**
     * Format time duration in seconds to human-readable format
     * @param {number} timeInSeconds - Time duration in seconds
     * @returns {string} Formatted time string (e.g., "2m 30s" or "45s")
     */
    static formatTimeDisplay(timeInSeconds) {
        const totalSeconds = Math.floor(timeInSeconds);
        if (totalSeconds < 60) {
            return `${totalSeconds}s`;
        } else {
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes}m ${seconds}s`;
        }
    }

    /**
     * Calculate and format processing time display for an item
     * @param {Object} item - Item with processing information
     * @returns {string} Formatted processing time or status
     */
    static calculateProcessingTimeDisplay(item) {
        // Centralized time calculation to ensure consistency
        if (item.processingTime && item.status === 'completed') {
            return this.formatTimeDisplay(item.processingTime);
    } else if (item.status === 'pending' || item.status === 'queued') {
            return 'Waiting...';
        } else if (['extracting', 'distilling'].includes(item.status) && item.startTime) {
            try {
                const startTime = new Date(item.startTime);
                const currentTime = new Date();

                if (!isNaN(startTime.getTime()) && !isNaN(currentTime.getTime())) {
                    const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);

                    if (elapsedSeconds >= 0) {
                        if (elapsedSeconds < 60) {
                            return `${elapsedSeconds}s`;
                        } else {
                            const minutes = Math.floor(elapsedSeconds / 60);
                            const seconds = elapsedSeconds % 60;
                            return `${minutes}m ${seconds}s`;
                        }
                    } else {
                        return '0s';
                    }
                }
            } catch (error) {
                console.warn('Error calculating processing time:', error);
            }
        } else if (item.elapsedTime && item.elapsedTime > 0) {
            const minutes = Math.floor(item.elapsedTime / 60);
            const seconds = Math.floor(item.elapsedTime % 60);
            return `${minutes}m ${seconds}s`;
        }
        return '';
    }

    /**
     * Format a date to a readable string
     * @param {Date|string} date - Date object or date string
     * @returns {string} Formatted date string
     */
    static formatDate(date) {
        if (!date) return '';
        
        const dateObj = date instanceof Date ? date : new Date(date);
        if (isNaN(dateObj.getTime())) return '';

        return dateObj.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Format a date to a short readable string
     * @param {Date|string} date - Date object or date string
     * @returns {string} Short formatted date string
     */
    static formatDateShort(date) {
        if (!date) return '';
        
        const dateObj = date instanceof Date ? date : new Date(date);
        if (isNaN(dateObj.getTime())) return '';

        const now = new Date();
        const diffMs = now - dateObj;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return dateObj.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
        }
    }

    /**
     * Calculate elapsed time between two dates
     * @param {Date|string} startDate - Start date
     * @param {Date|string} endDate - End date (defaults to now)
     * @returns {number} Elapsed time in seconds
     */
    static calculateElapsedSeconds(startDate, endDate = new Date()) {
        const start = startDate instanceof Date ? startDate : new Date(startDate);
        const end = endDate instanceof Date ? endDate : new Date(endDate);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return 0;
        }

        return Math.floor((end - start) / 1000);
    }

    /**
     * Check if a date is today
     * @param {Date|string} date - Date to check
     * @returns {boolean} True if date is today
     */
    static isToday(date) {
        if (!date) return false;
        
        const dateObj = date instanceof Date ? date : new Date(date);
        if (isNaN(dateObj.getTime())) return false;

        const today = new Date();
        return dateObj.toDateString() === today.toDateString();
    }

    /**
     * Get relative time string (e.g., "2 minutes ago", "in 5 hours")
     * @param {Date|string} date - Date to compare
     * @returns {string} Relative time string
     */
    static getRelativeTime(date) {
        if (!date) return '';
        
        const dateObj = date instanceof Date ? date : new Date(date);
        if (isNaN(dateObj.getTime())) return '';

        const now = new Date();
        const diffMs = now - dateObj;
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (Math.abs(diffSeconds) < 60) {
            return 'just now';
        } else if (Math.abs(diffMinutes) < 60) {
            return diffMinutes > 0 ? `${diffMinutes} minutes ago` : `in ${Math.abs(diffMinutes)} minutes`;
        } else if (Math.abs(diffHours) < 24) {
            return diffHours > 0 ? `${diffHours} hours ago` : `in ${Math.abs(diffHours)} hours`;
        } else {
            return diffDays > 0 ? `${diffDays} days ago` : `in ${Math.abs(diffDays)} days`;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DateUtils;
} else {
    window.DateUtils = DateUtils;
}