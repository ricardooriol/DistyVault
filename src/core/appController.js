/**
 * DistyVaultApp - Main application controller
 * Coordinates all components and manages application state
 */
class DistyVaultApp {
    constructor() {
        // Core services
        this.apiClient = new ApiClient();
        this.eventBus = new EventBus();

        // Application state
        this.knowledgeBase = [];
        this.currentFilter = 'all';
        this.refreshInterval = null;
        this.statusMonitorInterval = null;
        this.chronometerInterval = null;

        // Component managers
        this.downloadStateManager = null;
        this.tooltipManager = null;
        this.modalManager = null;
        this.bulkActionsManager = null;

        // UI components
        this.knowledgeBaseTable = null;
        this.inputSection = null;
        this.statusSection = null;
        this.settingsModal = null;

        // Backward compatibility
        this.selectedItems = new Set();

        this.init();
    }

    /**
     * Initialize the application
     */
    init() {
        this.setupEventListeners();
        this.initializeComponents();
        this.loadKnowledgeBase();
        this.startAutoRefresh();
        this.startChronometer();
        this.initializeTooltips();
    }

    /**
     * Set up global event listeners
     */
    setupEventListeners() {
        // Listen for API errors
        this.eventBus.on(EventBus.Events.ERROR_OCCURRED, this.handleError, this);

        // Listen for knowledge base updates
        this.eventBus.on(EventBus.Events.KNOWLEDGE_BASE_UPDATED, this.onKnowledgeBaseUpdated, this);

        // Listen for processing events
        this.eventBus.on(EventBus.Events.PROCESSING_STARTED, this.onProcessingStarted, this);
        this.eventBus.on(EventBus.Events.PROCESSING_COMPLETED, this.onProcessingCompleted, this);

        // Listen for selection changes
        this.eventBus.on(EventBus.Events.SELECTION_CHANGED, this.onSelectionChanged, this);
    }

    /**
     * Initialize all component managers and UI components
     */
    initializeComponents() {
        // Initialize component managers
        this.downloadStateManager = new DownloadStateManager();
        this.tooltipManager = new TooltipManager();
    this.modalManager = new ModalManager(this);
        this.bulkActionsManager = new BulkActionsManager(this);

        // Initialize UI components
        this.knowledgeBaseTable = new KnowledgeBaseTable(this);
        this.inputSection = new InputSection(this);
        this.statusSection = new StatusSection(this);
        this.settingsModal = new SettingsModal(this);

        // Set up backward compatibility
        this.selectedItems = this.bulkActionsManager.selectedItems;

        // Initialize all components
        this.knowledgeBaseTable.init();
        this.inputSection.init();
        this.statusSection.init();
        this.settingsModal.init();

        // Hide bulk actions bar initially to prevent flash
        const bulkActionsBar = DomUtils.getElementById('bulk-actions-bar');
        if (bulkActionsBar) {
            bulkActionsBar.style.display = 'none';
        }
    }

    /**
     * Load knowledge base data
     */
    async loadKnowledgeBase() {
        try {
            const data = await this.apiClient.getSummaries();
            this.knowledgeBase = this.sortKnowledgeBaseItems(data);

            // Emit event for components to react
            this.eventBus.emit(EventBus.Events.KNOWLEDGE_BASE_LOADED, this.knowledgeBase);

            // Delegate to table component
            if (this.knowledgeBaseTable) {
                this.knowledgeBaseTable.knowledgeBase = this.knowledgeBase;
                this.knowledgeBaseTable.renderKnowledgeBase();
            }

            return this.knowledgeBase;
        } catch (error) {
            console.error('Failed to load knowledge base:', error);
            this.eventBus.emit(EventBus.Events.ERROR_OCCURRED, {
                message: 'Failed to load knowledge base',
                error
            });
            return [];
        }
    }

    /**
     * Start automatic refresh monitoring
     */
    startAutoRefresh() {
        this.startStatusMonitoring();
    }

    /**
     * Start status monitoring for live updates
     */
    startStatusMonitoring() {
        this.statusMonitorInterval = setInterval(() => {
            this.checkForStatusUpdates();
        }, 2000);
    }

    /**
     * Start chronometer for processing time updates
     */
    startChronometer() {
        this.chronometerInterval = setInterval(() => {
            this.updateProcessingTimes();
        }, 500);
    }

    /**
     * Stop all automatic refresh intervals
     */
    stopAutoRefresh() {
        if (this.statusMonitorInterval) {
            clearInterval(this.statusMonitorInterval);
            this.statusMonitorInterval = null;
        }
        if (this.chronometerInterval) {
            clearInterval(this.chronometerInterval);
            this.chronometerInterval = null;
        }
    }

    /**
     * Check for status updates
     */
    async checkForStatusUpdates() {
        try {
            // Check if server is responsive before making requests
            const isResponsive = await this.apiClient.isServerResponsive();
            if (!isResponsive) {
                throw new Error('Server not responsive');
            }

            const latestData = await this.apiClient.getSummaries();

            // Check for changes
            const itemsToCheck = [...this.knowledgeBase];
            let needsReSort = false;

        itemsToCheck.forEach(oldItem => {
                const newItem = latestData.find(item => item.id === oldItem.id);
                if (newItem && this.hasItemChanged(oldItem, newItem)) {
            // Do NOT trigger full re-sort/rerender on mere status/title changes.
            // Our table sorts by createdAt to preserve queue order, so only
            // additions/removals require a re-sort. Status changes are handled via ITEM_UPDATED.

                    // Update item and emit event
                    const index = this.knowledgeBase.findIndex(item => item.id === oldItem.id);
                    if (index !== -1) {
                        this.knowledgeBase[index] = newItem;
                        this.eventBus.emit(EventBus.Events.ITEM_UPDATED, newItem);
                    }
                }
            });

            // Check for new items
            const newItems = latestData.filter(item =>
                !this.knowledgeBase.find(existing => existing.id === item.id)
            );

            if (newItems.length > 0) {
                this.knowledgeBase = this.sortKnowledgeBaseItems([...this.knowledgeBase, ...newItems]);
                newItems.forEach(item => {
                    this.eventBus.emit(EventBus.Events.ITEM_ADDED, item);
                });
                needsReSort = true;
            }

            // Check for deleted items
            const deletedItems = this.knowledgeBase.filter(oldItem =>
                !latestData.find(item => item.id === oldItem.id)
            );

            deletedItems.forEach(deletedItem => {
                const index = this.knowledgeBase.findIndex(item => item.id === deletedItem.id);
                if (index !== -1) {
                    this.knowledgeBase.splice(index, 1);
                    this.eventBus.emit(EventBus.Events.ITEM_DELETED, deletedItem);
                }
            });

            // Re-sort and re-render if needed
            if (needsReSort) {
                this.knowledgeBase = this.sortKnowledgeBaseItems(this.knowledgeBase);
                this.eventBus.emit(EventBus.Events.KNOWLEDGE_BASE_UPDATED, this.knowledgeBase);
            }

        } catch (error) {
            console.warn('Status update error:', error.message);
            
            // If we get connection errors, temporarily slow down the polling
            if (error.message && (
                error.message.includes('Load failed') || 
                error.message.includes('Could not connect') ||
                error.message.includes('Network request failed')
            )) {
                // Temporarily stop status monitoring for 10 seconds to avoid spam
                this.stopAutoRefresh();
                setTimeout(() => {
                    this.startAutoRefresh();
                }, 10000);
            }
        }
    }

    /**
     * Force immediate status update
     */
    forceStatusUpdate() {
        this.checkForStatusUpdates();
    }

    /**
     * Update processing times for live chronometer
     */
    updateProcessingTimes() {
        if (this.knowledgeBaseTable) {
            this.knowledgeBaseTable.updateProcessingTimes();
        }
    }

    /**
     * Check if an item has changed
     */
    hasItemChanged(oldItem, newItem) {
        return (
            newItem.status !== oldItem.status ||
            newItem.processingStep !== oldItem.processingStep ||
            newItem.title !== oldItem.title ||
            newItem.startTime !== oldItem.startTime ||
            newItem.distillingStartTime !== oldItem.distillingStartTime ||
            newItem.completedAt !== oldItem.completedAt ||
            newItem.processingTime !== oldItem.processingTime ||
            newItem.wordCount !== oldItem.wordCount ||
            newItem.error !== oldItem.error ||
            newItem.elapsedTime !== oldItem.elapsedTime ||
            newItem.content !== oldItem.content ||
            newItem.rawContent !== oldItem.rawContent ||
            newItem.sourceUrl !== oldItem.sourceUrl ||
            newItem.sourceType !== oldItem.sourceType ||
            JSON.stringify(newItem.sourceFile) !== JSON.stringify(oldItem.sourceFile) ||
            JSON.stringify(newItem.logs) !== JSON.stringify(oldItem.logs)
        );
    }

    /**
     * Sort knowledge base items
     */
    sortKnowledgeBaseItems(items) {
        if (this.knowledgeBaseTable) {
            return this.knowledgeBaseTable.sortKnowledgeBaseItems(items);
        }
        return items;
    }

    /**
     * Filter knowledge base
     */
    filterKnowledgeBase(searchTerm, type) {
        this.currentFilter = type;
        if (this.knowledgeBaseTable) {
            return this.knowledgeBaseTable.filterKnowledgeBase(searchTerm, type);
        }
    }

    /**
     * Initialize tooltips
     */
    initializeTooltips() {
        document.addEventListener('mouseover', (e) => {
            const element = e.target.closest('[data-tooltip]');
            if (element) {
                const tooltipText = element.getAttribute('data-tooltip');
                if (tooltipText && tooltipText.trim()) {
                    this.tooltipManager.showTooltip(element, tooltipText);
                }
            }
        });

        document.addEventListener('mouseout', (e) => {
            const element = e.target.closest('[data-tooltip]');
            if (element) {
                this.tooltipManager.hideTooltip();
            }
        });

        document.addEventListener('scroll', () => {
            this.tooltipManager.cleanupStuckTooltips();
        }, true);

        window.addEventListener('resize', () => {
            this.tooltipManager.cleanupStuckTooltips();
        });
    }

    // API wrapper methods using centralized client

    /**
     * Delete distillation
     */
    async deleteDistillation(id) {
        try {
            await this.apiClient.deleteSummary(id);

            // Remove from local data
            this.knowledgeBase = this.knowledgeBase.filter(item => item.id !== id);
            this.selectedItems.delete(id);

            // Emit events
            this.eventBus.emit(EventBus.Events.ITEM_DELETED, { id });
            this.eventBus.emit(EventBus.Events.KNOWLEDGE_BASE_UPDATED, this.knowledgeBase);

            // Update UI (row removal handled by table's ITEM_DELETED listener)
            const row = document.querySelector(`tr[data-id="${id}"]`);
            if (row) {
                row.remove();
            }

            this.showTemporaryMessage('Item deleted successfully', 'success');

        } catch (error) {
            console.error('Error deleting distillation:', error);
            this.showTemporaryMessage('Failed to delete item', 'error');
            this.eventBus.emit(EventBus.Events.ERROR_OCCURRED, {
                message: 'Failed to delete item',
                error
            });
        }
    }

    /**
     * Retry distillation
     * @param {string} id - The distillation ID to retry
     * @param {boolean} silent - If true, don't show individual success messages (for bulk operations)
     */
    async retryDistillation(id, silent = false) {
        try {
            await this.apiClient.retryDistillation(id);

            if (!silent) {
                this.showTemporaryMessage('Retry initiated', 'success');
            }

            this.forceStatusUpdate();
            this.eventBus.emit(EventBus.Events.PROCESSING_STARTED, { id });

        } catch (error) {
            // Gracefully handle already-deleted items
            if (error && /not found/i.test(String(error.message || ''))) {
                if (!silent) this.showTemporaryMessage('Item no longer exists', 'warning');
                return;
            }
            console.error('Error retrying distillation:', error);
            if (!silent) this.showTemporaryMessage('Failed to retry', 'error');
            // Avoid spamming global error bus for expected cases
            this.eventBus.emit(EventBus.Events.WARNING_OCCURRED, {
                message: 'Retry encountered an issue',
                error
            });
        }
    }

    /**
     * Stop processing
     */
    async stopProcessing(id) {
        try {
            const result = await this.apiClient.stopProcessing(id);

            if (result.message && result.message.includes('already completed')) {
                this.showTemporaryMessage('Process already completed', 'info');
            } else {
                this.showTemporaryMessage('Processing stopped', 'success');
            }

            this.forceStatusUpdate();
            this.eventBus.emit(EventBus.Events.PROCESSING_STOPPED, { id });

        } catch (error) {
            console.error('Error stopping processing:', error);

            // Don't show error message if it's just that the process is already completed
            if (error.message && (
                error.message.includes('Process not found') ||
                error.message.includes('already completed') ||
                error.message.includes('not a function')
            )) {
                this.showTemporaryMessage('Process already completed', 'info');
                this.forceStatusUpdate();
            } else if (error.status === 404) {
                this.showTemporaryMessage('Process already completed', 'info');
                this.forceStatusUpdate();
            } else {
                this.showTemporaryMessage('Failed to stop processing', 'error');
                // Don't emit error event for expected cases
                if (!error.message || !error.message.includes('already completed')) {
                    this.eventBus.emit(EventBus.Events.ERROR_OCCURRED, {
                        message: 'Failed to stop processing',
                        error
                    });
                }
            }
        }
    }

    /**
     * Handle download click
     */
    async handleDownloadClick(id) {
        const buttonId = `download-btn-${id}`;

        try {
            // Set download state
            this.downloadStateManager.setDownloadState(buttonId, 'downloading');

            // Attempt to prewarm cache just in case it's not ready yet
            try { await this.apiClient._ensurePdfCache(id); } catch {}

            const result = await this.apiClient.downloadPdf(id);

            // Create download
            const blob = result.blob;
            const contentDisposition = result.headers.get('Content-Disposition');
            let filename = `distillation-${id}.pdf`;

            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            this.downloadStateManager.setDownloadState(buttonId, 'completed');

        } catch (error) {
            // Check if the download was cancelled
            if (error.name === 'AbortError' || error.message === 'Request cancelled by user') {
                // Silently handle cancellation without logging
                this.downloadStateManager.setDownloadState(buttonId, 'idle');
                return;
            }
            
            console.error('Download error:', error);
            this.downloadStateManager.setDownloadState(buttonId, 'error');
            this.showTemporaryMessage('Download failed', 'error');
            this.eventBus.emit(EventBus.Events.ERROR_OCCURRED, {
                message: 'Download failed',
                error
            });
        }
    }

    /**
     * Show temporary message
     */
    showTemporaryMessage(message, type = 'info') {
        let messageContainer = document.getElementById('temp-message-container');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'temp-message-container';
            messageContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
            `;
            document.body.appendChild(messageContainer);
        }

        const messageElement = document.createElement('div');
        messageElement.style.cssText = `
            padding: 12px 16px;
            margin-bottom: 10px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease-out;
            background: ${type === 'success' ? '#4caf50' : type === 'warning' ? '#ff9800' : type === 'error' ? '#f44336' : '#2196f3'};
        `;

        messageElement.textContent = message;
        // Insert at the beginning to show newest notifications on top
        messageContainer.insertBefore(messageElement, messageContainer.firstChild);

        setTimeout(() => {
            messageElement.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.parentNode.removeChild(messageElement);
                }
            }, 300);
        }, 4000);
    }

    // Event handlers

    /**
     * Handle errors
     */
    handleError(errorData) {
        console.error('Application error:', errorData);
        // Could show user-friendly error messages here
    }

    /**
     * Handle knowledge base updates
     */
    onKnowledgeBaseUpdated(data) {
        if (this.knowledgeBaseTable) {
            this.knowledgeBaseTable.knowledgeBase = this.knowledgeBase;
            this.knowledgeBaseTable.renderKnowledgeBase();
        }
    }

    /**
     * Handle processing started
     */
    onProcessingStarted(data) {
        // Could show processing indicators
    }

    /**
     * Handle processing completed
     */
    onProcessingCompleted(data) {
        // Could show completion notifications
    }

    /**
     * Handle selection changes
     */
    onSelectionChanged(data) {
        // Update bulk actions UI
        if (this.bulkActionsManager) {
            this.bulkActionsManager.updateBulkActionsBar();
        }
    }

    // Backward compatibility methods - delegate to components

    // Input section delegation
    handleInputChange(value) {
        return this.inputSection?.handleInputChange(value);
    }

    handleFileSelection(files) {
        return this.inputSection?.handleFileSelection(files);
    }

    showFileDisplay(file) {
        return this.inputSection?.showFileDisplay(file);
    }

    removeFile() {
        return this.inputSection?.removeFile();
    }

    updateButtonStates() {
        return this.inputSection?.updateButtonStates();
    }

    get selectedFile() {
        return this.inputSection?.selectedFile;
    }

    set selectedFile(value) {
        if (this.inputSection) {
            this.inputSection.selectedFile = value;
        }
    }

    async startDistillation() {
        return this.inputSection?.startDistillation();
    }

    // Status section delegation
    showStatus(message, progress = 0) {
        return this.statusSection?.showStatus(message, progress);
    }

    hideStatus() {
        return this.statusSection?.hideStatus();
    }

    // Bulk actions delegation
    clearAllSelections() {
        return this.bulkActionsManager?.clearAllSelections();
    }

    forceBulkActionsRefresh() {
        return this.bulkActionsManager?.forceBulkActionsRefresh();
    }

    nuclearSelectionReset() {
        return this.bulkActionsManager?.nuclearSelectionReset();
    }

    handleRowSelection() {
        return this.bulkActionsManager?.handleRowSelection();
    }

    updateBulkActionsBar() {
        return this.bulkActionsManager?.updateBulkActionsBar();
    }

    toggleSelectAll() {
        return this.bulkActionsManager?.toggleSelectAll();
    }

    handleBulkDownloadClick() {
        return this.bulkActionsManager?.handleBulkDownloadClick();
    }

    async bulkDownload() {
        return this.bulkActionsManager?.bulkDownload();
    }

    async bulkDelete() {
        return this.bulkActionsManager?.bulkDelete();
    }

    async bulkRetry() {
        return this.bulkActionsManager?.bulkRetry();
    }

    async bulkRetryAll() {
        return this.bulkActionsManager?.bulkRetryAll();
    }

    async bulkRetryFailed() {
        return this.bulkActionsManager?.bulkRetryFailed();
    }

    getSelectedIds() {
        return this.bulkActionsManager?.getSelectedIds();
    }

    // Knowledge base table delegation
    renderKnowledgeBase() {
        return this.knowledgeBaseTable?.renderKnowledgeBase();
    }

    // Modal functions
    async showDistillationModal(id) {
        try {
            const distillation = await this.apiClient.getSummary(id);
            if (!distillation) {
                this.showTemporaryMessage('Distillation not found', 'error');
                return;
            }

            const modal = document.getElementById('distillation-modal');
            const title = document.getElementById('modal-title');
            const meta = document.getElementById('distillation-meta');
            const content = document.getElementById('distillation-content');

            if (modal && title && meta && content) {
                title.textContent = distillation.title || 'Distillation';

                // Create meta information
                const createdDate = new Date(distillation.createdAt).toLocaleDateString();
                const wordCount = distillation.wordCount || 0;
                const processingTime = distillation.processingTime ? `${distillation.processingTime.toFixed(1)}s` : 'N/A';

                meta.innerHTML = `
                    <div class="meta-item">
                        <strong>Created:</strong> ${createdDate}
                    </div>
                    <div class="meta-item">
                        <strong>Words:</strong> ${wordCount.toLocaleString()}
                    </div>
                    <div class="meta-item">
                        <strong>Processing Time:</strong> ${processingTime}
                    </div>
                `;

                content.innerHTML = distillation.content || 'No content available';
                
                // Reset scroll position to top
                this.resetModalScroll(modal, content);
                
                modal.style.display = 'block';
            }
        } catch (error) {
            console.error('Error showing distillation modal:', error);
            this.showTemporaryMessage('Failed to load distillation', 'error');
        }
    }

    async showLogs(id) {
        try {
            const distillation = await this.apiClient.getSummary(id);
            if (!distillation) {
                this.showTemporaryMessage('Distillation not found', 'error');
                return;
            }

            const modal = document.getElementById('logs-modal');
            const title = document.getElementById('logs-title');
            const content = document.getElementById('logs-content');

            if (modal && title && content) {
                title.textContent = `Processing Logs - ${distillation.title || 'Distillation'}`;

                const logs = distillation.logs || [];
                if (logs.length === 0) {
                    content.innerHTML = '<p>No logs available for this distillation.</p>';
                } else {
                    content.innerHTML = logs.map(log => {
                        const timestamp = new Date(log.timestamp).toLocaleTimeString();
                        return `<div class="log-entry">
                            <span class="log-timestamp">[${timestamp}]</span>
                            <span class="log-level log-${log.level}">${log.level.toUpperCase()}</span>
                            <span class="log-message">${log.message}</span>
                        </div>`;
                    }).join('');
                }

                // Reset scroll position to top
                this.resetModalScroll(modal, content);

                modal.style.display = 'block';
            }
        } catch (error) {
            console.error('Error showing logs modal:', error);
            this.showTemporaryMessage('Failed to load logs', 'error');
        }
    }

    async showRawContent(id) {
        try {
            const distillation = await this.apiClient.getSummary(id);
            if (!distillation) {
                this.showTemporaryMessage('Distillation not found', 'error');
                return;
            }

            const modal = document.getElementById('raw-content-modal');
            const title = document.getElementById('raw-content-title');
            const content = document.getElementById('raw-content-text');

            if (modal && title && content) {
                title.textContent = `Raw Content - ${distillation.title || 'Distillation'}`;
                content.textContent = distillation.rawContent || 'No raw content available';
                
                // Reset scroll position to top
                this.resetModalScroll(modal, content);
                
                modal.style.display = 'block';
            }
        } catch (error) {
            console.error('Error showing raw content modal:', error);
            this.showTemporaryMessage('Failed to load raw content', 'error');
        }
    }

    // Utility methods
    isValidUrl(string) {
        return ValidationUtils.isValidUrl(string);
    }

    /**
     * Reset scroll position for modal and its content areas
     * @param {HTMLElement} modal - The modal element
     * @param {HTMLElement} content - The main content element (optional)
     */
    resetModalScroll(modal, content = null) {
        if (modal) {
            // Immediate reset
            modal.scrollTop = 0;
            
            // Reset scroll for common scrollable elements within the modal
            const scrollableElements = modal.querySelectorAll('.modal-body, .modal-content, .distillation-content, .logs-content, .raw-content-text, #distillation-content, #logs-content, #raw-content-text');
            scrollableElements.forEach(element => {
                if (element && element.scrollTop !== undefined) {
                    element.scrollTop = 0;
                }
            });
            
            // Reset specific content element if provided
            if (content && content.scrollTop !== undefined) {
                content.scrollTop = 0;
            }
            
            // Additional reset after a short delay to ensure DOM is fully rendered
            setTimeout(() => {
                modal.scrollTop = 0;
                scrollableElements.forEach(element => {
                    if (element && element.scrollTop !== undefined) {
                        element.scrollTop = 0;
                    }
                });
                if (content && content.scrollTop !== undefined) {
                    content.scrollTop = 0;
                }
            }, 10);
        }
    }

    formatTimeDisplay(timeInSeconds) {
        return DateUtils.formatTimeDisplay(timeInSeconds);
    }

    calculateProcessingTimeDisplay(item) {
        return DateUtils.calculateProcessingTimeDisplay(item);
    }
}

// Export for use in other modules
window.DistyVaultApp = DistyVaultApp;