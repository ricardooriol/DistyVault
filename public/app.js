// Download State Management System
class DownloadStateManager {
    constructor() {
        this.downloadStates = new Map(); // buttonId -> DownloadState
    }

    createDownloadState(buttonId) {
        const state = {
            buttonId: buttonId,
            state: 'idle', // 'idle', 'loading', 'cancellable', 'error'
            downloadId: null,
            abortController: null,
            errorMessage: null,
            startTime: null,
            originalContent: null
        };
        this.downloadStates.set(buttonId, state);
        return state;
    }

    getDownloadState(buttonId) {
        return this.downloadStates.get(buttonId) || this.createDownloadState(buttonId);
    }

    setDownloadState(buttonId, newState, options = {}) {
        const state = this.getDownloadState(buttonId);

        // Validate state transition
        if (!this.isValidStateTransition(state.state, newState)) {
            console.warn(`Invalid state transition from ${state.state} to ${newState} for button ${buttonId}`);
            return state;
        }

        state.state = newState;

        if (options.downloadId) state.downloadId = options.downloadId;
        if (options.abortController) state.abortController = options.abortController;
        if (options.errorMessage) state.errorMessage = options.errorMessage;
        if (options.startTime) state.startTime = options.startTime;
        if (options.originalContent) state.originalContent = options.originalContent;

        // Set timeout for stuck states
        if (newState === 'loading') {
            this.setDownloadTimeout(buttonId);
        } else {
            this.clearDownloadTimeout(buttonId);
        }

        this.updateButtonUI(buttonId, state);
        return state;
    }

    isValidStateTransition(currentState, newState) {
        const validTransitions = {
            'idle': ['loading', 'error'],
            'loading': ['cancellable', 'idle', 'error'],
            'cancellable': ['loading', 'idle', 'error'],
            'error': ['idle', 'loading']
        };

        return validTransitions[currentState]?.includes(newState) || false;
    }

    setDownloadTimeout(buttonId) {
        this.clearDownloadTimeout(buttonId);
        const state = this.getDownloadState(buttonId);

        // Set 5 minute timeout for downloads
        state.timeoutId = setTimeout(() => {
            console.warn(`Download timeout for button ${buttonId}`);
            this.setDownloadState(buttonId, 'error', {
                errorMessage: 'Download timed out. Please try again.'
            });
        }, 5 * 60 * 1000);
    }

    clearDownloadTimeout(buttonId) {
        const state = this.getDownloadState(buttonId);
        if (state.timeoutId) {
            clearTimeout(state.timeoutId);
            state.timeoutId = null;
        }
    }

    updateButtonUI(buttonId, state) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        // Store original content if not already stored
        if (!state.originalContent) {
            state.originalContent = button.innerHTML;
        }

        // Remove existing listeners to prevent duplicates
        button.onmouseenter = null;
        button.onmouseleave = null;

        switch (state.state) {
            case 'idle':
                button.disabled = false;
                button.classList.remove('downloading', 'download-error', 'cancellable');
                if (state.originalContent) {
                    button.innerHTML = state.originalContent;
                }
                button.title = '';
                break;

            case 'loading':
                button.disabled = true;
                button.classList.add('downloading');
                button.classList.remove('download-error', 'cancellable');
                const iconSpan = button.querySelector('.btn-icon');
                const textSpan = button.querySelector('.btn-text');
                if (iconSpan && textSpan) {
                    iconSpan.innerHTML = '⏳';
                    textSpan.innerHTML = 'Downloading...';
                } else {
                    button.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Downloading...</span>';
                }
                button.title = 'Hover to cancel';

                // Add mouse enter listener to switch to cancellable state
                button.onmouseenter = () => {
                    this.setDownloadState(buttonId, 'cancellable');
                };
                break;

            case 'cancellable':
                button.disabled = false;
                button.classList.add('downloading', 'cancellable');
                const cancelIconSpan = button.querySelector('.btn-icon');
                const cancelTextSpan = button.querySelector('.btn-text');
                if (cancelIconSpan && cancelTextSpan) {
                    cancelIconSpan.innerHTML = '❌';
                    cancelTextSpan.innerHTML = 'Cancel';
                } else {
                    button.innerHTML = '<span class="btn-icon">❌</span><span class="btn-text">Cancel</span>';
                }
                button.title = 'Click to cancel download';

                // Add mouse leave listener to revert to loading state
                button.onmouseleave = () => {
                    this.setDownloadState(buttonId, 'loading');
                };
                break;

            case 'error':
                button.disabled = false;
                button.classList.add('download-error');
                button.classList.remove('downloading', 'cancellable');
                const errorIconSpan = button.querySelector('.btn-icon');
                const errorTextSpan = button.querySelector('.btn-text');
                if (errorIconSpan && errorTextSpan) {
                    errorIconSpan.innerHTML = '⚠️';
                    errorTextSpan.innerHTML = 'Error';
                } else {
                    button.innerHTML = '<span class="btn-icon">⚠️</span><span class="btn-text">Error</span>';
                }
                button.title = state.errorMessage || 'Download failed';

                // Auto-reset to idle after 3 seconds
                setTimeout(() => {
                    if (this.getDownloadState(buttonId).state === 'error') {
                        this.setDownloadState(buttonId, 'idle');
                    }
                }, 3000);
                break;
        }
    }

    cancelDownload(buttonId) {
        const state = this.getDownloadState(buttonId);

        // Abort the download if in progress
        if (state.abortController) {
            state.abortController.abort();
            state.abortController = null;
        }

        // Clear timeout
        this.clearDownloadTimeout(buttonId);

        // Reset all state properties
        state.downloadId = null;
        state.errorMessage = null;
        state.startTime = null;

        // Set to idle state
        this.setDownloadState(buttonId, 'idle');
    }

    clearDownloadState(buttonId) {
        this.downloadStates.delete(buttonId);
    }
}

// Viewport Boundary Detection Utilities
class ViewportUtils {
    static getViewportDimensions() {
        return {
            width: window.innerWidth,
            height: window.innerHeight
        };
    }

    static getElementPosition(element) {
        const rect = element.getBoundingClientRect();
        return {
            top: rect.top,
            left: rect.left,
            bottom: rect.bottom,
            right: rect.right,
            width: rect.width,
            height: rect.height
        };
    }

    static calculateAvailableSpace(element) {
        const elementPos = this.getElementPosition(element);
        const viewport = this.getViewportDimensions();

        return {
            top: elementPos.top,
            bottom: viewport.height - elementPos.bottom,
            left: elementPos.left,
            right: viewport.width - elementPos.right
        };
    }

    static wouldExtendBeyondViewport(element, dropdownWidth, dropdownHeight) {
        const elementPos = this.getElementPosition(element);
        const viewport = this.getViewportDimensions();

        return {
            right: (elementPos.right + dropdownWidth) > viewport.width,
            bottom: (elementPos.bottom + dropdownHeight) > viewport.height,
            left: (elementPos.left - dropdownWidth) < 0,
            top: (elementPos.top - dropdownHeight) < 0
        };
    }

    static getOptimalDropdownPosition(triggerElement, dropdownElement) {
        const triggerPos = this.getElementPosition(triggerElement);
        const dropdownRect = dropdownElement.getBoundingClientRect();
        const viewport = this.getViewportDimensions();

        let position = {
            top: triggerPos.bottom + 4, // Default: below trigger
            left: triggerPos.right - dropdownRect.width // Default: right-aligned
        };

        // Check if dropdown extends beyond right edge
        if (position.left + dropdownRect.width > viewport.width - 10) {
            position.left = triggerPos.left; // Left-align instead
        }

        // Check if dropdown extends beyond left edge
        if (position.left < 10) {
            position.left = 10;
        }

        // Check if dropdown extends beyond bottom edge
        if (position.top + dropdownRect.height > viewport.height - 10) {
            position.top = triggerPos.top - dropdownRect.height - 4; // Position above
        }

        // Check if dropdown extends beyond top edge
        if (position.top < 10) {
            position.top = triggerPos.bottom + 4; // Force below
        }

        return position;
    }
}

// Enhanced Tooltip Manager - Fixed positioning and stuck tooltip issues
class TooltipManager {
    constructor() {
        this.activeTooltip = null;
        this.showTimeoutId = null;
        this.hideTimeoutId = null;
        this.targetElement = null;
        this.isMouseOverTooltip = false;
    }

    showTooltip(element, text) {
        try {
            // Clear any pending hide timeout
            if (this.hideTimeoutId) {
                clearTimeout(this.hideTimeoutId);
                this.hideTimeoutId = null;
            }

            // If tooltip is already showing for this element, don't recreate
            if (this.activeTooltip && this.targetElement === element) {
                return;
            }

            this.cleanup();

            if (!element || !text || typeof text !== 'string' || text.trim() === '') {
                return;
            }

            // Only show tooltip if text is actually truncated
            if (!this.isTextTruncated(element, text)) {
                return;
            }

            // Delay showing tooltip to prevent flickering
            this.showTimeoutId = setTimeout(() => {
                this.createTooltip(element, text);
            }, 300);

        } catch (error) {
            console.warn('Error showing tooltip:', error);
            this.cleanup();
        }
    }

    createTooltip(element, text) {
        try {
            // Create tooltip
            this.activeTooltip = document.createElement('div');
            this.activeTooltip.className = 'tooltip';
            this.activeTooltip.textContent = text;
            document.body.appendChild(this.activeTooltip);

            // Position tooltip above the element with proper centering
            const elementRect = element.getBoundingClientRect();
            const tooltipRect = this.activeTooltip.getBoundingClientRect();

            let left = elementRect.left + (elementRect.width / 2) - (tooltipRect.width / 2);
            let top = elementRect.top;

            // Keep tooltip within viewport bounds
            const padding = 10;
            if (left < padding) {
                left = padding;
            } else if (left + tooltipRect.width > window.innerWidth - padding) {
                left = window.innerWidth - tooltipRect.width - padding;
            }

            // Ensure tooltip doesn't go above viewport
            if (top < padding + tooltipRect.height) {
                top = elementRect.bottom + 8;
                // Flip arrow direction if showing below
                this.activeTooltip.classList.add('tooltip-below');
            }

            this.activeTooltip.style.left = left + 'px';
            this.activeTooltip.style.top = top + 'px';
            this.activeTooltip.classList.add('show');

            this.targetElement = element;

        } catch (error) {
            console.warn('Error creating tooltip:', error);
            this.cleanup();
        }
    }

    hideTooltip() {
        // Delay hiding to prevent flickering when moving between elements
        this.hideTimeoutId = setTimeout(() => {
            this.cleanup();
        }, 100);
    }

    isTextTruncated(element, text) {
        // Check if the element's content is actually truncated
        const tempSpan = document.createElement('span');
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.position = 'absolute';
        tempSpan.style.whiteSpace = 'nowrap';
        tempSpan.style.font = window.getComputedStyle(element).font;
        tempSpan.textContent = text;
        document.body.appendChild(tempSpan);

        const isOverflowing = tempSpan.offsetWidth > element.offsetWidth;
        document.body.removeChild(tempSpan);

        return isOverflowing;
    }

    cleanup() {
        if (this.showTimeoutId) {
            clearTimeout(this.showTimeoutId);
            this.showTimeoutId = null;
        }

        if (this.hideTimeoutId) {
            clearTimeout(this.hideTimeoutId);
            this.hideTimeoutId = null;
        }

        if (this.activeTooltip) {
            this.activeTooltip.remove();
            this.activeTooltip = null;
        }

        this.targetElement = null;
        this.isMouseOverTooltip = false;
    }

    cleanupStuckTooltips() {
        // Emergency cleanup for any stuck tooltips
        const stuckTooltips = document.querySelectorAll('.tooltip');
        stuckTooltips.forEach(tooltip => tooltip.remove());
        this.cleanup();
    }
}

// SAWRON App JavaScript
class SawronApp {
    constructor() {
        this.knowledgeBase = [];
        this.currentFilter = 'all';
        this.selectedFile = null;
        this.refreshInterval = null;
        this.selectedItems = new Set(); // Track selected item IDs
        this.downloadStateManager = new DownloadStateManager();
        this.tooltipManager = new TooltipManager();
        this.init();
    }

    init() {
        this.setupEventListeners();
        // Hide bulk actions bar initially to prevent flash
        const bulkActionsBar = document.getElementById('bulk-actions-bar');
        if (bulkActionsBar) {
            bulkActionsBar.style.display = 'none';
        }
        this.loadKnowledgeBase();
        this.startAutoRefresh();
        this.startChronometer();
        this.initializeTooltips();
    }

    setupEventListeners() {
        // Main input field
        const mainInput = document.getElementById('main-input');
        mainInput.addEventListener('input', (e) => {
            this.handleInputChange(e.target.value);
        });

        // File input
        const fileInput = document.getElementById('file-input');
        fileInput.addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files);
        });

        // Search and filter
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.filterKnowledgeBase(e.target.value, this.currentFilter);
        });

        document.getElementById('filter-select').addEventListener('change', (e) => {
            this.currentFilter = e.target.value;
            this.filterKnowledgeBase(document.getElementById('search-input').value, this.currentFilter);
        });

        // Modal close
        document.getElementById('distillation-modal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeDistillationModal();
            }
        });

        document.getElementById('raw-content-modal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeRawContentModal();
            }
        });

        document.getElementById('logs-modal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeLogsModal();
            }
        });

        // Drag and drop on the entire input section
        const inputSection = document.querySelector('.input-section');
        const dropzone = document.getElementById('dropzone');

        inputSection.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--primary-orange)';
            dropzone.style.color = 'var(--text-secondary)';
        });

        inputSection.addEventListener('dragleave', (e) => {
            if (!inputSection.contains(e.relatedTarget)) {
                dropzone.style.borderColor = 'var(--border-color)';
                dropzone.style.color = 'var(--text-muted)';
            }
        });

        inputSection.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--border-color)';
            dropzone.style.color = 'var(--text-muted)';
            this.handleFileSelection(e.dataTransfer.files);
        });

        // Click handler for dropzone
        dropzone.addEventListener('click', () => {
            document.getElementById('file-input').click();
        });
    }

    handleInputChange(value) {
        const trimmedValue = value.trim();

        // Clear file selection if user types in input
        if (trimmedValue && this.selectedFile) {
            this.removeFile();
        }

        // Update button states
        this.updateButtonStates();
    }

    handleFileSelection(files) {
        if (!files || files.length === 0) return;

        const file = files[0]; // Take only the first file

        // Clear input field if file is selected
        const mainInput = document.getElementById('main-input');
        if (mainInput.value.trim()) {
            mainInput.value = '';
        }

        this.selectedFile = file;
        this.showFileDisplay(file);
        this.updateButtonStates();
    }

    showFileDisplay(file) {
        const fileDisplay = document.getElementById('file-display');
        const fileName = document.getElementById('file-name');

        fileName.textContent = file.name;
        fileDisplay.style.display = 'block';
    }

    removeFile() {
        this.selectedFile = null;
        document.getElementById('file-display').style.display = 'none';
        document.getElementById('file-input').value = '';
        this.updateButtonStates();
    }

    updateButtonStates() {
        const mainInput = document.getElementById('main-input');
        const distillBtn = document.getElementById('distill-btn');

        const hasText = mainInput.value.trim().length > 0;
        const hasFile = this.selectedFile !== null;

        // Distill button: enabled if there's text or file selected
        if (hasText || hasFile) {
            distillBtn.classList.remove('disabled');
        } else {
            distillBtn.classList.add('disabled');
        }
    }

    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    showStatus(message, progress = 0) {
        const statusSection = document.getElementById('status-section');
        const statusMessage = document.getElementById('status-message');
        const progressFill = document.getElementById('progress-fill');

        statusSection.style.display = 'block';
        statusMessage.textContent = message;
        progressFill.style.width = `${progress}%`;

    }

    hideStatus() {
        document.getElementById('status-section').style.display = 'none';
    }

    async startDistillation() {
        const distillBtn = document.getElementById('distill-btn');
        if (distillBtn.classList.contains('disabled')) {
            return;
        }

        const mainInput = document.getElementById('main-input');
        const url = mainInput.value.trim();

        try {
            if (this.selectedFile) {
                // Process file
                this.showStatus(`Processing ${this.selectedFile.name}...`, 25);

                const formData = new FormData();
                formData.append('file', this.selectedFile);

                const response = await fetch('/api/process/file', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to process file');
                }

                const result = await response.json();
                this.showStatus(`File uploaded. Processing in background...`, 100);
                setTimeout(() => this.hideStatus(), 2000);

                this.removeFile();
                // Force MULTIPLE status updates to detect new item
                this.forceStatusUpdate();
                setTimeout(() => this.forceStatusUpdate(), 100);
                setTimeout(() => this.forceStatusUpdate(), 500);
                setTimeout(() => this.forceStatusUpdate(), 1000);
                setTimeout(() => this.forceStatusUpdate(), 2000);

            } else if (url) {
                // Process URL
                this.showStatus('Processing URL...', 25);

                const response = await fetch('/api/process/url', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ url })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to process URL');
                }

                const result = await response.json();
                this.showStatus(`URL submitted. Processing in background...`, 100);
                setTimeout(() => this.hideStatus(), 2000);

                mainInput.value = '';
                // Force MULTIPLE status updates to detect new item
                this.forceStatusUpdate();
                setTimeout(() => this.forceStatusUpdate(), 100);
                setTimeout(() => this.forceStatusUpdate(), 500);
                setTimeout(() => this.forceStatusUpdate(), 1000);
                setTimeout(() => this.forceStatusUpdate(), 2000);
            }

            this.updateButtonStates();

        } catch (error) {
            console.error('Error during distillation:', error);
            alert('Error: ' + error.message);
            this.hideStatus();
        }
    }

    startAutoRefresh() {
        // Start targeted status monitoring instead of full table refresh
        this.startStatusMonitoring();
    }

    startStatusMonitoring() {
        // Monitor for status changes every 2 seconds - much more reasonable
        this.statusMonitorInterval = setInterval(() => {
            this.checkForStatusUpdates();
        }, 2000);
    }

    startChronometer() {
        // Update processing times every 500ms for smooth live chronometer
        this.chronometerInterval = setInterval(() => {
            this.updateProcessingTimes();
        }, 500);
    }

    formatTimeDisplay(timeInSeconds) {
        // Helper function for consistent time formatting
        const totalSeconds = Math.floor(timeInSeconds);
        if (totalSeconds < 60) {
            return `${totalSeconds}s`;
        } else {
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes}m ${seconds}s`;
        }
    }

    calculateProcessingTimeDisplay(item) {
        // Centralized time calculation to ensure consistency
        if (item.processingTime && item.status === 'completed') {
            return this.formatTimeDisplay(item.processingTime);
        } else if (item.status === 'pending') {
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

    updateProcessingTimes() {
        // Update processing times for items that are currently processing
        const processingItems = this.knowledgeBase.filter(item =>
            ['extracting', 'distilling'].includes(item.status) && item.startTime
        );

        processingItems.forEach(item => {
            const row = document.querySelector(`tr[data-id="${item.id}"]`);
            if (row) {
                const timeCell = row.querySelector('.time-cell');
                if (timeCell) {
                    const timeDisplay = this.calculateProcessingTimeDisplay(item);

                    // Only update if the time display actually changed to prevent flickering
                    if (timeDisplay && timeCell.textContent !== timeDisplay) {
                        timeCell.textContent = timeDisplay;
                    }
                }
            }
        });
    }

    initializeTooltips() {
        // Set up tooltip event listeners for truncated text elements
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

        // Clean up stuck tooltips on scroll or window events
        document.addEventListener('scroll', () => {
            this.tooltipManager.cleanupStuckTooltips();
        }, true);

        window.addEventListener('resize', () => {
            this.tooltipManager.cleanupStuckTooltips();
        });
    }

    forceStatusUpdate() {
        // Force an immediate status update (used after retry operations)
        this.checkForStatusUpdates();
    }

    async checkForStatusUpdates() {
        try {
            // Fetch latest data with error handling
            const response = await fetch('/api/summaries');
            if (!response.ok) {
                console.warn('Failed to fetch summaries:', response.status);
                return;
            }

            const latestData = await response.json();

            // Check ALL items for any changes
            const itemsToCheck = [...this.knowledgeBase];
            itemsToCheck.forEach(oldItem => {
                const newItem = latestData.find(item => item.id === oldItem.id);
                if (newItem && this.hasItemChanged(oldItem, newItem)) {
                    // Status change detected - update silently
                    this.updateSingleRow(newItem);
                    // Update our local data
                    const index = this.knowledgeBase.findIndex(item => item.id === oldItem.id);
                    if (index !== -1) {
                        this.knowledgeBase[index] = newItem;
                    }
                }
            });

            // Check for any new items that might have been added
            const newItems = latestData.filter(item =>
                !this.knowledgeBase.find(existing => existing.id === item.id)
            );

            if (newItems.length > 0) {
                // Add new items and re-sort to maintain proper chronological order (newest first)
                this.knowledgeBase = [...this.knowledgeBase, ...newItems]
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                // Re-render the entire table to maintain proper order
                this.renderKnowledgeBase();
            }

            // Check for deleted items
            const deletedItems = this.knowledgeBase.filter(oldItem =>
                !latestData.find(item => item.id === oldItem.id)
            );

            deletedItems.forEach(deletedItem => {
                const index = this.knowledgeBase.findIndex(item => item.id === deletedItem.id);
                if (index !== -1) {
                    this.knowledgeBase.splice(index, 1);
                    const row = document.querySelector(`tr[data-id="${deletedItem.id}"]`);
                    if (row) {
                        row.remove();
                    }
                }
            });

        } catch (error) {
            // Silently handle network errors to prevent console spam
            console.warn('Status update error:', error.message);
        }
    }

    clearAllSelections() {
        // Clear the selectedItems set
        this.selectedItems.clear();

        // Uncheck all checkboxes in the DOM
        const allCheckboxes = document.querySelectorAll('.row-checkbox');
        allCheckboxes.forEach(checkbox => checkbox.checked = false);

        // Update the bulk actions bar
        this.updateBulkActionsBar();
    }

    forceBulkActionsRefresh() {
        // Force clear selections and refresh bulk actions bar
        this.selectedItems.clear();

        // Uncheck all checkboxes in the DOM
        const allCheckboxes = document.querySelectorAll('.row-checkbox');
        allCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                checkbox.checked = false;
            }
        });

        // Force update the bulk actions bar
        this.updateBulkActionsBar();

        // Also call handleRowSelection to ensure consistency
        this.handleRowSelection();
    }

    nuclearSelectionReset() {
        // Complete reset of selection state
        this.selectedItems = new Set();

        // Uncheck ALL checkboxes
        const allCheckboxes = document.querySelectorAll('.row-checkbox');
        allCheckboxes.forEach(checkbox => checkbox.checked = false);

        // Update the bulk actions bar
        this.updateBulkActionsBar();
        if (bulkDeleteBtn) bulkDeleteBtn.disabled = true;


    }

    handleRowSelection() {
        // Update selected items set based on checkbox states
        this.selectedItems.clear();
        const checkboxes = document.querySelectorAll('.row-checkbox:checked');
        checkboxes.forEach(checkbox => {
            this.selectedItems.add(checkbox.dataset.id);
        });

        // Update bulk actions bar visibility and content
        this.updateBulkActionsBar();
    }

    updateBulkActionsBar() {
        const bulkActionsBar = document.getElementById('bulk-actions-bar');
        const selectedCount = document.getElementById('selected-count');
        const bulkRetryBtn = document.getElementById('bulk-retry-btn');
        const bulkDownloadBtn = document.getElementById('bulk-download-btn');
        const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
        const selectAllBtn = document.getElementById('select-all-btn');

        // Sync selectedItems with actual checked checkboxes to ensure consistency
        const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');
        const actualSelectedIds = new Set(Array.from(checkedBoxes).map(cb => cb.dataset.id));

        // Also clean up selectedItems to remove any IDs that no longer exist in the DOM
        const allCheckboxIds = new Set(Array.from(document.querySelectorAll('.row-checkbox')).map(cb => cb.dataset.id));
        const cleanedSelectedItems = new Set();
        this.selectedItems.forEach(id => {
            if (allCheckboxIds.has(id)) {
                cleanedSelectedItems.add(id);
            }
        });

        // Update selectedItems to match actual DOM state (both checked and existing)
        this.selectedItems = actualSelectedIds;

        const selectedCount_value = this.selectedItems.size;
        const allCheckboxes = document.querySelectorAll('.row-checkbox');
        const totalCount = allCheckboxes.length;

        if (selectedCount_value > 0) {
            bulkActionsBar.style.display = 'flex';
            selectedCount.textContent = `${selectedCount_value} selected`;

            // Enable bulk action buttons
            bulkRetryBtn.disabled = false;
            bulkDeleteBtn.disabled = false;

            // Check if any selected items are completed for download
            const selectedItemsData = Array.from(this.selectedItems).map(id =>
                this.knowledgeBase.find(item => item.id === id)
            ).filter(Boolean);

            const hasCompletedItems = selectedItemsData.some(item => item.status === 'completed');

            // Only disable download button if no completed items AND not currently downloading
            const downloadState = this.downloadStateManager.getDownloadState('bulk-download-btn');
            if (downloadState.state === 'idle') {
                bulkDownloadBtn.disabled = !hasCompletedItems;
            }
            // If downloading, let the downloadStateManager handle the button state

            // Update select all button text based on actual selection state
            if (selectedCount_value === totalCount && totalCount > 0) {
                selectAllBtn.innerHTML = '<span class="btn-text">Unselect All</span>';
            } else {
                selectAllBtn.innerHTML = '<span class="btn-text">Select All</span>';
            }
        } else {
            bulkActionsBar.style.display = 'flex'; // Keep visible but disable buttons
            selectedCount.textContent = '0 selected';

            // Disable bulk action buttons
            bulkRetryBtn.disabled = true;
            bulkDeleteBtn.disabled = true;

            // Only disable download button if not currently downloading
            const downloadState = this.downloadStateManager.getDownloadState('bulk-download-btn');
            if (downloadState.state === 'idle') {
                bulkDownloadBtn.disabled = true;
            }

            // Reset select all button
            selectAllBtn.innerHTML = '<span class="btn-text">Select All</span>';
        }
    }

    toggleSelectAll() {
        const allCheckboxes = document.querySelectorAll('.row-checkbox');
        const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');
        const shouldSelectAll = checkedBoxes.length !== allCheckboxes.length;

        if (shouldSelectAll) {
            // Select all
            allCheckboxes.forEach(checkbox => {
                checkbox.checked = true;
                this.selectedItems.add(checkbox.dataset.id);
            });
        } else {
            // Deselect all
            allCheckboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            this.selectedItems.clear();
        }

        this.updateBulkActionsBar();
    }

    hasItemChanged(oldItem, newItem) {
        // Comprehensive change detection - checks all relevant fields
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

    updateSingleRow(item) {
        const row = document.querySelector(`tr[data-id="${item.id}"]`);
        if (!row) return;

        // Check if this is a processing item with live chronometer
        const isProcessing = ['pending', 'extracting', 'distilling'].includes(item.status);
        const hasStartTime = item.startTime;
        const shouldPreserveTime = isProcessing && hasStartTime;

        if (shouldPreserveTime) {
            // Update individual cells to preserve the live chronometer
            this.updateRowCellsSelectively(row, item);
        } else {
            // Replace the entire row for non-processing items
            const newRowHtml = this.createTableRow(item);
            row.outerHTML = newRowHtml;
        }
    }

    updateRowCellsSelectively(row, item) {
        // Update only specific cells, preserving the time cell for live chronometer
        const statusConfig = this.getStatusConfig(item.status);
        const statusClass = statusConfig.class;
        const statusText = statusConfig.text;
        const statusDisplay = `<span class="status-icon">${statusConfig.icon}</span>${statusText}`;

        // Update status cell
        const statusCell = row.querySelector('.status-cell');
        if (statusCell) {
            statusCell.className = `status-cell ${statusClass} truncate-text`;
            statusCell.innerHTML = statusDisplay;
            // No tooltip for status cell
        }

        // Update title cell if it changed
        const titleCell = row.querySelector('.title-cell');
        if (titleCell && item.title) {
            const truncatedTitle = item.title.length > 50 ? item.title.substring(0, 50) + '...' : item.title;
            titleCell.textContent = truncatedTitle;
            titleCell.setAttribute('data-tooltip', item.title);
        }

        // Update actions cell
        const actionsCell = row.querySelector('.actions-cell');
        if (actionsCell) {
            actionsCell.innerHTML = this.createActionsDropdown(item);
        }

        // Note: We intentionally don't update the time cell to preserve the live chronometer
    }

    addSingleRow(item) {
        const tbody = document.getElementById('knowledge-base-tbody');
        const newRowHtml = this.createTableRow(item);

        // Check if table is empty (has empty state)
        const emptyState = tbody.querySelector('.empty-state-cell');
        if (emptyState) {
            tbody.innerHTML = newRowHtml;
        } else {
            // Add to the beginning of the table
            tbody.insertAdjacentHTML('afterbegin', newRowHtml);
        }
    }

    getStatusConfig(status) {
        const STATUS_CONFIG = {
            'pending': { icon: '⏳', text: 'QUEUED', class: 'status-queued' },
            'extracting': { icon: '🔍', text: 'EXTRACTING', class: 'status-processing' },
            'distilling': { icon: '💠', text: 'DISTILLING', class: 'status-processing' },
            'completed': { icon: '✅', text: 'COMPLETED', class: 'status-completed' },
            'error': { icon: '❌', text: 'ERROR', class: 'status-error' },
            'stopped': { icon: '⏹️', text: 'STOPPED', class: 'status-stopped' }
        };
        return STATUS_CONFIG[status] || { icon: '⏳', text: 'QUEUED', class: 'status-queued' };
    }

    createActionsDropdown(item) {
        const isCompleted = item.status === 'completed';
        const isProcessing = ['pending', 'extracting', 'distilling'].includes(item.status);
        const isError = item.status === 'error';

        return `
            <div class="action-dropdown" onclick="app.toggleActionDropdown(event, '${item.id}')">
                <button class="action-dropdown-btn">
                    Action
                    <span style="font-size: 0.7rem;">▼</span>
                </button>
                <div class="action-dropdown-content" id="dropdown-${item.id}" onclick="event.stopPropagation()">
                    ${isCompleted ? `
                        <button class="action-dropdown-item" onclick="event.stopPropagation(); app.showDistillationModal('${item.id}'); app.closeAllDropdowns();">
                            📄 View
                        </button>
                        <button class="action-dropdown-item" id="download-btn-${item.id}" 
                                onclick="event.stopPropagation(); app.handleDownloadClick('${item.id}'); app.closeAllDropdowns();">
                            <span class="btn-icon">📥</span>
                            <span class="btn-text">Download</span>
                        </button>
                    ` : ''}
                    ${isProcessing ? `
                        <button class="action-dropdown-item" onclick="event.stopPropagation(); app.stopProcessing('${item.id}'); app.closeAllDropdowns();">
                            ⏹️ Stop
                        </button>
                    ` : ''}
                    <button class="action-dropdown-item retry-item" onclick="event.stopPropagation(); app.retryDistillation('${item.id}'); app.closeAllDropdowns();">
                        🔄 Retry
                    </button>
                    ${(isCompleted || isError) && item.rawContent ? `
                        <button class="action-dropdown-item" onclick="event.stopPropagation(); app.showRawContent('${item.id}'); app.closeAllDropdowns();">
                            🔍 View Raw
                        </button>
                    ` : ''}
                    <button class="action-dropdown-item" onclick="event.stopPropagation(); app.showLogs('${item.id}'); app.closeAllDropdowns();">
                        📋 Logs
                    </button>
                    <button class="action-dropdown-item delete-item" onclick="event.stopPropagation(); app.deleteDistillation('${item.id}'); app.closeAllDropdowns();">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
    }



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

    initializeTooltips() {
        // Add event delegation for tooltips on truncated text elements
        document.addEventListener('mouseenter', (e) => {
            const element = e.target;

            // Check if element is a truncated cell that should show tooltip
            if (this.shouldShowTooltip(element)) {
                const text = this.getTooltipText(element);
                if (text) {
                    this.tooltipManager.showTooltip(element, text);
                }
            }
        }, true);

        document.addEventListener('mouseleave', (e) => {
            const element = e.target;

            // Hide tooltip when leaving truncated elements
            if (this.shouldShowTooltip(element)) {
                this.tooltipManager.hideTooltip();
            }
        }, true);

        // Emergency cleanup on window events
        window.addEventListener('resize', () => {
            this.tooltipManager.cleanupStuckTooltips();
        });

        window.addEventListener('scroll', () => {
            this.tooltipManager.cleanupStuckTooltips();
        }, true);

        // Cleanup on page visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.tooltipManager.cleanupStuckTooltips();
            }
        });
    }

    shouldShowTooltip(element) {
        // Only show tooltips for name and source columns, NOT status column
        // Also check that we're not in a status cell
        const isInStatusCell = element.classList.contains('status-cell') || element.closest('.status-cell');
        if (isInStatusCell) {
            return false;
        }

        return element.classList.contains('name-cell') ||
            element.classList.contains('source-cell') ||
            element.closest('.name-cell') ||
            element.closest('.source-cell');
    }

    getTooltipText(element) {
        // Get the appropriate text content for tooltip
        const cell = element.closest('.name-cell, .source-cell') || element;

        if (cell.classList.contains('name-cell')) {
            // For name cells, get the data-tooltip attribute which contains the full name
            return cell.getAttribute('data-tooltip') || cell.textContent.trim();
        } else if (cell.classList.contains('source-cell')) {
            const link = cell.querySelector('a');
            return link ? link.href : cell.textContent.trim();
        }

        return cell.textContent.trim();
    }



    async loadKnowledgeBase() {
        try {
            const response = await fetch('/api/summaries');
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Validate data structure
            if (!Array.isArray(data)) {
                throw new Error('Invalid data format received from server');
            }

            this.knowledgeBase = data;
            this.knowledgeBaseData = this.knowledgeBase; // Store for chronometer updates

            this.renderKnowledgeBase();

            // Ensure bulk actions bar visibility is correct after initial load
            this.updateBulkActionsBar();
        } catch (error) {
            console.error('Error loading knowledge base:', error);

            // Show fallback UI or retry mechanism
            if (!this.knowledgeBase || this.knowledgeBase.length === 0) {
                // If we have no cached data, show error state
                const tbody = document.getElementById('knowledge-base-tbody');
                if (tbody) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="8" class="empty-state-cell">
                                <div class="empty-state">
                                    <div class="empty-icon">⚠️</div>
                                    <h3>Failed to Load Knowledge Base</h3>
                                    <p>Unable to connect to server. Please check your connection and try again.</p>
                                    <button onclick="app.loadKnowledgeBase()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--primary-orange); color: white; border: none; border-radius: 4px; cursor: pointer;">Retry</button>
                                </div>
                            </td>
                        </tr>
                    `;
                }
                // Hide bulk actions bar when there's an error and no data
                const bulkActionsBar = document.getElementById('bulk-actions-bar');
                if (bulkActionsBar) {
                    bulkActionsBar.style.display = 'none';
                }
            }
        }
    }

    filterKnowledgeBase(searchTerm, type) {
        let filtered = this.knowledgeBase;

        if (type !== 'all') {
            filtered = filtered.filter(s => s.sourceType === type);
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(s =>
                (s.title && s.title.toLowerCase().includes(term)) ||
                (s.content && s.content.toLowerCase().includes(term))
            );
        }

        this.renderFilteredKnowledgeBase(filtered);
    }

    renderKnowledgeBase() {
        const searchTerm = document.getElementById('search-input').value;
        this.filterKnowledgeBase(searchTerm, this.currentFilter);
    }

    renderFilteredKnowledgeBase(items) {
        const tbody = document.getElementById('knowledge-base-tbody');
        const bulkActionsBar = document.getElementById('bulk-actions-bar');

        // Preserve dropdown state before re-rendering
        const openDropdown = document.querySelector('.action-dropdown.show');
        const openDropdownId = openDropdown ? openDropdown.closest('tr')?.dataset.id : null;

        if (!items || items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-state-cell">
                        <div class="empty-state">
                            <div class="empty-icon">🎯</div>
                            <h3>Ready to Process Knowledge</h3>
                            <p>Start by entering a URL, YouTube video, or uploading a document above.</p>
                        </div>
                    </td>
                </tr>
            `;
            // Hide bulk actions bar when empty and clear selections
            if (bulkActionsBar) {
                bulkActionsBar.style.display = 'none';
                this.selectedItems.clear();
            }
            return;
        }

        tbody.innerHTML = items.map(item => this.createTableRow(item)).join('');

        // Show bulk actions bar when there are items (only after initial load)
        if (bulkActionsBar && this.knowledgeBase && this.knowledgeBase.length > 0) {
            bulkActionsBar.style.display = 'flex';
        }

        // Fix any text overflow issues after rendering
        this.fixTextOverflow();

        // Restore checkbox states after rendering
        this.restoreCheckboxStates();

        // Restore dropdown state after rendering
        if (openDropdownId) {
            const restoredDropdown = document.querySelector(`tr[data-id="${openDropdownId}"] .action-dropdown`);
            if (restoredDropdown) {
                restoredDropdown.classList.add('show');
                // Re-add event listeners for the restored dropdown
                this.addDropdownEventListeners();
            }
        }
    }

    fixTextOverflow() {
        // Ensure text truncation is working properly
        const nameElements = document.querySelectorAll('.name-cell');
        const statusElements = document.querySelectorAll('.status-cell');
        const sourceElements = document.querySelectorAll('.source-cell');

        [...nameElements, ...statusElements, ...sourceElements].forEach(element => {
            if (element.scrollWidth > element.clientWidth) {
                // Force CSS properties if they're not being applied
                element.style.overflow = 'hidden';
                element.style.textOverflow = 'ellipsis';
                element.style.whiteSpace = 'nowrap';
                element.style.maxWidth = '0';
                element.style.minWidth = '0';
            }
        });
    }

    restoreCheckboxStates() {
        // Restore selected states for checkboxes
        this.selectedItems.forEach(id => {
            const checkbox = document.querySelector(`.row-checkbox[data-id="${id}"]`);
            if (checkbox) {
                checkbox.checked = true;
            }
        });

        // Update UI based on current selection
        this.handleRowSelection();
    }

    showTemporaryMessage(message, type = 'info') {
        // Create or get existing message container
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

        // Create message element
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
        messageContainer.appendChild(messageElement);

        // Add slide-in animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        if (!document.getElementById('temp-message-styles')) {
            style.id = 'temp-message-styles';
            document.head.appendChild(style);
        }

        // Remove message after 4 seconds
        setTimeout(() => {
            messageElement.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.parentNode.removeChild(messageElement);
                }
            }, 300);
        }, 4000);
    }

    extractItemName(item) {
        // Extract name from title, URL, or file
        let name = '';

        if (item.title && item.title !== 'Processing...' && !item.title.includes('Processing')) {
            name = item.title;
        } else if (item.sourceUrl) {
            // Extract name from URL
            try {
                const url = new URL(item.sourceUrl);
                if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
                    name = 'YouTube Video';
                } else {
                    name = url.hostname.replace('www.', '');
                }
            } catch {
                name = 'Web Page';
            }
        } else if (item.sourceFile) {
            // Remove extension from file name
            name = item.sourceFile.name.replace(/\.[^/.]+$/, '');
        }

        return name;
    }

    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength - 3) + '...';
    }

    createTableRow(item) {
        const isSelected = this.clearingSelections ? false : this.selectedItems.has(item.id);
        const status = item.status;
        const isCompleted = status === 'completed';
        const isPending = status === 'pending';
        const isProcessing = ['pending', 'extracting', 'distilling'].includes(status);
        const isError = status === 'error';

        // Debug logging for status issues
        if (window.DEBUG_STATUS) {
            // Debug item status info
        }

        // Enhanced status mapping with more granular stages
        const STATUS_CONFIG = {
            'pending': { icon: '⏳', text: 'QUEUED', class: 'status-queued' },
            'extracting': { icon: '🔍', text: 'EXTRACTING', class: 'status-processing' },
            'distilling': { icon: '💠', text: 'DISTILLING', class: 'status-processing' },
            'completed': { icon: '✅', text: 'COMPLETED', class: 'status-completed' },
            'error': { icon: '❌', text: 'ERROR', class: 'status-error' },
            'stopped': { icon: '⏹️', text: 'STOPPED', class: 'status-stopped' }
        };

        const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG['pending'] || {
            icon: '⏳', text: 'QUEUED', class: 'status-queued'
        };
        const statusClass = statusConfig.class;
        const statusIcon = statusConfig.icon;
        const statusText = statusConfig.text;

        const title = item.title || 'Processing...';

        // Extract name for display
        const fullName = this.extractItemName(item);
        // Ensure name isn't excessively long (fallback if CSS fails)
        const name = fullName.length > 100 ? fullName.substring(0, 97) + '...' : fullName;

        // Format source display
        let sourceDisplay = '';
        if (item.sourceUrl) {
            const truncatedUrl = this.truncateText(item.sourceUrl, 40);
            sourceDisplay = `<a href="${item.sourceUrl}" target="_blank" class="source-link" title="${item.sourceUrl}">${truncatedUrl}</a>`;
        } else if (item.sourceFile) {
            const truncatedFileName = this.truncateText(item.sourceFile.name, 30);
            sourceDisplay = `<span class="file-source" title="${item.sourceFile.name}">${truncatedFileName}</span>`;
        }

        // Format status display with step
        const statusDisplay = `<span class="status-icon">${statusIcon}</span><span class="status-text">${statusText}</span>`;

        // Format processing time with live chronometer using centralized calculation
        const processingTimeDisplay = this.calculateProcessingTimeDisplay(item);

        // Format created date
        const createdAt = new Date(item.createdAt);
        const formattedDate = this.formatDate(createdAt);

        // Format actions as dropdown
        const actions = `
            <div class="action-dropdown" onclick="app.toggleActionDropdown(event, '${item.id}')">
                <button class="action-dropdown-btn">
                    Action
                    <span style="font-size: 0.7rem;">▼</span>
                </button>
                <div class="action-dropdown-content" id="dropdown-${item.id}" onclick="event.stopPropagation()">
                    ${isCompleted ? `
                        <button class="action-dropdown-item" onclick="event.stopPropagation(); app.showDistillationModal('${item.id}'); app.closeAllDropdowns();">
                            📄 View
                        </button>
                        <button class="action-dropdown-item" id="download-btn-${item.id}" 
                                onclick="event.stopPropagation(); app.handleDownloadClick('${item.id}'); app.closeAllDropdowns();"
                            <span class="btn-icon">📥</span>
                            <span class="btn-text">Download</span>
                        </button>
                    ` : ''}
                    ${isProcessing ? `
                        <button class="action-dropdown-item" onclick="event.stopPropagation(); app.stopProcessing('${item.id}'); app.closeAllDropdowns();">
                            ⏹️ Stop Processing
                        </button>
                    ` : ''}
                    <button class="action-dropdown-item retry-item" onclick="event.stopPropagation(); app.retryDistillation('${item.id}'); app.closeAllDropdowns();">
                        🔄 Retry
                    </button>
                    ${(isCompleted || isError) && item.rawContent ? `
                        <button class="action-dropdown-item" onclick="event.stopPropagation(); app.showRawContent('${item.id}'); app.closeAllDropdowns();">
                            🔍 View Raw
                        </button>
                    ` : ''}
                    <button class="action-dropdown-item" onclick="event.stopPropagation(); app.showLogs('${item.id}'); app.closeAllDropdowns();">
                        📋 Logs
                    </button>
                    <button class="action-dropdown-item delete-item" onclick="event.stopPropagation(); app.deleteDistillation('${item.id}'); app.closeAllDropdowns();">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;

        return `
            <tr data-id="${item.id}">
                <td class="checkbox-column">
                    <input type="checkbox" class="row-checkbox" data-id="${item.id}" onchange="app.handleRowSelection()" ${isSelected ? 'checked' : ''}>
                </td>
                <td class="name-cell truncate-text" data-tooltip="${fullName}">${name}</td>
                <td class="source-cell truncate-text" data-tooltip="${item.sourceUrl || (item.sourceFile ? item.sourceFile.name : '')}">${sourceDisplay}</td>
                <td class="type-cell">${this.getTypeLabel(item.sourceType)}</td>
                <td class="status-cell ${statusClass}">${statusDisplay}</td>
                <td class="time-cell">${processingTimeDisplay}</td>
                <td class="date-cell">${formattedDate}</td>
                <td class="actions-cell">${actions}</td>
            </tr>
        `;
    }

    async showDistillationModal(id) {
        try {
            const response = await fetch(`/api/summaries/${id}`);
            if (!response.ok) {
                throw new Error('Failed to load distillation');
            }

            const distillation = await response.json();

            document.getElementById('modal-title').textContent = distillation.title;

            let metaHtml = '';

            if (distillation.sourceUrl) {
                metaHtml += `<strong>Source:</strong> <a href="${distillation.sourceUrl}" target="_blank">${distillation.sourceUrl}</a><br>`;
            } else if (distillation.sourceFile) {
                metaHtml += `<strong>Source:</strong> ${distillation.sourceFile.name}<br>`;
            }

            metaHtml += `<strong>Status:</strong> ${distillation.status.toUpperCase()}<br>`;

            if (distillation.processingStep) {
                metaHtml += `<strong>Processing Step:</strong> ${distillation.processingStep}<br>`;
            }

            metaHtml += `<strong>Created:</strong> ${this.formatDate(new Date(distillation.createdAt))}<br>`;

            if (distillation.completedAt) {
                metaHtml += `<strong>Completed:</strong> ${this.formatDate(new Date(distillation.completedAt))}<br>`;
            }

            if (distillation.processingTime) {
                metaHtml += `<strong>Processing Time:</strong> ${this.formatTimeDisplay(distillation.processingTime)}<br>`;
            } else if (distillation.elapsedTime) {
                const minutes = Math.floor(distillation.elapsedTime / 60);
                const seconds = Math.floor(distillation.elapsedTime % 60);
                metaHtml += `<strong>Processing Time:</strong> ${minutes}m ${seconds}s<br>`;
            }

            if (distillation.wordCount) {
                metaHtml += `<strong>Word Count:</strong> ${distillation.wordCount} words<br>`;
            }

            document.getElementById('distillation-meta').innerHTML = metaHtml;
            document.getElementById('distillation-content').innerHTML = this.formatContent(distillation.content || '');
            document.getElementById('distillation-modal').style.display = 'block';



        } catch (error) {
            console.error('Error showing distillation:', error);
            alert('Error loading distillation: ' + error.message);
        }
    }

    toggleActionDropdown(event, id) {
        event.stopPropagation();

        // Close all other dropdowns and remove row classes
        document.querySelectorAll('.action-dropdown').forEach(dropdown => {
            if (dropdown !== event.currentTarget) {
                dropdown.classList.remove('show');
                // Remove dropdown-open class from parent row
                const parentRow = dropdown.closest('tr');
                if (parentRow) {
                    parentRow.classList.remove('dropdown-open');
                }
            }
        });

        // Toggle current dropdown
        const dropdown = event.currentTarget;
        const isOpen = dropdown.classList.toggle('show');
        const parentRow = dropdown.closest('tr');

        if (isOpen) {
            // Add dropdown-open class to parent row for z-index elevation
            if (parentRow) {
                parentRow.classList.add('dropdown-open');
            }

            // FORCE MAXIMUM Z-INDEX AND POSITIONING
            const dropdownContent = dropdown.querySelector('.action-dropdown-content');
            if (dropdownContent) {
                dropdownContent.style.zIndex = '2147483647';
                dropdownContent.style.position = 'fixed';
            }

            // Position dropdown intelligently
            this.positionDropdown(dropdown);

            // Add event listeners when dropdown opens
            this.addDropdownEventListeners();
        } else {
            // Remove dropdown-open class from parent row
            if (parentRow) {
                parentRow.classList.remove('dropdown-open');
            }
            // Remove event listeners when dropdown closes
            this.removeDropdownEventListeners();
        }
    }

    positionDropdown(dropdown) {
        const dropdownContent = dropdown.querySelector('.action-dropdown-content');
        if (!dropdownContent) return;

        // FORCE MAXIMUM Z-INDEX AND FIXED POSITIONING
        dropdownContent.style.position = 'fixed';
        dropdownContent.style.zIndex = '2147483647';

        // Get trigger button position
        const triggerRect = dropdown.getBoundingClientRect();
        const dropdownRect = dropdownContent.getBoundingClientRect();
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };

        // Calculate position
        let top = triggerRect.bottom + 4;
        let left = triggerRect.right - dropdownRect.width;

        // Adjust horizontal position if dropdown extends beyond viewport
        if (left < 10) {
            left = triggerRect.left; // Align to left edge of trigger
        }
        if (left + dropdownRect.width > viewport.width - 10) {
            left = viewport.width - dropdownRect.width - 10;
        }

        // Adjust vertical position if dropdown extends beyond viewport
        if (top + dropdownRect.height > viewport.height - 10) {
            top = triggerRect.top - dropdownRect.height - 4; // Position above
        }
        if (top < 10) {
            top = 10; // Minimum distance from top
        }

        // Apply calculated position with MAXIMUM Z-INDEX
        dropdownContent.style.top = `${top}px`;
        dropdownContent.style.left = `${left}px`;
        dropdownContent.style.right = 'auto';
        dropdownContent.style.bottom = 'auto';
        dropdownContent.style.zIndex = '2147483647';
    }

    addDropdownEventListeners() {
        // Remove existing listeners first to prevent duplicates
        this.removeDropdownEventListeners();

        // Add document click listener for outside clicks
        this.documentClickHandler = (event) => {
            const openDropdown = document.querySelector('.action-dropdown.show');
            if (openDropdown && !openDropdown.contains(event.target)) {
                openDropdown.classList.remove('show');
                // Remove dropdown-open class from parent row
                const parentRow = openDropdown.closest('tr');
                if (parentRow) {
                    parentRow.classList.remove('dropdown-open');
                }
                this.removeDropdownEventListeners();
            }
        };

        // Add keyboard listener for Escape key
        this.keyboardHandler = (event) => {
            if (event.key === 'Escape') {
                const openDropdown = document.querySelector('.action-dropdown.show');
                if (openDropdown) {
                    openDropdown.classList.remove('show');
                    // Remove dropdown-open class from parent row
                    const parentRow = openDropdown.closest('tr');
                    if (parentRow) {
                        parentRow.classList.remove('dropdown-open');
                    }
                    this.removeDropdownEventListeners();
                }
            }
        };

        // Add scroll listener to close dropdowns when scrolling
        this.scrollHandler = () => {
            const openDropdown = document.querySelector('.action-dropdown.show');
            if (openDropdown) {
                openDropdown.classList.remove('show');
                // Remove dropdown-open class from parent row
                const parentRow = openDropdown.closest('tr');
                if (parentRow) {
                    parentRow.classList.remove('dropdown-open');
                }
                this.removeDropdownEventListeners();
            }
        };

        // Add listeners immediately
        document.addEventListener('click', this.documentClickHandler);
        document.addEventListener('keydown', this.keyboardHandler);
        document.addEventListener('scroll', this.scrollHandler, true);
    }

    removeDropdownEventListeners() {
        if (this.documentClickHandler) {
            document.removeEventListener('click', this.documentClickHandler);
            this.documentClickHandler = null;
        }
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }
        if (this.scrollHandler) {
            document.removeEventListener('scroll', this.scrollHandler, true);
            this.scrollHandler = null;
        }
    }

    closeAllDropdowns() {
        document.querySelectorAll('.action-dropdown.show').forEach(dropdown => {
            dropdown.classList.remove('show');
            // Remove dropdown-open class from parent row
            const parentRow = dropdown.closest('tr');
            if (parentRow) {
                parentRow.classList.remove('dropdown-open');
            }
        });
        this.removeDropdownEventListeners();
    }


    async showRawContent(id) {
        try {
            const response = await fetch(`/api/summaries/${id}`);
            if (!response.ok) {
                throw new Error('Failed to load distillation');
            }

            const distillation = await response.json();

            if (!distillation.rawContent) {
                alert('No raw content available for this distillation');
                return;
            }

            document.getElementById('raw-content-title').textContent = `Raw Content: ${distillation.title}`;
            document.getElementById('raw-content-text').textContent = distillation.rawContent;
            document.getElementById('raw-content-modal').style.display = 'block';

        } catch (error) {
            console.error('Error showing raw content:', error);
            alert('Error loading raw content: ' + error.message);
        }
    }

    async showLogs(id) {
        try {
            const response = await fetch(`/api/summaries/${id}`);
            if (!response.ok) {
                throw new Error('Failed to load distillation');
            }

            const distillation = await response.json();

            document.getElementById('logs-title').textContent = `Processing Logs: ${distillation.title}`;

            // Create comprehensive logs including system information
            let logsHtml = '';

            // Add distillation information header
            logsHtml += `
                <div class="log-section">
                    <h4 class="log-section-title">📊 Distillation Information</h4>
                    <div class="log-entry log-info">
                        <span class="log-message"><strong>ID:</strong> ${distillation.id}</span>
                    </div>
                    <div class="log-entry log-info">
                        <span class="log-message"><strong>Source:</strong> ${distillation.sourceUrl || distillation.sourceFile || ''}</span>
                    </div>
                    <div class="log-entry log-info">
                        <span class="log-message"><strong>Type:</strong> ${distillation.sourceType || ''}</span>
                    </div>
                    <div class="log-entry log-info">
                        <span class="log-message"><strong>Status:</strong> ${distillation.status}</span>
                    </div>
                    <div class="log-entry log-info">
                        <span class="log-message"><strong>Processing Step:</strong> ${distillation.processingStep || 'N/A'}</span>
                    </div>
                    <div class="log-entry log-info">
                        <span class="log-message"><strong>Created:</strong> ${new Date(distillation.createdAt).toLocaleString()}</span>
                    </div>
                    ${distillation.completedAt ? `
                        <div class="log-entry log-info">
                            <span class="log-message"><strong>Completed:</strong> ${new Date(distillation.completedAt).toLocaleString()}</span>
                        </div>
                    ` : ''}
                    ${distillation.processingTime ? `
                        <div class="log-entry log-info">
                            <span class="log-message"><strong>Processing Time:</strong> ${this.formatTimeDisplay(distillation.processingTime)}</span>
                        </div>
                    ` : distillation.elapsedTime ? `
                        <div class="log-entry log-info">
                            <span class="log-message"><strong>Processing Time:</strong> ${Math.floor(distillation.elapsedTime / 60)}m ${Math.floor(distillation.elapsedTime % 60)}s</span>
                        </div>
                    ` : ''}
                    ${distillation.wordCount ? `
                        <div class="log-entry log-info">
                            <span class="log-message"><strong>Word Count:</strong> ${distillation.wordCount} words</span>
                        </div>
                    ` : ''}
                    ${distillation.error ? `
                        <div class="log-entry log-error">
                            <span class="log-message"><strong>Error:</strong> ${distillation.error}</span>
                        </div>
                    ` : ''}
                </div>
            `;

            // Add processing logs section
            if (distillation.logs && distillation.logs.length > 0) {
                logsHtml += `
                    <div class="log-section">
                        <h4 class="log-section-title">📋 Processing Logs</h4>
                `;

                distillation.logs.forEach(log => {
                    const timestamp = new Date(log.timestamp);
                    const formattedTime = timestamp.toLocaleTimeString();
                    const levelClass = `log-${log.level}`;

                    logsHtml += `
                        <div class="log-entry ${levelClass}">
                            <span class="log-time">[${formattedTime}]</span>
                            <span class="log-level">[${log.level.toUpperCase()}]</span>
                            <span class="log-message">${log.message}</span>
                        </div>
                    `;
                });

                logsHtml += `</div>`;
            } else {
                logsHtml += `
                    <div class="log-section">
                        <h4 class="log-section-title">📋 Processing Logs</h4>
                        <div class="log-entry log-info">
                            <span class="log-message">No detailed processing logs available for this item.</span>
                        </div>
                    </div>
                `;
            }

            // Add extraction metadata if available
            if (distillation.extractionMetadata) {
                logsHtml += `
                    <div class="log-section">
                        <h4 class="log-section-title">🔍 Extraction Details</h4>
                        <div class="log-entry log-info">
                            <span class="log-message"><strong>Content Type:</strong> ${distillation.extractionMetadata.contentType || ''}</span>
                        </div>
                        <div class="log-entry log-info">
                            <span class="log-message"><strong>Extraction Method:</strong> ${distillation.extractionMetadata.extractionMethod || ''}</span>
                        </div>
                        <div class="log-entry log-info">
                            <span class="log-message"><strong>Fallback Used:</strong> ${distillation.extractionMetadata.fallbackUsed ? 'Yes' : 'No'}</span>
                        </div>
                    </div>
                `;
            }

            document.getElementById('logs-content').innerHTML = logsHtml;
            document.getElementById('logs-modal').style.display = 'block';

        } catch (error) {
            console.error('Error showing logs:', error);
            alert('Error loading logs: ' + error.message);
        }
    }

    closeDistillationModal() {
        document.getElementById('distillation-modal').style.display = 'none';
    }

    closeRawContentModal() {
        document.getElementById('raw-content-modal').style.display = 'none';
    }

    closeLogsModal() {
        document.getElementById('logs-modal').style.display = 'none';
    }

    handleDownloadClick(id) {
        const buttonId = `download-btn-${id}`;
        const state = this.downloadStateManager.getDownloadState(buttonId);

        if (state.state === 'loading' || state.state === 'cancellable') {
            // Cancel the download
            this.downloadStateManager.cancelDownload(buttonId);
        } else {
            // Start the download
            this.downloadDistillation(id);
        }
    }



    async downloadDistillation(id) {
        const buttonId = `download-btn-${id}`;

        try {
            // Set loading state
            const abortController = new AbortController();
            this.downloadStateManager.setDownloadState(buttonId, 'loading', {
                downloadId: id,
                abortController: abortController,
                startTime: Date.now()
            });

            const response = await fetch(`/api/summaries/${id}/pdf`, {
                signal: abortController.signal
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to download distillation');
            }

            // Get filename from Content-Disposition header
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `distillation-${id}.pdf`;

            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }

            // Handle PDF download with proper blob type
            const blob = await response.blob();
            // Ensure blob is treated as PDF
            const pdfBlob = new Blob([blob], { type: 'application/pdf' });

            const url = window.URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            a.target = '_blank'; // Also try to open in new tab as fallback
            document.body.appendChild(a);
            a.click();

            // Wait a moment to ensure download has started before resetting state
            setTimeout(() => {
                this.downloadStateManager.setDownloadState(buttonId, 'idle');
            }, 1000);

            // Clean up after a delay
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 100);

        } catch (error) {
            if (error.name === 'AbortError') {
                // Download was cancelled, state already reset by cancelDownload
                return;
            }

            console.error('Error downloading distillation:', error);

            // Set error state
            this.downloadStateManager.setDownloadState(buttonId, 'error', {
                errorMessage: error.message || 'Download failed'
            });
        }
    }

    async stopProcessing(id) {
        try {
            const response = await fetch(`/api/summaries/${id}/stop`, {
                method: 'POST'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to stop processing');
            }

            // Force immediate status updates to show the stopped status
            this.forceStatusUpdate();
            setTimeout(() => this.forceStatusUpdate(), 100);
            setTimeout(() => this.forceStatusUpdate(), 500);

        } catch (error) {
            console.error('Error stopping processing:', error);
            alert('Error: ' + error.message);
        }
    }

    async retryDistillation(id) {
        try {
            const url = `/api/summaries/${id}/retry`;

            const response = await fetch(url, {
                method: 'POST'
            });

            // Response received

            if (!response.ok) {
                let errorMessage = 'Failed to retry distillation';
                try {
                    const error = await response.json();
                    errorMessage = error.message || errorMessage;
                } catch (parseError) {
                    console.error('Failed to parse error response:', parseError);
                    errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            // Retry initiated successfully - force MULTIPLE immediate status updates
            this.forceStatusUpdate();
            setTimeout(() => this.forceStatusUpdate(), 100);
            setTimeout(() => this.forceStatusUpdate(), 500);
            setTimeout(() => this.forceStatusUpdate(), 1000);
            setTimeout(() => this.forceStatusUpdate(), 2000);

        } catch (error) {
            console.error('Error retrying distillation:', error);
            alert('Error: ' + error.message);
        }
    }

    async deleteDistillation(id) {
        if (!confirm('Are you sure you want to delete this distillation?')) {
            return;
        }

        try {
            const response = await fetch(`/api/summaries/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to delete distillation');
            }

            // Remove the row from the table immediately
            const row = document.querySelector(`tr[data-id="${id}"]`);
            if (row) {
                row.remove();
            }

            // Remove from local data
            this.knowledgeBase = this.knowledgeBase.filter(item => item.id !== id);

            // Check if table is now empty
            const tbody = document.getElementById('knowledge-base-tbody');
            if (tbody.children.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="empty-state-cell">
                            <div class="empty-state">
                                <div class="empty-icon">🎯</div>
                                <h3>Ready to Process Knowledge</h3>
                                <p>Start by entering a URL, YouTube video, or uploading a document above.</p>
                            </div>
                        </td>
                    </tr>
                `;
            }

        } catch (error) {
            console.error('Error deleting distillation:', error);
            alert('Error: ' + error.message);
        }
    }

    getTypeLabel(type) {
        const labels = {
            'url': '🌐 Web',
            'youtube': '📺 YouTube',
            'file': '📄 Document'
        };
        return labels[type] || type;
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    formatContent(content) {
        if (!content) return '';

        // If content already contains HTML tags (like <strong>), preserve them but enhance numbered lists
        if (content.includes('<strong>') || content.includes('<')) {
            // Content already has HTML formatting, process it to enhance numbered lists
            let processedContent = content
                .split('\n\n')
                .map(paragraph => {
                    if (paragraph.trim()) {
                        // Check if this paragraph contains numbered list patterns that need bold formatting
                        const lines = paragraph.split('\n');
                        const processedLines = lines.map(line => {
                            const trimmedLine = line.trim();
                            // Handle nested numbering patterns like "1. 1. Text"
                            const nestedNumberMatch = trimmedLine.match(/^(\d+\.\s*)+(.+)$/);
                            if (nestedNumberMatch && !trimmedLine.includes('<strong>')) {
                                // Apply bold formatting to the entire line if not already present
                                return `<strong>${trimmedLine}</strong>`;
                            }
                            return line;
                        });

                        const processedParagraph = processedLines.join('\n');

                        // If paragraph already has HTML tags, don't wrap in <p>
                        if (processedParagraph.includes('<')) {
                            return processedParagraph.replace(/\n/g, '<br>');
                        } else {
                            return `<p>${processedParagraph.replace(/\n/g, '<br>')}</p>`;
                        }
                    }
                    return '';
                })
                .filter(p => p)
                .join('');

            return processedContent;
        }

        // Convert markdown to HTML for content without HTML tags
        return this.markdownToHtml(content);
    }

    markdownToHtml(markdown) {
        if (!markdown) return '';

        // Process markdown and convert numbered lists to sequential numbering
        let numberedItemCounter = 0;
        const lines = markdown.split('\n');
        const result = [];
        let currentParagraph = [];
        let inList = false;
        let listType = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            // Empty line - end current paragraph or list
            if (!trimmedLine) {
                if (currentParagraph.length > 0) {
                    result.push(`<p>${currentParagraph.join('<br>')}</p>`);
                    currentParagraph = [];
                }
                if (inList) {
                    result.push(`</${listType}>`);
                    inList = false;
                    listType = null;
                    // DON'T reset numberedItemCounter here - keep it going across the document
                }
                continue;
            }

            // Headers
            if (trimmedLine.startsWith('### ')) {
                const state = this.flushParagraph(result, currentParagraph, inList, listType);
                inList = state.inList;
                listType = state.listType;
                // DON'T reset counter after headers - keep numbering continuous
                result.push(`<h3>${trimmedLine.substring(4)}</h3>`);
                continue;
            }
            if (trimmedLine.startsWith('## ')) {
                const state = this.flushParagraph(result, currentParagraph, inList, listType);
                inList = state.inList;
                listType = state.listType;
                // DON'T reset counter after headers - keep numbering continuous
                result.push(`<h2>${trimmedLine.substring(3)}</h2>`);
                continue;
            }
            if (trimmedLine.startsWith('# ')) {
                const state = this.flushParagraph(result, currentParagraph, inList, listType);
                inList = state.inList;
                listType = state.listType;
                // DON'T reset counter after headers - keep numbering continuous
                result.push(`<h1>${trimmedLine.substring(2)}</h1>`);
                continue;
            }

            // Unordered list items
            if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
                if (currentParagraph.length > 0) {
                    result.push(`<p>${currentParagraph.join('<br>')}</p>`);
                    currentParagraph = [];
                }
                if (!inList || listType !== 'ul') {
                    if (inList) result.push(`</${listType}>`);
                    result.push('<ul>');
                    inList = true;
                    listType = 'ul';
                    // DON'T reset counter for unordered lists - keep numbering continuous
                }
                const content = this.processInlineMarkdown(trimmedLine.substring(2));
                result.push(`<li>${content}</li>`);
                continue;
            }

            // Enhanced numbered list processing - handles nested numbering like "1. 1. Text"
            const orderedMatch = trimmedLine.match(/^(\d+\.\s*)+(.+)$/);
            if (orderedMatch) {
                if (currentParagraph.length > 0) {
                    result.push(`<p>${currentParagraph.join('<br>')}</p>`);
                    currentParagraph = [];
                }

                if (!inList || listType !== 'ol') {
                    if (inList) result.push(`</${listType}>`);
                    result.push('<ol class="manual-numbered">');
                    inList = true;
                    listType = 'ol';
                    // DON'T reset counter here - keep incrementing across the entire document
                }

                numberedItemCounter++;
                // Extract the original numbering and content
                const originalNumbering = orderedMatch[1].trim(); // e.g., "1. 1."
                const textContent = orderedMatch[2]; // The actual content

                // Process the content for inline markdown (including bold)
                const processedContent = this.processInlineMarkdown(textContent);

                // Create list item with bold formatting for the entire line
                const listItem = `<li><strong><span class="list-number">${numberedItemCounter}.</span> ${processedContent}</strong></li>`;
                result.push(listItem);
                continue;
            }

            // Regular paragraph line
            if (inList) {
                result.push(`</${listType}>`);
                inList = false;
                listType = null;
                // DON'T reset numberedItemCounter here - keep it going
            }

            const processedLine = this.processInlineMarkdown(trimmedLine);
            currentParagraph.push(processedLine);
        }

        // Flush any remaining content
        this.flushParagraph(result, currentParagraph, inList, listType);

        return result.join('\n');
    }

    /**
     * Helper method to flush current paragraph and close lists
     */
    flushParagraph(result, currentParagraph, inList, listType) {
        if (currentParagraph.length > 0) {
            result.push(`<p>${currentParagraph.join('<br>')}</p>`);
            currentParagraph.length = 0;
        }
        if (inList) {
            result.push(`</${listType}>`);
            inList = false;
            listType = null;
        }
        return { inList: false, listType: null };
    }

    /**
     * Process inline markdown (bold, italic, code, links)
     * @param {string} text - Text to process
     * @returns {string} - Processed text
     */
    processInlineMarkdown(text) {
        if (!text) return '';

        let processed = text;

        // Code blocks (do first to avoid processing markdown inside code)
        processed = processed.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        processed = processed.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Bold text
        processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        processed = processed.replace(/__(.*?)__/g, '<strong>$1</strong>');

        // Italic text (avoid conflicts with bold)
        processed = processed.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
        processed = processed.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>');

        // Links
        processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

        return processed;
    }

    truncateText(text, maxLength) {
        // Handle null, undefined, or non-string values
        if (!text || typeof text !== 'string') {
            return '';
        }

        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    // Bulk Actions Methods


    getSelectedIds() {
        const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');
        return Array.from(checkedBoxes).map(checkbox => checkbox.dataset.id);
    }

    handleBulkDownloadClick() {
        const buttonId = 'bulk-download-btn';
        const state = this.downloadStateManager.getDownloadState(buttonId);

        if (state.state === 'cancellable') {
            // Cancel the download
            this.downloadStateManager.cancelDownload(buttonId);
        } else {
            // Start the download
            this.bulkDownload();
        }
    }

    async bulkDownload() {
        const selectedIds = this.getSelectedIds();
        if (selectedIds.length === 0) {
            alert('Please select items to download');
            return;
        }

        // If only one item is selected, use single download logic but with bulk button state management
        if (selectedIds.length === 1) {
            this.downloadSingleFromBulk(selectedIds[0]);
            return;
        }

        const buttonId = 'bulk-download-btn';

        try {
            // Set loading state for bulk download
            const abortController = new AbortController();
            this.downloadStateManager.setDownloadState(buttonId, 'loading', {
                downloadId: 'bulk',
                abortController: abortController,
                startTime: Date.now()
            });

            // Request a ZIP file from the backend endpoint
            const response = await fetch('/api/summaries/bulk-download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds }),
                signal: abortController.signal
            });

            if (!response.ok) {
                let errorMessage = 'Failed to download ZIP archive';
                try {
                    const error = await response.json();
                    errorMessage = error.message || errorMessage;
                } catch (e) {
                    errorMessage = `Server error: ${response.status} ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            // Handle the ZIP file download
            const blob = await response.blob();
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `sawron-download.zip`; // Default filename

            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
                if (filenameMatch && filenameMatch[1]) {
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

            // Wait a moment to ensure download has started before resetting state
            setTimeout(() => {
                this.downloadStateManager.setDownloadState(buttonId, 'idle');
            }, 1000);

            // Clean up after a delay
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                a.remove();
            }, 100);

        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error('Error during bulk download:', error);
            this.downloadStateManager.setDownloadState(buttonId, 'error', {
                errorMessage: 'Bulk download failed'
            });
        }
    }

    async downloadSingleFromBulk(id) {
        const buttonId = 'bulk-download-btn';

        try {
            // Set loading state for bulk download button
            const abortController = new AbortController();
            this.downloadStateManager.setDownloadState(buttonId, 'loading', {
                downloadId: id,
                abortController: abortController,
                startTime: Date.now()
            });

            // Use the same logic as individual download but with bulk button state
            const response = await fetch(`/api/summaries/${id}/pdf`, {
                signal: abortController.signal
            });

            if (!response.ok) {
                let errorMessage = 'Failed to download PDF';
                try {
                    const error = await response.json();
                    errorMessage = error.message || errorMessage;
                } catch (e) {
                    errorMessage = `Server error: ${response.status} ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            // Handle the PDF download
            const blob = await response.blob();
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `distillation-${id}.pdf`; // Default filename

            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
                if (filenameMatch && filenameMatch[1]) {
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

            // Wait a moment to ensure download has started before resetting state
            setTimeout(() => {
                this.downloadStateManager.setDownloadState(buttonId, 'idle');
            }, 1000);

            // Clean up after a delay
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                a.remove();
            }, 100);

        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error('Error during single download from bulk:', error);
            this.downloadStateManager.setDownloadState(buttonId, 'error', {
                errorMessage: error.message || 'Download failed'
            });
        }
    }

    async bulkDelete() {
        const selectedIds = this.getSelectedIds();
        if (selectedIds.length === 0) {
            alert('Please select items to delete');
            return;
        }

        const confirmMessage = selectedIds.length === 1
            ? 'Are you sure you want to delete this item? This action cannot be undone.'
            : `Are you sure you want to delete ${selectedIds.length} items? This action cannot be undone.`;

        if (!confirm(confirmMessage)) {
            return;
        }

        // Disable delete button during operation
        const deleteBtn = document.getElementById('bulk-delete-btn');
        const originalText = deleteBtn.innerHTML;
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Deleting...</span>';

        try {
            const response = await fetch('/api/summaries/bulk-delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ids: selectedIds })
            });

            if (!response.ok) {
                let errorMessage = 'Failed to delete items';
                try {
                    const error = await response.json();
                    errorMessage = error.message || errorMessage;
                } catch (e) {
                    errorMessage = `Server error: ${response.status} ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            const result = await response.json();
            // Show success/partial success feedback
            if (result.deletedCount === selectedIds.length) {
                const itemText = result.deletedCount === 1 ? 'item' : 'items';
                this.showTemporaryMessage(`Successfully deleted ${result.deletedCount} ${itemText}`, 'success');
            } else if (result.deletedCount > 0) {
                this.showTemporaryMessage(`Deleted ${result.deletedCount} of ${selectedIds.length} items. Some items could not be deleted.`, 'warning');
            } else {
                this.showTemporaryMessage('No items were deleted. Please try again.', 'error');
            }

            // Handle any deletion errors silently

            // Remove deleted rows from table (use selectedIds since we know which ones were requested)
            selectedIds.forEach(id => {
                const row = document.querySelector(`tr[data-id="${id}"]`);
                if (row) {
                    row.remove();
                }
            });

            // Update local data
            this.knowledgeBase = this.knowledgeBase.filter(item => !selectedIds.includes(item.id));

            // Check if table is now empty
            const tbody = document.getElementById('knowledge-base-tbody');
            if (tbody.children.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="empty-state-cell">
                            <div class="empty-state">
                                <div class="empty-icon">🎯</div>
                                <h3>Ready to Process Knowledge</h3>
                                <p>Start by entering a URL, YouTube video, or uploading a document above.</p>
                            </div>
                        </td>
                    </tr>
                `;
            }

            // Hide bulk actions bar
            document.getElementById('bulk-actions-bar').style.display = 'none';

            // Clear selection
            this.clearAllSelections();

            // Force refresh bulk actions bar to ensure consistency
            setTimeout(() => this.nuclearSelectionReset(), 100);
            setTimeout(() => this.nuclearSelectionReset(), 500);

        } catch (error) {
            console.error('Error deleting items:', error);

            // Show user-friendly error message
            let userMessage = 'Failed to delete items. ';
            if (error.message.includes('network') || error.message.includes('fetch')) {
                userMessage += 'Please check your internet connection and try again.';
            } else if (error.message.includes('Server error: 5')) {
                userMessage += 'Server error occurred. Please try again later.';
            } else {
                userMessage += error.message;
            }

            alert(userMessage);
        } finally {
            // Re-enable delete button
            deleteBtn.disabled = false;
            deleteBtn.innerHTML = originalText;
        }
    }

    async bulkRetry() {
        const selectedIds = this.getSelectedIds();
        if (selectedIds.length === 0) {
            alert('Please select items to retry.');
            return;
        }

        if (!confirm(`Are you sure you want to retry ${selectedIds.length} selected item(s)?`)) {
            return;
        }

        try {
            // Process selected items from bottom to top (reverse order) with delay to ensure proper sequencing
            const idsToRetry = [...selectedIds].reverse();
            for (let i = 0; i < idsToRetry.length; i++) {
                const id = idsToRetry[i];
                // Add small delay between retries to ensure bottom-to-top processing order
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                await this.retryDistillation(id);
            }

            this.showTemporaryMessage(`Retrying ${selectedIds.length} selected items...`, 'info');

            // Clear selection after retry
            this.clearAllSelections();

            // Force status updates to detect new items
            this.forceStatusUpdate();
            setTimeout(() => this.forceStatusUpdate(), 500);
            setTimeout(() => this.forceStatusUpdate(), 1000);

        } catch (error) {
            console.error('Error retrying selected items:', error);
            alert('Error retrying selected items: ' + error.message);
        }
    }

    async bulkRetryAll() {
        if (!confirm('Are you sure you want to retry ALL items in the knowledge base? This will reprocess all distillations.')) {
            return;
        }

        try {
            const allItems = this.knowledgeBase;
            if (allItems.length === 0) {
                alert('No items to retry.');
                return;
            }

            // Process items from bottom to top (reverse order) with delay to ensure proper sequencing
            const itemsToRetry = [...allItems].reverse();
            for (let i = 0; i < itemsToRetry.length; i++) {
                const item = itemsToRetry[i];
                // Add small delay between retries to ensure bottom-to-top processing order
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                await this.retryDistillation(item.id);
            }

            this.showTemporaryMessage(`Retrying all ${allItems.length} items...`, 'info');

            // Force MULTIPLE immediate status updates after retry all
            this.forceStatusUpdate();
            setTimeout(() => this.forceStatusUpdate(), 100);
            setTimeout(() => this.forceStatusUpdate(), 500);
            setTimeout(() => this.forceStatusUpdate(), 1000);
            setTimeout(() => this.forceStatusUpdate(), 2000);

        } catch (error) {
            console.error('Error retrying all items:', error);
            alert('Error retrying all items: ' + error.message);
        }
    }

    async bulkRetryFailed() {
        try {
            const failedItems = this.knowledgeBase.filter(item => item.status === 'error');

            if (failedItems.length === 0) {
                alert('No failed items to retry');
                return;
            }

            if (!confirm(`Are you sure you want to retry ${failedItems.length} failed item(s)?`)) {
                return;
            }

            // Process failed items from bottom to top (reverse order) with delay to ensure proper sequencing
            const itemsToRetry = [...failedItems].reverse();
            for (let i = 0; i < itemsToRetry.length; i++) {
                const item = itemsToRetry[i];
                // Add small delay between retries to ensure bottom-to-top processing order
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                await this.retryDistillation(item.id);
            }

            this.showTemporaryMessage(`Retrying ${failedItems.length} failed items...`, 'info');

            // Force MULTIPLE immediate status updates after retry failed
            this.forceStatusUpdate();
            setTimeout(() => this.forceStatusUpdate(), 100);
            setTimeout(() => this.forceStatusUpdate(), 500);
            setTimeout(() => this.forceStatusUpdate(), 1000);
            setTimeout(() => this.forceStatusUpdate(), 2000);

        } catch (error) {
            console.error('Error retrying failed items:', error);
            alert('Error retrying failed items: ' + error.message);
        }
    }



    async bulkDelete() {
        const selectedItems = Array.from(this.selectedItems);

        if (selectedItems.length === 0) {
            alert('No items selected for deletion');
            return;
        }

        if (!confirm(`Are you sure you want to delete ${selectedItems.length} selected item(s)?`)) {
            return;
        }

        try {
            // Delete items one by one
            for (const id of selectedItems) {
                const response = await fetch(`/api/summaries/${id}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    // Remove the row from the table immediately
                    const row = document.querySelector(`tr[data-id="${id}"]`);
                    if (row) {
                        row.remove();
                    }

                    // Remove from local data
                    this.knowledgeBase = this.knowledgeBase.filter(item => item.id !== id);
                    this.selectedItems.delete(id);
                }
            }

            this.showTemporaryMessage(`Deleted ${selectedItems.length} items`, 'success');
            this.updateBulkActionsBar();

            // Check if table is now empty
            const tbody = document.getElementById('knowledge-base-tbody');
            if (tbody.children.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="empty-state-cell">
                            <div class="empty-state">
                                <div class="empty-icon">🎯</div>
                                <h3>Ready to Process Knowledge</h3>
                                <p>Start by entering a URL, YouTube video, or uploading a document above.</p>
                            </div>
                        </td>
                    </tr>
                `;
            }

        } catch (error) {
            console.error('Error deleting items:', error);
            alert('Error deleting items: ' + error.message);
        }
    }


}

// Global functions for HTML onclick handlers
async function pasteFromClipboard(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    try {
        // Try to read from clipboard directly
        const text = await navigator.clipboard.readText();
        const mainInput = document.getElementById('main-input');
        mainInput.value = text;
        mainInput.focus();
        app.handleInputChange(text);
        // Text pasted successfully
    } catch (err) {
        console.error('Failed to read clipboard:', err);

        // Fallback: show alert and focus input for manual paste
        alert('Unable to access clipboard automatically, please paste manually');
        const mainInput = document.getElementById('main-input');
        mainInput.focus();
        mainInput.select();
    }
}

// Removed triggerFileUpload function - now handled by dropzone click event

function startDistillation() {
    app.startDistillation();
}

function removeFile() {
    app.removeFile();
}

function closeDistillationModal() {
    app.closeDistillationModal();
}

function closeRawContentModal() {
    app.closeRawContentModal();
}

function closeLogsModal() {
    app.closeLogsModal();
}

function refreshKnowledgeBase() {
    // Manual refresh - reload the entire knowledge base
    app.loadKnowledgeBase();
}

function toggleSelectAll() {
    app.toggleSelectAll();
}

function handleBulkDownloadClick() {
    app.handleBulkDownloadClick();
}

function bulkDelete() {
    app.bulkDelete();
}

function bulkRetry() {
    app.bulkRetry();
}

function bulkRetryAll() {
    app.bulkRetryAll();
}

function bulkRetryFailed() {
    app.bulkRetryFailed();
}

// Initialize app
const app = new SawronApp();

// Make functions globally accessible for HTML onclick handlers
window.startDistillation = startDistillation;
window.removeFile = removeFile;
window.closeDistillationModal = closeDistillationModal;
window.closeRawContentModal = closeRawContentModal;
window.closeLogsModal = closeLogsModal;
window.refreshKnowledgeBase = refreshKnowledgeBase;
window.toggleSelectAll = toggleSelectAll;
window.handleBulkDownloadClick = handleBulkDownloadClick;
window.bulkDelete = bulkDelete;
window.bulkRetry = bulkRetry;
window.bulkRetryAll = bulkRetryAll;
window.bulkRetryFailed = bulkRetryFailed;

// AI Settings Management
class AISettingsManager {
    constructor() {
        this.settings = this.getDefaultSettings(); // Start with defaults
        this.loadSettings().then(settings => {
            this.settings = settings;
        });
        this.providerModels = {
            openai: ['o3-mini', 'o4-mini', 'gpt-4o', 'gpt-4.1'],
            anthropic: ['claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'],
            google: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
            grok: ['grok-4-0709', 'grok-3', 'grok-3-mini', 'grok-3-fast'],
            deepseek: ['deepseek-chat', 'deepseek-reasoner']
        };
        this.providerInfo = {
            openai: { name: 'OpenAI', keyPrefix: 'sk-', help: 'Get your API key from https://platform.openai.com/api-keys' },
            anthropic: { name: 'Anthropic Claude', keyPrefix: 'sk-ant-', help: 'Get your API key from https://console.anthropic.com/' },
            google: { name: 'Google Gemini', keyPrefix: '', help: 'Get your API key from https://makersuite.google.com/app/apikey' },
            grok: { name: 'Grok', keyPrefix: 'xai-', help: 'Get your API key from https://console.x.ai/' },
            deepseek: { name: 'Deepseek', keyPrefix: 'sk-', help: 'Get your API key from https://platform.deepseek.com/' }
        };
    }

    async loadSettings() {
        try {
            // Try to load from backend first
            const response = await fetch('/api/ai-settings');
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    return result.settings;
                }
            }

            // Fallback to localStorage
            const stored = localStorage.getItem('ai-provider-settings');
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.error('Error loading AI settings:', error);
        }

        return this.getDefaultSettings();
    }

    getDefaultSettings() {
        return {
            mode: 'offline',
            concurrentProcessing: 1,
            offline: {
                model: '',
                endpoint: 'http://localhost:11434'
            },
            online: {
                provider: 'openai',
                apiKey: '',
                model: 'gpt-3.5-turbo',
                endpoint: ''
            },
            lastUpdated: new Date().toISOString()
        };
    }

    async saveSettings(settings) {
        try {
            this.settings = { ...settings, lastUpdated: new Date().toISOString() };
            // Save to backend (in-memory only for security)
            const response = await fetch('/api/ai-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.settings)
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    // Save non-sensitive settings to localStorage for UI persistence
                    const localSettings = { ...this.settings };
                    if (localSettings.online && localSettings.online.apiKey) {
                        localSettings.online.apiKey = ''; // Don't store API key locally
                    }
                    localStorage.setItem('ai-provider-settings', JSON.stringify(localSettings));
                    return true;
                } else {
                    throw new Error(result.error || 'Failed to save settings to backend');
                }
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error saving AI settings to backend:', error);

            // Fallback to localStorage only (without API key)
            try {
                const localSettings = { ...this.settings };
                if (localSettings.online && localSettings.online.apiKey) {
                    localSettings.online.apiKey = ''; // Don't store API key locally
                }
                localStorage.setItem('ai-provider-settings', JSON.stringify(localSettings));
                return true;
            } catch (localError) {
                console.error('Error saving AI settings to localStorage:', localError);
                return false;
            }
        }
    }

    getCurrentProviderConfig() {
        if (this.settings.mode === 'offline') {
            return {
                type: 'ollama',
                model: this.settings.offline.model,
                endpoint: this.settings.offline.endpoint
            };
        } else {
            return {
                type: this.settings.online.provider,
                apiKey: this.settings.online.apiKey,
                model: this.settings.online.model,
                endpoint: this.settings.online.endpoint
            };
        }
    }
}

// Global AI settings manager instance
const aiSettingsManager = new AISettingsManager();

// AI Settings Modal Functions
async function openAISettingsModal() {
    const modal = document.getElementById('ai-settings-modal');
    modal.style.display = 'flex';
    await loadAISettingsUI();
}

function closeAISettingsModal() {
    const modal = document.getElementById('ai-settings-modal');
    modal.style.display = 'none';
}

// Make functions globally accessible
window.openAISettingsModal = openAISettingsModal;
window.closeAISettingsModal = closeAISettingsModal;
window.toggleApiKeyVisibility = toggleApiKeyVisibility;
window.testOllamaConnection = testOllamaConnection;
window.testProviderConnection = testProviderConnection;
window.adjustConcurrentProcessing = adjustConcurrentProcessing;
window.saveAIConfiguration = saveAIConfiguration;
window.resetAIConfiguration = resetAIConfiguration;

async function loadAISettingsUI() {
    const settings = await aiSettingsManager.loadSettings();
    aiSettingsManager.settings = settings;

    // Set mode toggle
    const modeToggle = document.getElementById('mode-toggle');
    modeToggle.checked = settings.mode === 'online';
    updateModeUI(settings.mode);

    // Load offline settings
    document.getElementById('ollama-model').value = settings.offline.model || '';
    document.getElementById('ollama-model').placeholder = 'Enter model name (e.g., llama3, phi4-mini)';
    document.getElementById('ollama-endpoint').value = settings.offline.endpoint || 'http://localhost:11434';

    // Load online settings
    document.getElementById('provider-select').value = settings.online.provider || 'openai';
    document.getElementById('api-key').value = settings.online.apiKey || '';

    // Update provider-specific UI
    handleProviderChange();

    // Set model
    const modelSelect = document.getElementById('model-select');
    if (modelSelect.querySelector(`option[value="${settings.online.model}"]`)) {
        modelSelect.value = settings.online.model;
    }
}

function handleModeToggle() {
    const modeToggle = document.getElementById('mode-toggle');
    const mode = modeToggle.checked ? 'online' : 'offline';
    updateModeUI(mode);
}

function updateModeUI(mode) {
    const offlineConfig = document.getElementById('offline-config');
    const onlineConfig = document.getElementById('online-config');
    const modeDescription = document.getElementById('mode-description');
    const offlineLabel = document.getElementById('offline-label');
    const onlineLabel = document.getElementById('online-label');

    if (mode === 'offline') {
        offlineConfig.classList.remove('hidden');
        onlineConfig.classList.add('hidden');
        modeDescription.textContent = 'Use local Ollama installation for AI processing';
        offlineLabel.classList.add('active');
        onlineLabel.classList.remove('active');
    } else {
        offlineConfig.classList.add('hidden');
        onlineConfig.classList.remove('hidden');
        modeDescription.textContent = 'Use cloud-based AI providers for processing';
        offlineLabel.classList.remove('active');
        onlineLabel.classList.add('active');
    }
}

function handleProviderChange() {
    const provider = document.getElementById('provider-select').value;
    const modelSelect = document.getElementById('model-select');
    const apiKeyHelp = document.getElementById('api-key-help');

    // Update model options
    modelSelect.innerHTML = '';
    const models = aiSettingsManager.providerModels[provider] || [];
    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        modelSelect.appendChild(option);
    });

    // Update help text
    const providerInfo = aiSettingsManager.providerInfo[provider];
    if (providerInfo) {
        apiKeyHelp.textContent = providerInfo.help;
    }
}

function toggleApiKeyVisibility() {
    const apiKeyInput = document.getElementById('api-key');
    const visibilityIcon = document.getElementById('visibility-icon');

    if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        visibilityIcon.textContent = '🙈';
    } else {
        apiKeyInput.type = 'password';
        visibilityIcon.textContent = '👁️';
    }
}

async function testOllamaConnection() {
    const testBtn = document.getElementById('test-ollama-btn');
    const model = document.getElementById('ollama-model').value;
    const endpoint = document.getElementById('ollama-endpoint').value || 'http://localhost:11434';

    setTestButtonState(testBtn, 'testing');
    showTestResult('Testing Ollama connection...', 'info');

    try {
        const response = await fetch('/api/test-ai-provider', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'ollama',
                model: model,
                endpoint: endpoint
            })
        });

        const result = await response.json();

        if (result.success) {
            setTestButtonState(testBtn, 'success');
            showTestResult(`✅ Connection successful! Latency: ${result.latency}ms`, 'success');
        } else {
            setTestButtonState(testBtn, 'error');
            showTestResult(`❌ Connection failed: ${result.error}`, 'error');
        }
    } catch (error) {
        setTestButtonState(testBtn, 'error');
        showTestResult(`❌ Test failed: ${error.message}`, 'error');
    }

    setTimeout(() => setTestButtonState(testBtn, 'default'), 3000);
}

async function testProviderConnection() {
    const testBtn = document.getElementById('test-provider-btn');
    const provider = document.getElementById('provider-select').value;
    const apiKey = document.getElementById('api-key').value;
    const model = document.getElementById('model-select').value;

    if (!apiKey) {
        showTestResult('❌ Please enter an API key first', 'error');
        return;
    }

    setTestButtonState(testBtn, 'testing');
    showTestResult('Testing API connection...', 'info');

    try {
        const response = await fetch('/api/test-ai-provider', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: provider,
                apiKey: apiKey,
                model: model
            })
        });

        const result = await response.json();

        if (result.success) {
            setTestButtonState(testBtn, 'success');
            let message = `✅ Connection successful! Latency: ${result.latency}ms`;
            if (result.tokensUsed) {
                message += `, Tokens used: ${result.tokensUsed}`;
            }
            showTestResult(message, 'success');
        } else {
            setTestButtonState(testBtn, 'error');
            showTestResult(`❌ Connection failed: ${result.error}`, 'error');
        }
    } catch (error) {
        setTestButtonState(testBtn, 'error');
        showTestResult(`❌ Test failed: ${error.message}`, 'error');
    }

    setTimeout(() => setTestButtonState(testBtn, 'default'), 3000);
}

function setTestButtonState(button, state) {
    button.classList.remove('testing', 'success', 'error');

    const btnText = button.querySelector('.btn-text');
    const btnIcon = button.querySelector('.btn-icon');

    switch (state) {
        case 'testing':
            button.classList.add('testing');
            button.disabled = true;
            btnText.textContent = 'Testing...';
            btnIcon.textContent = '⏳';
            break;
        case 'success':
            button.classList.add('success');
            btnText.textContent = 'Success!';
            btnIcon.textContent = '✅';
            break;
        case 'error':
            button.classList.add('error');
            btnText.textContent = 'Failed';
            btnIcon.textContent = '❌';
            break;
        default:
            button.disabled = false;
            btnText.textContent = button.id.includes('ollama') ? 'Test Connection' : 'Test API Key';
            btnIcon.textContent = '🔍';
    }
}

function showTestResult(message, type) {
    const testResults = document.getElementById('test-results');
    const testResultContent = document.getElementById('test-result-content');

    testResultContent.textContent = message;
    testResultContent.className = `test-result-content ${type}`;
    testResults.style.display = 'block';

    setTimeout(() => {
        testResults.style.display = 'none';
    }, 5000);
}



async function validateAIConfiguration(settings) {
    // Client-side validation
    const errors = [];

    if (!settings.mode || !['offline', 'online'].includes(settings.mode)) {
        errors.push('Invalid mode selected');
    }

    if (settings.mode === 'offline') {
        if (!settings.offline.model || settings.offline.model.trim() === '') {
            errors.push('Ollama model name is required');
        }
        if (!settings.offline.endpoint || !isValidUrl(settings.offline.endpoint)) {
            errors.push('Valid Ollama endpoint URL is required');
        }
    } else if (settings.mode === 'online') {
        if (!settings.online.provider) {
            errors.push('AI provider must be selected');
        }
        if (!settings.online.apiKey || settings.online.apiKey.trim() === '') {
            errors.push('API key is required for online mode');
        } else {
            // Validate API key format
            const keyValidation = validateApiKeyFormat(settings.online.provider, settings.online.apiKey);
            if (!keyValidation.valid) {
                errors.push(keyValidation.error);
            }
        }
        if (!settings.online.model) {
            errors.push('Model must be selected');
        }
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    // Server-side validation
    try {
        const config = settings.mode === 'offline'
            ? { type: 'ollama', model: settings.offline.model, endpoint: settings.offline.endpoint }
            : { type: settings.online.provider, apiKey: settings.online.apiKey, model: settings.online.model };

        const response = await fetch('/api/validate-ai-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        const result = await response.json();
        return { valid: result.valid, errors: result.errors || [] };
    } catch (error) {
        console.warn('Server validation failed, using client-side validation only:', error);
        return { valid: true, errors: [] };
    }
}

function validateApiKeyFormat(provider, apiKey) {
    const formats = {
        openai: { prefix: 'sk-', minLength: 50 },
        anthropic: { prefix: 'sk-ant-', minLength: 90 },
        google: { prefix: '', minLength: 30 },
        microsoft: { prefix: '', minLength: 20 },
        grok: { prefix: 'xai-', minLength: 40 },
        deepseek: { prefix: 'sk-', minLength: 40 }
    };

    const format = formats[provider];
    if (!format) {
        return { valid: true }; // Provider not found, skip validation
    }

    if (format.prefix && !apiKey.startsWith(format.prefix)) {
        return {
            valid: false,
            error: `${aiSettingsManager.providerInfo[provider].name} API key should start with "${format.prefix}"`
        };
    }

    if (apiKey.length < format.minLength) {
        return {
            valid: false,
            error: `${aiSettingsManager.providerInfo[provider].name} API key appears to be too short`
        };
    }

    return { valid: true };
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

async function resetAIConfiguration() {
    if (confirm('Are you sure you want to reset to default settings? This will clear all your configuration.')) {
        const defaultSettings = aiSettingsManager.getDefaultSettings();
        await aiSettingsManager.saveSettings(defaultSettings);
        await loadAISettingsUI();
        showTestResult('✅ Configuration reset to defaults', 'success');
    }
}

// Close modal when clicking outside
document.getElementById('ai-settings-modal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        closeAISettingsModal();
    }
});

// Initialize AI settings on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Load initial settings
    const settings = await aiSettingsManager.loadSettings();

    // Dropdown auto-close behavior removed - dropdowns stay open until manually toggled
    aiSettingsManager.settings = settings;

});// Processing Queue Configuration Functions
function adjustConcurrentProcessing(delta) {
    const input = document.getElementById('concurrent-processing');
    const currentValue = parseInt(input.value) || 1;
    const newValue = Math.max(1, Math.min(10, currentValue + delta));
    input.value = newValue;
}

// Update the loadAISettingsUI function to include concurrent processing
const originalLoadAISettingsUI = loadAISettingsUI;
loadAISettingsUI = async function () {
    await originalLoadAISettingsUI();

    // Load concurrent processing setting
    const settings = aiSettingsManager.settings;
    const concurrentProcessing = settings.concurrentProcessing || 1;
    document.getElementById('concurrent-processing').value = concurrentProcessing;
};

// Update the saveAIConfiguration function to include concurrent processing
async function saveAIConfiguration() {
    try {
        const modeToggle = document.getElementById('mode-toggle');
        const mode = modeToggle.checked ? 'online' : 'offline';

        const concurrentProcessing = parseInt(document.getElementById('concurrent-processing').value) || 1;

        const settings = {
            mode: mode,
            concurrentProcessing: concurrentProcessing,
            offline: {
                model: document.getElementById('ollama-model').value || 'llama2',
                endpoint: document.getElementById('ollama-endpoint').value || 'http://localhost:11434'
            },
            online: {
                provider: document.getElementById('provider-select').value,
                apiKey: document.getElementById('api-key').value,
                model: document.getElementById('model-select').value
            }
        };

        const success = await aiSettingsManager.saveSettings(settings);

        // Update processing queue settings
        if (success && settings.concurrentProcessing) {
            try {
                const queueResponse = await fetch('/api/processing-queue/settings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        concurrentProcessing: settings.concurrentProcessing
                    })
                });

                if (queueResponse.ok) {
                    // Processing queue settings updated
                } else {
                    console.warn('Failed to update processing queue settings');
                }
            } catch (error) {
                console.warn('Error updating processing queue settings:', error);
            }
        }

        if (success) {
            // Update button state
            const saveBtn = document.getElementById('save-config-btn');
            const originalText = saveBtn.innerHTML;
            saveBtn.innerHTML = '<span class="btn-icon">✅</span><span class="btn-text">Saved!</span>';
            saveBtn.style.background = 'var(--status-completed)';

            setTimeout(() => {
                saveBtn.innerHTML = originalText;
                saveBtn.style.background = '';
            }, 2000);
        } else {
            throw new Error('Failed to save settings');
        }

    } catch (error) {
        console.error('Error saving AI configuration:', error);
        alert('Error saving configuration: ' + error.message);
    }
}