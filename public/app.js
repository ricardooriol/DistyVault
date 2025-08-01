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
        if (!state.originalContent && state.state === 'idle') {
            state.originalContent = button.innerHTML;
        }

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

// Enhanced Tooltip Manager
class TooltipManager {
    constructor() {
        this.activeTooltip = null;
        this.timeoutId = null;
        this.targetElement = null;
    }

    showTooltip(element, text) {
        try {
            this.cleanup();

            if (!element || !text || typeof text !== 'string') {
                return;
            }

            // Create tooltip
            this.activeTooltip = document.createElement('div');
            this.activeTooltip.className = 'tooltip';
            this.activeTooltip.textContent = text;
            document.body.appendChild(this.activeTooltip);

            // Position tooltip directly below the element
            const elementRect = element.getBoundingClientRect();
            const tooltipRect = this.activeTooltip.getBoundingClientRect();
            
            let left = elementRect.left;
            let top = elementRect.bottom + 5;

            // Adjust if tooltip goes off screen
            if (left + tooltipRect.width > window.innerWidth - 10) {
                left = window.innerWidth - tooltipRect.width - 10;
            }
            if (left < 10) {
                left = 10;
            }
            if (top + tooltipRect.height > window.innerHeight - 10) {
                top = elementRect.top - tooltipRect.height - 5;
            }

            this.activeTooltip.style.left = left + 'px';
            this.activeTooltip.style.top = top + 'px';
            this.activeTooltip.classList.add('show');
            
            this.targetElement = element;

        } catch (error) {
            console.warn('Error showing tooltip:', error);
            this.cleanup();
        }
    }

    hideTooltip() {
        this.cleanup();
    }

    cleanup() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }

        if (this.activeTooltip) {
            this.activeTooltip.remove();
            this.activeTooltip = null;
        }

        this.targetElement = null;
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
        inputSection.addEventListener('dragover', (e) => {
            e.preventDefault();
            inputSection.style.background = 'var(--shadow-light)';
        });

        inputSection.addEventListener('dragleave', (e) => {
            if (!inputSection.contains(e.relatedTarget)) {
                inputSection.style.background = 'var(--bg-secondary)';
            }
        });

        inputSection.addEventListener('drop', (e) => {
            e.preventDefault();
            inputSection.style.background = 'var(--bg-secondary)';
            this.handleFileSelection(e.dataTransfer.files);
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
        const uploadBtn = document.getElementById('upload-btn');
        const distillBtn = document.getElementById('distill-btn');

        const hasText = mainInput.value.trim().length > 0;
        const hasFile = this.selectedFile !== null;

        // Upload button: disabled if there's text in input
        if (hasText) {
            uploadBtn.classList.add('disabled');
        } else {
            uploadBtn.classList.remove('disabled');
        }

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
                this.loadKnowledgeBase();

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
                this.loadKnowledgeBase();
            }

            this.updateButtonStates();

        } catch (error) {
            console.error('Error during distillation:', error);
            alert('Error: ' + error.message);
            this.hideStatus();
        }
    }

    startAutoRefresh() {
        // Refresh knowledge base every 500ms to catch rapid status changes
        this.refreshInterval = setInterval(() => {
            this.loadKnowledgeBase();
        }, 500);
    }

    startChronometer() {
        // Update chronometer every second for processing items
        this.chronometerInterval = setInterval(() => {
            this.updateProcessingTimes();
        }, 1000);
    }

    updateProcessingTimes() {
        try {
            // Update processing times for items that are currently processing
            const rows = document.querySelectorAll('#knowledge-base-tbody tr[data-id]');

            rows.forEach((row) => {
                try {
                    const statusCell = row.querySelector('.status-cell');
                    const timeCell = row.querySelector('.time-cell');

                    if (statusCell && timeCell) {
                        const statusText = statusCell.querySelector('.status-text')?.textContent.trim();
                        const isProcessing = ['INITIALIZING', 'EXTRACTING', 'DISTILLING'].includes(statusText);
                        const isQueued = statusText === 'QUEUED';

                        if (isQueued || isProcessing) {
                            // Find the corresponding item data
                            const itemId = row.dataset.id;
                            if (itemId && this.knowledgeBaseData) {
                                const item = this.knowledgeBaseData.find(i => i.id === itemId);

                                if (!item) {
                                    // Item not found, show fallback
                                    timeCell.textContent = 'Unknown';
                                    return;
                                }

                                // Show "Waiting..." for queued items
                                if (item.status === 'pending') {
                                    timeCell.textContent = 'Waiting...';
                                } else if (item.startTime && isProcessing) {
                                    // Only show live timer for actively processing items
                                    try {
                                        const startTime = new Date(item.startTime);
                                        const currentTime = new Date();
                                        
                                        // Validate dates
                                        if (isNaN(startTime.getTime()) || isNaN(currentTime.getTime())) {
                                            timeCell.textContent = 'Unknown';
                                            return;
                                        }

                                        const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);

                                        // Ensure elapsed time is not negative
                                        if (elapsedSeconds < 0) {
                                            timeCell.textContent = '0s';
                                            return;
                                        }

                                        let timeDisplay;
                                        if (elapsedSeconds < 60) {
                                            timeDisplay = `${elapsedSeconds}s`;
                                        } else {
                                            const minutes = Math.floor(elapsedSeconds / 60);
                                            const seconds = elapsedSeconds % 60;
                                            timeDisplay = `${minutes}m ${seconds}s`;
                                        }

                                        timeCell.textContent = timeDisplay;
                                    } catch (timeError) {
                                        console.warn('Error calculating processing time:', timeError);
                                        timeCell.textContent = 'Unknown';
                                    }
                                } else if (isProcessing) {
                                    // Processing but no start time available
                                    timeCell.textContent = 'Processing...';
                                }
                            }
                        }
                    }
                } catch (rowError) {
                    console.warn('Error updating processing time for row:', rowError);
                }
            });
        } catch (error) {
            console.warn('Error in updateProcessingTimes:', error);
        }
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        if (this.chronometerInterval) {
            clearInterval(this.chronometerInterval);
            this.chronometerInterval = null;
        }
    }

    initializeTooltips() {
        // Add event delegation for tooltips on truncated text elements
        document.addEventListener('mouseover', (e) => {
            const element = e.target;
            
            // Check if element is a truncated cell that should show tooltip
            if (this.shouldShowTooltip(element)) {
                const text = this.getTooltipText(element);
                if (text) {
                    this.tooltipManager.showTooltip(element, text);
                }
            }
        });
        
        document.addEventListener('mouseout', (e) => {
            const element = e.target;
            
            // Hide tooltip when leaving truncated elements
            if (this.shouldShowTooltip(element)) {
                this.tooltipManager.hideTooltip();
            }
        });

        // Emergency cleanup on window resize or scroll
        window.addEventListener('resize', () => {
            this.tooltipManager.cleanupStuckTooltips();
        });

        window.addEventListener('scroll', () => {
            this.tooltipManager.cleanupStuckTooltips();
        });
    }

    shouldShowTooltip(element) {
        // Check if element is in columns 1, 2, or 4 (name, source, status)
        return element.classList.contains('name-cell') || 
               element.classList.contains('source-cell') || 
               element.classList.contains('status-cell') ||
               element.closest('.name-cell') ||
               element.closest('.source-cell') ||
               element.closest('.status-cell');
    }

    getTooltipText(element) {
        // Get the appropriate text content for tooltip
        const cell = element.closest('.name-cell, .source-cell, .status-cell') || element;
        
        if (cell.classList.contains('source-cell')) {
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

            // Check for status changes before updating
            if (window.DEBUG_STATUS && this.knowledgeBase) {
                const oldStatuses = new Map(this.knowledgeBase.map(item => [item.id, item.status]));
                data.forEach(item => {
                    const oldStatus = oldStatuses.get(item.id);
                    if (oldStatus && oldStatus !== item.status) {
                        console.log(`[STATUS CHANGE] Item ${item.id}: ${oldStatus} → ${item.status}`);
                    }
                });
            }

            this.knowledgeBase = data;
            this.knowledgeBaseData = this.knowledgeBase; // Store for chronometer updates
            
            // Debug logging for status tracking
            if (window.DEBUG_STATUS) {
                this.knowledgeBase.forEach(item => {
                    if (['pending', 'initializing', 'extracting', 'distilling'].includes(item.status)) {
                        console.log(`[DEBUG] Processing item ${item.id}: status="${item.status}", step="${item.processingStep}"`);
                    }
                });
            }
            
            this.renderKnowledgeBase();
        } catch (error) {
            console.error('Error loading knowledge base:', error);
            
            // Show fallback UI or retry mechanism
            if (this.knowledgeBase.length === 0) {
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
                                </div>
                            </td>
                        </tr>
                    `;
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
            // Hide bulk actions bar when empty
            const bulkActionsBar = document.getElementById('bulk-actions-bar');
            if (bulkActionsBar) bulkActionsBar.style.display = 'none';
            return;
        }

        tbody.innerHTML = items.map(item => this.createTableRow(item)).join('');

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
        let name = 'Unknown';

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

    createTableRow(item) {
        const status = item.status;
        const isCompleted = status === 'completed';
        const isPending = status === 'pending';
        const isProcessing = ['initializing', 'extracting', 'distilling'].includes(status);
        const isError = status === 'error';

        // Debug logging for status issues
        if (window.DEBUG_STATUS) {
            console.log(`[DEBUG] Item ${item.id}: status="${status}", processingStep="${item.processingStep}"`);
        }

        // Enhanced status mapping
        const STATUS_CONFIG = {
            'pending': { icon: '⏸️', text: 'QUEUED', class: 'status-queued' },
            'initializing': { icon: '🔄', text: 'INITIALIZING', class: 'status-processing' },
            'extracting': { icon: '🔍', text: 'EXTRACTING', class: 'status-processing' },
            'distilling': { icon: '🤖', text: 'DISTILLING', class: 'status-processing' },
            'completed': { icon: '✅', text: 'COMPLETED', class: 'status-completed' },
            'error': { icon: '❌', text: 'ERROR', class: 'status-error' }
        };

        const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG['pending'] || {
            icon: '❓', text: 'UNKNOWN', class: 'status-unknown'
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
        const statusDisplay = `
            <span class="status-icon">${statusIcon}</span>
            <span class="status-text">${statusText}</span>
            ${item.processingStep && item.processingStep !== statusText ? `<div class="processing-step">${item.processingStep}</div>` : ''}
        `;

        // Format processing time with live chronometer
        let processingTimeDisplay = '-';
        if (item.processingTime) {
            // Completed items show final processing time
            processingTimeDisplay = `${item.processingTime.toFixed(1)}s`;
        } else if (status === 'pending') {
            // Show "Waiting..." for items that are pending (in queue)
            processingTimeDisplay = 'Waiting...';
        } else if (isProcessing && item.startTime) {
            // Live chronometer for processing items (initializing, extracting, distilling)
            const startTime = new Date(item.startTime);
            const currentTime = new Date();
            const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);

            if (elapsedSeconds < 60) {
                processingTimeDisplay = `${elapsedSeconds}s`;
            } else {
                const minutes = Math.floor(elapsedSeconds / 60);
                const seconds = elapsedSeconds % 60;
                processingTimeDisplay = `${minutes}m ${seconds}s`;
            }
        } else if (item.elapsedTime) {
            // Fallback to stored elapsed time
            const minutes = Math.floor(item.elapsedTime / 60);
            const seconds = Math.floor(item.elapsedTime % 60);
            processingTimeDisplay = `${minutes}m ${seconds}s`;
        }

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
                    <input type="checkbox" class="row-checkbox" data-id="${item.id}" onchange="app.handleRowSelection()">
                </td>
                <td class="name-cell truncate-text" data-tooltip="${fullName}">${name}</td>
                <td class="source-cell truncate-text" data-tooltip="${item.sourceUrl || (item.sourceFile ? item.sourceFile.name : '')}">${sourceDisplay}</td>
                <td class="type-cell">${this.getTypeLabel(item.sourceType)}</td>
                <td class="status-cell ${statusClass} truncate-text" data-tooltip="${statusText}${item.error ? ': ' + item.error : ''}${item.processingStep ? ' - ' + item.processingStep : ''}">${statusDisplay}</td>
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
                metaHtml += `<strong>Processing Time:</strong> ${distillation.processingTime.toFixed(1)}s<br>`;
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

        // Close all other dropdowns
        document.querySelectorAll('.action-dropdown').forEach(dropdown => {
            if (dropdown !== event.currentTarget) {
                dropdown.classList.remove('show');
            }
        });

        // Toggle current dropdown
        const dropdown = event.currentTarget;
        const isOpen = dropdown.classList.toggle('show');

        if (isOpen) {
            // Add event listeners when dropdown opens
            this.addDropdownEventListeners();
        } else {
            // Remove event listeners when dropdown closes
            this.removeDropdownEventListeners();
        }
    }

    addDropdownEventListeners() {
        // Remove existing listeners first to prevent duplicates
        this.removeDropdownEventListeners();

        // Add document click listener for outside clicks
        this.documentClickHandler = (event) => {
            const openDropdown = document.querySelector('.action-dropdown.show');
            if (openDropdown && !openDropdown.contains(event.target)) {
                openDropdown.classList.remove('show');
                this.removeDropdownEventListeners();
            }
        };

        // Add keyboard listener for Escape key
        this.keyboardHandler = (event) => {
            if (event.key === 'Escape') {
                const openDropdown = document.querySelector('.action-dropdown.show');
                if (openDropdown) {
                    openDropdown.classList.remove('show');
                    this.removeDropdownEventListeners();
                }
            }
        };

        // Add listeners immediately
        document.addEventListener('click', this.documentClickHandler);
        document.addEventListener('keydown', this.keyboardHandler);
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
    }

    closeAllDropdowns() {
        document.querySelectorAll('.action-dropdown.show').forEach(dropdown => {
            dropdown.classList.remove('show');
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
                        <span class="log-message"><strong>Source:</strong> ${distillation.sourceUrl || distillation.sourceFile || 'Unknown'}</span>
                    </div>
                    <div class="log-entry log-info">
                        <span class="log-message"><strong>Type:</strong> ${distillation.sourceType || 'Unknown'}</span>
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
                            <span class="log-message"><strong>Processing Time:</strong> ${distillation.processingTime.toFixed(1)}s</span>
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
                            <span class="log-message"><strong>Content Type:</strong> ${distillation.extractionMetadata.contentType || 'Unknown'}</span>
                        </div>
                        <div class="log-entry log-info">
                            <span class="log-message"><strong>Extraction Method:</strong> ${distillation.extractionMetadata.extractionMethod || 'Unknown'}</span>
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

            // Clean up after a delay
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 100);

            // Reset to idle state on success
            this.downloadStateManager.setDownloadState(buttonId, 'idle');

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

            this.loadKnowledgeBase();

        } catch (error) {
            console.error('Error stopping processing:', error);
            alert('Error: ' + error.message);
        }
    }

    async retryDistillation(id) {
        try {
            console.log(`Retrying distillation ${id}`);
            const url = `/api/summaries/${id}/retry`;
            console.log(`Making POST request to: ${url}`);

            const response = await fetch(url, {
                method: 'POST'
            });

            console.log(`Response status: ${response.status} ${response.statusText}`);

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

            console.log(`Distillation ${id} retry initiated successfully`);

            // Refresh the knowledge base to show updated status
            this.loadKnowledgeBase();

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

            this.loadKnowledgeBase();

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
    handleRowSelection() {
        try {
            const checkboxes = document.querySelectorAll('.row-checkbox');
            const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');
            const bulkActionsBar = document.getElementById('bulk-actions-bar');
            const selectedCount = document.getElementById('selected-count');
            const selectAllBtn = document.getElementById('select-all-btn');

            // Get all action buttons
            const bulkRetryBtn = document.getElementById('bulk-retry-btn');
            const bulkDownloadBtn = document.getElementById('bulk-download-btn');
            const bulkDeleteBtn = document.getElementById('bulk-delete-btn');

            // Ensure all elements exist
            if (!bulkActionsBar || !selectedCount || !selectAllBtn) {
                return;
            }

            const selectedCount_num = checkedBoxes.length;
            const totalCount = checkboxes.length;

            // Update selected items set
            this.selectedItems.clear();
            checkedBoxes.forEach(checkbox => {
                if (checkbox.dataset.id) {
                    this.selectedItems.add(checkbox.dataset.id);
                }
            });

            // Update selected count
            selectedCount.textContent = `${selectedCount_num} selected`;

            // Bulk actions bar is always visible now
            // Update button states based on selection
            const hasSelection = selectedCount_num > 0;

            if (bulkRetryBtn) bulkRetryBtn.disabled = !hasSelection;
            if (bulkDownloadBtn) bulkDownloadBtn.disabled = !hasSelection;
            if (bulkDeleteBtn) bulkDeleteBtn.disabled = !hasSelection;

            // Update Select All button text and state
            if (selectedCount_num === 0) {
                selectAllBtn.querySelector('.btn-text').textContent = 'Select All';
                selectAllBtn.disabled = false;
            } else if (selectedCount_num === totalCount && totalCount > 0) {
                selectAllBtn.querySelector('.btn-text').textContent = 'Unselect All';
                selectAllBtn.disabled = false;
            } else {
                selectAllBtn.querySelector('.btn-text').textContent = 'Select All';
                selectAllBtn.disabled = false;
            }
        } catch (error) {
            // Handle selection errors silently
        }
    }

    toggleSelectAll() {
        try {
            const checkboxes = document.querySelectorAll('.row-checkbox');
            const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');
            const shouldSelectAll = checkedBoxes.length !== checkboxes.length;

            checkboxes.forEach(checkbox => {
                if (checkbox) {
                    checkbox.checked = shouldSelectAll;
                }
            });

            this.handleRowSelection();
        } catch (error) {
            // Handle toggle errors silently
        }
    }

    getSelectedIds() {
        const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');
        return Array.from(checkedBoxes).map(checkbox => checkbox.dataset.id);
    }

    handleBulkDownloadClick() {
        const buttonId = 'bulk-download-btn';
        const state = this.downloadStateManager.getDownloadState(buttonId);
        
        if (state.state === 'loading' || state.state === 'cancellable') {
            // Cancel the download
            this.downloadStateManager.cancelDownload(buttonId);
        } else {
            // Start the download
            this.bulkDownload();
        }
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

        const buttonId = 'bulk-download-btn';

        try {
            // Set loading state
            const abortController = new AbortController();
            this.downloadStateManager.setDownloadState(buttonId, 'loading', {
                downloadId: 'bulk',
                abortController: abortController,
                startTime: Date.now()
            });

            const response = await fetch('/api/summaries/bulk-download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ids: selectedIds }),
                signal: abortController.signal
            });

            if (!response.ok) {
                let errorMessage = 'Failed to download items';
                try {
                    const error = await response.json();
                    errorMessage = error.message || errorMessage;
                } catch (e) {
                    errorMessage = `Server error: ${response.status} ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            // Handle download
            const blob = await response.blob();

            if (blob.size === 0) {
                throw new Error('Downloaded file is empty. Please try again.');
            }

            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `download-${new Date().toISOString().split('T')[0]}`;

            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            } else {
                // Determine file extension based on content type
                const contentType = response.headers.get('Content-Type');
                if (contentType === 'application/pdf') {
                    filename += '.pdf';
                } else if (contentType === 'application/zip') {
                    filename += '.zip';
                }
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 100);

            // Show success feedback
            const itemText = selectedIds.length === 1 ? 'item' : 'items';
            this.showTemporaryMessage(`Successfully downloaded ${selectedIds.length} ${itemText}`, 'success');

            // Reset to idle state on success
            this.downloadStateManager.setDownloadState(buttonId, 'idle');

        } catch (error) {
            if (error.name === 'AbortError') {
                // Download was cancelled, state already reset by cancelDownload
                return;
            }
            
            console.error('Error downloading items:', error);

            // Show user-friendly error message
            let userMessage = 'Failed to download items. ';
            if (error.message.includes('network') || error.message.includes('fetch')) {
                userMessage += 'Please check your internet connection and try again.';
            } else if (error.message.includes('Server error: 5')) {
                userMessage += 'Server error occurred. Please try again later.';
            } else {
                userMessage += error.message;
            }

            // Set error state
            this.downloadStateManager.setDownloadState(buttonId, 'error', {
                errorMessage: userMessage
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

            // Refresh the knowledge base
            this.loadKnowledgeBase();

            // Hide bulk actions bar
            document.getElementById('bulk-actions-bar').style.display = 'none';

            // Clear selection
            this.selectedItems.clear();

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
            for (const id of selectedIds) {
                await this.retryDistillation(id);
            }

            this.showTemporaryMessage(`Retrying ${selectedIds.length} selected items...`, 'info');

            // Clear selection and refresh
            this.selectedItems.clear();
            this.handleRowSelection();
            this.loadKnowledgeBase();

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

            for (const item of allItems) {
                await this.retryDistillation(item.id);
            }

            this.showTemporaryMessage(`Retrying all ${allItems.length} items...`, 'info');
            this.loadKnowledgeBase();

        } catch (error) {
            console.error('Error retrying all items:', error);
            alert('Error retrying all items: ' + error.message);
        }
    }

    async bulkRetryFailed() {
        try {
            const failedItems = this.knowledgeBase.filter(item => item.status === 'error');

            if (failedItems.length === 0) {
                alert('No failed items to retry.');
                return;
            }

            if (!confirm(`Are you sure you want to retry ${failedItems.length} failed item(s)?`)) {
                return;
            }

            for (const item of failedItems) {
                await this.retryDistillation(item.id);
            }

            this.showTemporaryMessage(`Retrying ${failedItems.length} failed items...`, 'info');
            this.loadKnowledgeBase();

        } catch (error) {
            console.error('Error retrying failed items:', error);
            alert('Error retrying failed items: ' + error.message);
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
        console.log('Text pasted from clipboard successfully');
    } catch (err) {
        console.error('Failed to read clipboard:', err);

        // Fallback: show alert and focus input for manual paste
        alert('Unable to access clipboard automatically. Please paste manually using Ctrl+V (or Cmd+V on Mac).');
        const mainInput = document.getElementById('main-input');
        mainInput.focus();
        mainInput.select();
    }
}

function triggerFileUpload() {
    const uploadBtn = document.getElementById('upload-btn');
    if (!uploadBtn.classList.contains('disabled')) {
        document.getElementById('file-input').click();
    }
}

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
    app.loadKnowledgeBase();
}

function toggleSelectAll() {
    app.toggleSelectAll();
}

function bulkDownload() {
    app.handleBulkDownloadClick();
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

async function saveAIConfiguration() {
    const saveBtn = document.getElementById('save-config-btn');
    const modeToggle = document.getElementById('mode-toggle');

    const settings = {
        mode: modeToggle.checked ? 'online' : 'offline',
        offline: {
            model: document.getElementById('ollama-model').value,
            endpoint: document.getElementById('ollama-endpoint').value || 'http://localhost:11434'
        },
        online: {
            provider: document.getElementById('provider-select').value,
            apiKey: document.getElementById('api-key').value,
            model: document.getElementById('model-select').value,
            endpoint: ''
        }
    };

    // Validate configuration
    const validation = await validateAIConfiguration(settings);
    if (!validation.valid) {
        showTestResult(`❌ Configuration invalid: ${validation.errors.join(', ')}`, 'error');
        return;
    }

    // Save settings
    const saveSuccess = await aiSettingsManager.saveSettings(settings);
    console.log('Save result:', saveSuccess);

    if (saveSuccess) {
        saveBtn.disabled = true;
        saveBtn.querySelector('.btn-text').textContent = 'Saved!';
        saveBtn.querySelector('.btn-icon').textContent = '✅';

        setTimeout(() => {
            saveBtn.disabled = false;
            saveBtn.querySelector('.btn-text').textContent = 'Save Configuration';
            saveBtn.querySelector('.btn-icon').textContent = '💾';
        }, 2000);

        showTestResult('✅ Configuration saved successfully!', 'success');
    } else {
        showTestResult('❌ Failed to save configuration', 'error');
    }
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
        return { valid: true }; // Unknown provider, skip validation
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

        console.log('Saving AI settings:', settings);

        const success = await aiSettingsManager.saveSettings(settings);
        console.log('Save result:', success);

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
                    console.log('Processing queue settings updated successfully');
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