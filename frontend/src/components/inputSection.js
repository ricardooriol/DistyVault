/**
 * InputSection Component
 * Handles file upload, URL input, and drag-and-drop functionality
 */
class InputSection {
    constructor(app) {
        this.app = app;
        this.selectedFile = null;
    }

    /**
     * Initialize the input section component
     */
    init() {
        this.setupEventListeners();
        this.updateButtonStates();
    }

    /**
     * Set up event listeners for input interactions
     */
    setupEventListeners() {
        // Main input field
        const mainInput = DomUtils.getElementById('main-input');
        if (mainInput) {
            mainInput.addEventListener('input', (e) => {
                this.handleInputChange(e.target.value);
            });
        }

        // File input
        const fileInput = DomUtils.getElementById('file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileSelection(e.target.files);
            });
        }

        // Drag and drop on the entire input section
        const inputSection = DomUtils.querySelector('.input-section');
        const dropzone = DomUtils.getElementById('dropzone');

        if (inputSection && dropzone) {
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
                DomUtils.getElementById('file-input').click();
            });
        }
    }

    /**
     * Handle input field changes
     */
    handleInputChange(value) {
        const trimmedValue = value.trim();

        // Clear file selection if user types in input
        if (trimmedValue && this.selectedFile) {
            this.removeFile();
        }

        // Update URL type indicator
        this.updateUrlTypeIndicator(trimmedValue);

        // Update button states
        this.updateButtonStates();
    }

    /**
     * Handle file selection from input or drag-and-drop
     */
    handleFileSelection(files) {
        if (!files || files.length === 0) return;

        const file = files[0]; // Take only the first file

        // Validate file type
        if (!this.isValidFileType(file)) {
            alert('Please select a valid file type (PDF, DOC, DOCX, or TXT)');
            return;
        }

        // Validate file size (e.g., 50MB limit)
        const maxSize = 50 * 1024 * 1024; // 50MB in bytes
        if (file.size > maxSize) {
            alert('File size must be less than 50MB');
            return;
        }

        // Clear input field if file is selected
        const mainInput = DomUtils.getElementById('main-input');
        if (mainInput && mainInput.value.trim()) {
            mainInput.value = '';
            this.hideUrlTypeIndicator();
        }

        this.selectedFile = file;
        this.showFileDisplay(file);
        this.updateButtonStates();
    }

    /**
     * Validate file type using centralized validation
     */
    isValidFileType(file) {
        return ValidationUtils.isValidDocumentFile(file);
    }

    /**
     * Show file display with file information
     */
    showFileDisplay(file) {
        const fileDisplay = DomUtils.getElementById('file-display');
        const fileName = DomUtils.getElementById('file-name');

        if (fileDisplay && fileName) {
            fileName.textContent = file.name;
            fileDisplay.style.display = 'block';
        }
    }

    /**
     * Remove selected file
     */
    removeFile() {
        this.selectedFile = null;
        const fileDisplay = DomUtils.getElementById('file-display');
        const fileInput = DomUtils.getElementById('file-input');
        
        if (fileDisplay) {
            fileDisplay.style.display = 'none';
        }
        if (fileInput) {
            fileInput.value = '';
        }
        
        this.updateButtonStates();
    }

    /**
     * Update URL type indicator based on input
     */
    updateUrlTypeIndicator(url) {
        const indicator = DomUtils.getElementById('url-type-indicator');
        const typeIcon = DomUtils.getElementById('type-icon');
        const typeText = DomUtils.getElementById('type-text');

        if (!indicator || !typeIcon || !typeText) return;

        if (!url || !this.isValidUrl(url)) {
            this.hideUrlTypeIndicator();
            return;
        }

        let icon = '🌐';
        let text = 'Web Page';

        try {
            const urlObj = new URL(url);
            if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
                icon = '📺';
                text = 'YouTube Video';
            }
        } catch (e) {
            // Invalid URL, hide indicator
            this.hideUrlTypeIndicator();
            return;
        }

        typeIcon.textContent = icon;
        typeText.textContent = text;
        indicator.style.display = 'block';
    }

    /**
     * Hide URL type indicator
     */
    hideUrlTypeIndicator() {
        const indicator = DomUtils.getElementById('url-type-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    /**
     * Validate URL format
     */
    isValidUrl(string) {
        return ValidationUtils.isValidUrl(string);
    }

    /**
     * Update button states based on input
     */
    updateButtonStates() {
        const mainInput = DomUtils.getElementById('main-input');
        const distillBtn = DomUtils.getElementById('distill-btn');

        if (!mainInput || !distillBtn) return;

        const hasText = mainInput.value.trim().length > 0;
        const hasFile = this.selectedFile !== null;

        // Distill button: enabled if there's text or file selected
        if (hasText || hasFile) {
            distillBtn.classList.remove('disabled');
        } else {
            distillBtn.classList.add('disabled');
        }
    }

    /**
     * Start distillation process
     */
    async startDistillation() {
        const distillBtn = DomUtils.getElementById('distill-btn');
        if (!distillBtn || distillBtn.classList.contains('disabled')) {
            return;
        }

        const mainInput = DomUtils.getElementById('main-input');
        const url = mainInput ? mainInput.value.trim() : '';

        try {
            if (this.selectedFile) {
                await this.processFile();
            } else if (url) {
                await this.processUrl(url);
            }

            this.updateButtonStates();
        } catch (error) {
            ErrorUtils.handleApiError('distillation', error, {
                showAlert: true,
                defaultMessage: 'Error starting distillation'
            });
            this.app.statusSection.hideStatus();
        }
    }

    /**
     * Process uploaded file
     */
    async processFile() {
        if (!this.selectedFile) return;

        this.app.statusSection.showStatus(`Processing ${this.selectedFile.name}...`, 25);

        const result = await this.app.apiClient.processFile(this.selectedFile);
        this.app.statusSection.showStatus(`File uploaded. Processing in background...`, 100);
        
        setTimeout(() => this.app.statusSection.hideStatus(), 2000);

        this.removeFile();
        this.forceStatusUpdates();
    }

    /**
     * Process URL
     */
    async processUrl(url) {
        this.app.statusSection.showStatus('Processing URL...', 25);

        const result = await this.app.apiClient.processUrl(url);
        this.app.statusSection.showStatus(`URL submitted. Processing in background...`, 100);
        
        setTimeout(() => this.app.statusSection.hideStatus(), 2000);

        const mainInput = DomUtils.getElementById('main-input');
        if (mainInput) {
            mainInput.value = '';
        }
        this.hideUrlTypeIndicator();
        this.forceStatusUpdates();
    }

    /**
     * Force multiple status updates to detect new items
     */
    forceStatusUpdates() {
        this.app.forceStatusUpdate();
        setTimeout(() => this.app.forceStatusUpdate(), 100);
        setTimeout(() => this.app.forceStatusUpdate(), 500);
        setTimeout(() => this.app.forceStatusUpdate(), 1000);
        setTimeout(() => this.app.forceStatusUpdate(), 2000);
    }

    /**
     * Get current input value
     */
    getCurrentInput() {
        const mainInput = DomUtils.getElementById('main-input');
        return mainInput ? mainInput.value.trim() : '';
    }

    /**
     * Set input value
     */
    setInputValue(value) {
        const mainInput = DomUtils.getElementById('main-input');
        if (mainInput) {
            mainInput.value = value;
            this.handleInputChange(value);
        }
    }

    /**
     * Clear all inputs
     */
    clearInputs() {
        const mainInput = DomUtils.getElementById('main-input');
        if (mainInput) {
            mainInput.value = '';
        }
        
        this.removeFile();
        this.hideUrlTypeIndicator();
        this.updateButtonStates();
    }

    /**
     * Focus on main input
     */
    focusInput() {
        const mainInput = DomUtils.getElementById('main-input');
        if (mainInput) {
            mainInput.focus();
        }
    }

    /**
     * Check if input section has content
     */
    hasContent() {
        const mainInput = DomUtils.getElementById('main-input');
        const hasText = mainInput && mainInput.value.trim().length > 0;
        const hasFile = this.selectedFile !== null;
        return hasText || hasFile;
    }

    /**
     * Get file information
     */
    getFileInfo() {
        return this.selectedFile ? {
            name: this.selectedFile.name,
            size: this.selectedFile.size,
            type: this.selectedFile.type,
            lastModified: this.selectedFile.lastModified
        } : null;
    }
}

// Global functions for HTML onclick handlers
async function pasteFromClipboard(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    try {
        const text = await navigator.clipboard.readText();
        if (window.app && window.app.inputSection) {
            window.app.inputSection.setInputValue(text);
            window.app.inputSection.focusInput();
        }
    } catch (err) {
        console.error('Failed to read clipboard:', err);
        alert('Unable to access clipboard automatically, please paste manually');
        if (window.app && window.app.inputSection) {
            window.app.inputSection.focusInput();
        }
    }
}

// Export for use in other modules
window.InputSection = InputSection;

// Global functions are now handled in init.js
window.pasteFromClipboard = pasteFromClipboard;