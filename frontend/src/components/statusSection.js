/**
 * StatusSection Component
 * Handles processing status display and progress indication
 */
class StatusSection {
    constructor(app) {
        this.app = app;
        this.isVisible = false;
        this.currentMessage = '';
        this.currentProgress = 0;
    }

    /**
     * Initialize the status section component
     */
    init() {
        this.hideStatus();
    }

    /**
     * Show status with message and progress
     * @param {string} message - Status message to display
     * @param {number} progress - Progress percentage (0-100)
     */
    showStatus(message, progress = 0) {
        const statusSection = DomUtils.getElementById('status-section');
        const statusMessage = DomUtils.getElementById('status-message');
        const progressFill = DomUtils.getElementById('progress-fill');

        if (!statusSection || !statusMessage || !progressFill) {
            console.warn('Status section elements not found');
            return;
        }

        // Update internal state
        this.isVisible = true;
        this.currentMessage = message;
        this.currentProgress = Math.max(0, Math.min(100, progress));

        // Update UI elements
        statusSection.style.display = 'block';
        statusMessage.textContent = message;
        progressFill.style.width = `${this.currentProgress}%`;

        // Add animation class for smooth transitions
        statusSection.classList.add('status-visible');
        progressFill.classList.add('progress-animated');
    }

    /**
     * Hide status section
     */
    hideStatus() {
        const statusSection = DomUtils.getElementById('status-section');
        
        if (!statusSection) {
            return;
        }

        // Update internal state
        this.isVisible = false;
        this.currentMessage = '';
        this.currentProgress = 0;

        // Add fade-out animation
        statusSection.classList.add('status-hiding');
        
        // Hide after animation completes
        setTimeout(() => {
            statusSection.style.display = 'none';
            statusSection.classList.remove('status-visible', 'status-hiding');
            
            // Reset progress bar
            const progressFill = DomUtils.getElementById('progress-fill');
            if (progressFill) {
                progressFill.style.width = '0%';
                progressFill.classList.remove('progress-animated');
            }
        }, 300);
    }

    /**
     * Update status message without changing progress
     * @param {string} message - New status message
     */
    updateMessage(message) {
        if (!this.isVisible) {
            this.showStatus(message, this.currentProgress);
            return;
        }

        const statusMessage = DomUtils.getElementById('status-message');
        if (statusMessage) {
            this.currentMessage = message;
            statusMessage.textContent = message;
            
            // Add update animation
            statusMessage.classList.add('message-updated');
            setTimeout(() => {
                statusMessage.classList.remove('message-updated');
            }, 300);
        }
    }

    /**
     * Update progress without changing message
     * @param {number} progress - Progress percentage (0-100)
     */
    updateProgress(progress) {
        if (!this.isVisible) {
            this.showStatus(this.currentMessage || 'Processing...', progress);
            return;
        }

        const progressFill = DomUtils.getElementById('progress-fill');
        if (progressFill) {
            this.currentProgress = Math.max(0, Math.min(100, progress));
            progressFill.style.width = `${this.currentProgress}%`;
            
            // Ensure animation class is present
            progressFill.classList.add('progress-animated');
        }
    }

    /**
     * Show processing status for file upload
     * @param {string} fileName - Name of the file being processed
     */
    showFileProcessing(fileName) {
        this.showStatus(`Processing ${fileName}...`, 25);
    }

    /**
     * Show processing status for URL
     * @param {string} url - URL being processed (optional)
     */
    showUrlProcessing(url = null) {
        const message = url ? `Processing ${this.truncateUrl(url)}...` : 'Processing URL...';
        this.showStatus(message, 25);
    }

    /**
     * Show completion status
     * @param {string} type - Type of content processed ('file' or 'url')
     */
    showCompletion(type = 'content') {
        const message = type === 'file' 
            ? 'File uploaded. Processing in background...' 
            : 'URL submitted. Processing in background...';
        
        this.showStatus(message, 100);
        
        // Auto-hide after 2 seconds
        setTimeout(() => {
            this.hideStatus();
        }, 2000);
    }

    /**
     * Show error status
     * @param {string} error - Error message
     */
    showError(error) {
        const statusSection = DomUtils.getElementById('status-section');
        const statusMessage = DomUtils.getElementById('status-message');
        const progressFill = DomUtils.getElementById('progress-fill');

        if (!statusSection || !statusMessage || !progressFill) {
            return;
        }

        // Update internal state
        this.isVisible = true;
        this.currentMessage = error;
        this.currentProgress = 0;

        // Update UI with error styling
        statusSection.style.display = 'block';
        statusSection.classList.add('status-error');
        statusMessage.textContent = error;
        progressFill.style.width = '0%';

        // Auto-hide error after 5 seconds
        setTimeout(() => {
            this.hideStatus();
            statusSection.classList.remove('status-error');
        }, 5000);
    }

    /**
     * Show warning status
     * @param {string} warning - Warning message
     */
    showWarning(warning) {
        const statusSection = DomUtils.getElementById('status-section');
        const statusMessage = DomUtils.getElementById('status-message');

        if (!statusSection || !statusMessage) {
            return;
        }

        // Update internal state
        this.isVisible = true;
        this.currentMessage = warning;

        // Update UI with warning styling
        statusSection.style.display = 'block';
        statusSection.classList.add('status-warning');
        statusMessage.textContent = warning;

        // Auto-hide warning after 4 seconds
        setTimeout(() => {
            this.hideStatus();
            statusSection.classList.remove('status-warning');
        }, 4000);
    }

    /**
     * Show success status
     * @param {string} message - Success message
     */
    showSuccess(message) {
        const statusSection = DomUtils.getElementById('status-section');
        const statusMessage = DomUtils.getElementById('status-message');
        const progressFill = DomUtils.getElementById('progress-fill');

        if (!statusSection || !statusMessage || !progressFill) {
            return;
        }

        // Update internal state
        this.isVisible = true;
        this.currentMessage = message;
        this.currentProgress = 100;

        // Update UI with success styling
        statusSection.style.display = 'block';
        statusSection.classList.add('status-success');
        statusMessage.textContent = message;
        progressFill.style.width = '100%';

        // Auto-hide success after 3 seconds
        setTimeout(() => {
            this.hideStatus();
            statusSection.classList.remove('status-success');
        }, 3000);
    }

    /**
     * Show indeterminate progress (for unknown duration tasks)
     * @param {string} message - Status message
     */
    showIndeterminateProgress(message) {
        const statusSection = DomUtils.getElementById('status-section');
        const statusMessage = DomUtils.getElementById('status-message');
        const progressFill = DomUtils.getElementById('progress-fill');

        if (!statusSection || !statusMessage || !progressFill) {
            return;
        }

        // Update internal state
        this.isVisible = true;
        this.currentMessage = message;
        this.currentProgress = -1; // Special value for indeterminate

        // Update UI
        statusSection.style.display = 'block';
        statusMessage.textContent = message;
        
        // Add indeterminate animation class
        progressFill.classList.add('progress-indeterminate');
        progressFill.style.width = '100%';
    }

    /**
     * Clear indeterminate progress and return to normal
     */
    clearIndeterminateProgress() {
        const progressFill = DomUtils.getElementById('progress-fill');
        if (progressFill) {
            progressFill.classList.remove('progress-indeterminate');
            progressFill.style.width = '0%';
        }
        this.currentProgress = 0;
    }

    /**
     * Check if status is currently visible
     * @returns {boolean} - True if status is visible
     */
    isStatusVisible() {
        return this.isVisible;
    }

    /**
     * Get current status message
     * @returns {string} - Current status message
     */
    getCurrentMessage() {
        return this.currentMessage;
    }

    /**
     * Get current progress
     * @returns {number} - Current progress (0-100, or -1 for indeterminate)
     */
    getCurrentProgress() {
        return this.currentProgress;
    }

    /**
     * Truncate URL for display
     * @param {string} url - URL to truncate
     * @returns {string} - Truncated URL
     */
    truncateUrl(url) {
        if (!url || url.length <= 50) {
            return url;
        }
        
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname.replace('www.', '');
            return `${domain}...`;
        } catch (e) {
            return url.length > 50 ? url.substring(0, 47) + '...' : url;
        }
    }

    /**
     * Show temporary message (auto-hide after specified duration)
     * @param {string} message - Message to display
     * @param {number} duration - Duration in milliseconds (default: 3000)
     * @param {string} type - Message type ('info', 'success', 'warning', 'error')
     */
    showTemporaryMessage(message, duration = 3000, type = 'info') {
        switch (type) {
            case 'success':
                this.showSuccess(message);
                break;
            case 'warning':
                this.showWarning(message);
                break;
            case 'error':
                this.showError(message);
                break;
            default:
                this.showStatus(message, 0);
                setTimeout(() => this.hideStatus(), duration);
                break;
        }
    }

    /**
     * Animate progress from current value to target value
     * @param {number} targetProgress - Target progress value (0-100)
     * @param {number} duration - Animation duration in milliseconds
     */
    animateProgressTo(targetProgress, duration = 1000) {
        if (!this.isVisible) {
            return;
        }

        const startProgress = this.currentProgress;
        const progressDiff = targetProgress - startProgress;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out)
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentProgress = startProgress + (progressDiff * easeOut);
            
            this.updateProgress(currentProgress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    /**
     * Reset status section to initial state
     */
    reset() {
        this.hideStatus();
        this.isVisible = false;
        this.currentMessage = '';
        this.currentProgress = 0;
        
        // Remove all status classes
        const statusSection = DomUtils.getElementById('status-section');
        if (statusSection) {
            statusSection.classList.remove('status-error', 'status-warning', 'status-success', 'status-visible', 'status-hiding');
        }
        
        // Reset progress bar
        const progressFill = DomUtils.getElementById('progress-fill');
        if (progressFill) {
            progressFill.classList.remove('progress-animated', 'progress-indeterminate');
            progressFill.style.width = '0%';
        }
    }
}

// Export for use in other modules
window.StatusSection = StatusSection;