// SAWRON App JavaScript
class SawronApp {
    constructor() {
        this.knowledgeBase = [];
        this.currentFilter = 'all';
        this.selectedFile = null;
        this.refreshInterval = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadKnowledgeBase();
        this.startAutoRefresh();
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
        document.getElementById('summary-modal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeSummaryModal();
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
        const summarizeBtn = document.getElementById('summarize-btn');

        const hasText = mainInput.value.trim().length > 0;
        const hasFile = this.selectedFile !== null;

        // Upload button: disabled if there's text in input
        if (hasText) {
            uploadBtn.classList.add('disabled');
        } else {
            uploadBtn.classList.remove('disabled');
        }

        // Summarize button: enabled if there's text or file selected
        if (hasText || hasFile) {
            summarizeBtn.classList.remove('disabled');
        } else {
            summarizeBtn.classList.add('disabled');
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

        console.log(`Status: ${message} (${progress}%)`);
    }

    hideStatus() {
        document.getElementById('status-section').style.display = 'none';
    }

    async startSummarization() {
        const summarizeBtn = document.getElementById('summarize-btn');
        if (summarizeBtn.classList.contains('disabled')) {
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

                console.log(`Uploading file: ${this.selectedFile.name} (${this.selectedFile.size} bytes)`);

                const response = await fetch('/api/process/file', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to process file');
                }

                const result = await response.json();
                console.log('File processing started:', result);

                this.showStatus(`File uploaded. Processing in background...`, 100);
                setTimeout(() => this.hideStatus(), 2000);

                this.removeFile();
                this.loadKnowledgeBase();

            } else if (url) {
                // Process URL
                this.showStatus('Processing URL...', 25);

                console.log(`Processing URL: ${url}`);

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
                console.log('URL processing started:', result);

                this.showStatus(`URL submitted. Processing in background...`, 100);
                setTimeout(() => this.hideStatus(), 2000);

                mainInput.value = '';
                this.loadKnowledgeBase();
            }

            this.updateButtonStates();

        } catch (error) {
            console.error('Error during summarization:', error);
            alert('Error: ' + error.message);
            this.hideStatus();
        }
    }

    startAutoRefresh() {
        // Refresh knowledge base every 5 seconds to update status
        this.refreshInterval = setInterval(() => {
            this.loadKnowledgeBase();
        }, 5000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    async loadKnowledgeBase() {
        try {
            const response = await fetch('/api/summaries');
            if (!response.ok) {
                throw new Error('Failed to load knowledge base');
            }

            this.knowledgeBase = await response.json();
            this.renderKnowledgeBase();
        } catch (error) {
            console.error('Error loading knowledge base:', error);
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

        if (!items || items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state-cell">
                        <div class="empty-state">
                            <div class="empty-icon">🎯</div>
                            <h3>Ready to Process Knowledge</h3>
                            <p>Start by entering a URL, YouTube video, or uploading a document above.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = items.map(item => this.createTableRow(item)).join('');
    }

    createTableRow(item) {
        const status = item.status;
        const isCompleted = status === 'completed';
        const isProcessing = ['initializing', 'extracting', 'summarizing'].includes(status);
        const isError = status === 'error';

        let statusClass = '';
        let statusIcon = '';

        if (isCompleted) {
            statusClass = 'status-completed';
            statusIcon = '✅';
        } else if (isProcessing) {
            statusClass = 'status-processing';
            statusIcon = '⏳';
        } else if (isError) {
            statusClass = 'status-error';
            statusIcon = '❌';
        }

        const title = item.title || 'Processing...';

        // Format source display
        let sourceDisplay = '';
        if (item.sourceUrl) {
            sourceDisplay = `<a href="${item.sourceUrl}" target="_blank" class="source-link">${this.truncateText(item.sourceUrl, 30)}</a>`;
        } else if (item.sourceFile) {
            sourceDisplay = `<span class="file-source">${item.sourceFile.name}</span>`;
        }

        // Format status display with step
        const statusDisplay = `
            <div class="status-cell ${statusClass}">
                <span class="status-icon">${statusIcon}</span>
                <span class="status-text">${status.toUpperCase()}</span>
                ${item.processingStep ? `<div class="processing-step">${item.processingStep}</div>` : ''}
            </div>
        `;

        // Format elapsed time
        let elapsedTimeDisplay = '-';
        if (item.elapsedTime) {
            const minutes = Math.floor(item.elapsedTime / 60);
            const seconds = Math.floor(item.elapsedTime % 60);
            elapsedTimeDisplay = `${minutes}m ${seconds}s`;
        }

        // Format created date
        const createdAt = new Date(item.createdAt);
        const formattedDate = this.formatDate(createdAt);

        // Format actions
        const actions = `
            <div class="table-actions">
                ${isCompleted ? `
                    <button class="action-btn view-btn" onclick="app.showSummaryModal('${item.id}')">
                        View
                    </button>
                    <button class="action-btn download-btn" onclick="app.downloadSummary('${item.id}')">
                        Download
                    </button>
                ` : ''}
                ${isProcessing ? `
                    <button class="action-btn stop-btn" onclick="app.stopProcessing('${item.id}')">
                        Stop
                    </button>
                ` : ''}
                ${(isCompleted || isError) && item.rawContent ? `
                    <button class="action-btn debug-btn" onclick="app.showRawContent('${item.id}')">
                        Raw
                    </button>
                ` : ''}
                ${item.logs && item.logs.length > 0 ? `
                    <button class="action-btn debug-btn" onclick="app.showLogs('${item.id}')">
                        Logs
                    </button>
                ` : ''}
                <button class="action-btn delete-btn" onclick="app.deleteSummary('${item.id}')">
                    Delete
                </button>
            </div>
        `;

        return `
            <tr data-id="${item.id}">
                <td class="source-cell">${sourceDisplay}</td>
                <td class="type-cell">${this.getTypeLabel(item.sourceType)}</td>
                <td class="status-cell">${statusDisplay}</td>
                <td class="time-cell">${elapsedTimeDisplay}</td>
                <td class="date-cell">${formattedDate}</td>
                <td class="actions-cell">${actions}</td>
            </tr>
        `;
    }

    async showSummaryModal(id) {
        try {
            const response = await fetch(`/api/summaries/${id}`);
            if (!response.ok) {
                throw new Error('Failed to load summary');
            }

            const summary = await response.json();

            document.getElementById('modal-title').textContent = summary.title;

            let metaHtml = '';

            if (summary.sourceUrl) {
                metaHtml += `<strong>Source:</strong> <a href="${summary.sourceUrl}" target="_blank">${summary.sourceUrl}</a><br>`;
            } else if (summary.sourceFile) {
                metaHtml += `<strong>Source:</strong> ${summary.sourceFile.name}<br>`;
            }

            metaHtml += `<strong>Status:</strong> ${summary.status.toUpperCase()}<br>`;

            if (summary.processingStep) {
                metaHtml += `<strong>Processing Step:</strong> ${summary.processingStep}<br>`;
            }

            metaHtml += `<strong>Created:</strong> ${this.formatDate(new Date(summary.createdAt))}<br>`;

            if (summary.completedAt) {
                metaHtml += `<strong>Completed:</strong> ${this.formatDate(new Date(summary.completedAt))}<br>`;
            }

            if (summary.elapsedTime) {
                const minutes = Math.floor(summary.elapsedTime / 60);
                const seconds = Math.floor(summary.elapsedTime % 60);
                metaHtml += `<strong>Elapsed Time:</strong> ${minutes}m ${seconds}s<br>`;
            }

            if (summary.processingTime) {
                metaHtml += `<strong>Processing Time:</strong> ${summary.processingTime.toFixed(1)}s<br>`;
            }

            if (summary.wordCount) {
                metaHtml += `<strong>Word Count:</strong> ${summary.wordCount} words<br>`;
            }

            document.getElementById('summary-meta').innerHTML = metaHtml;
            document.getElementById('summary-content').innerHTML = this.formatContent(summary.content || '');
            document.getElementById('summary-modal').style.display = 'block';

        } catch (error) {
            console.error('Error showing summary:', error);
            alert('Error loading summary: ' + error.message);
        }
    }

    async showRawContent(id) {
        try {
            const response = await fetch(`/api/summaries/${id}`);
            if (!response.ok) {
                throw new Error('Failed to load summary');
            }

            const summary = await response.json();

            if (!summary.rawContent) {
                alert('No raw content available for this summary');
                return;
            }

            document.getElementById('raw-content-title').textContent = `Raw Content: ${summary.title}`;
            document.getElementById('raw-content-text').textContent = summary.rawContent;
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
                throw new Error('Failed to load summary');
            }

            const summary = await response.json();

            if (!summary.logs || summary.logs.length === 0) {
                alert('No logs available for this summary');
                return;
            }

            document.getElementById('logs-title').textContent = `Processing Logs: ${summary.title}`;

            const logsHtml = summary.logs.map(log => {
                const timestamp = new Date(log.timestamp);
                const formattedTime = timestamp.toLocaleTimeString();
                const levelClass = `log-${log.level}`;

                return `<div class="log-entry ${levelClass}">
                    <span class="log-time">[${formattedTime}]</span>
                    <span class="log-message">${log.message}</span>
                </div>`;
            }).join('');

            document.getElementById('logs-content').innerHTML = logsHtml;
            document.getElementById('logs-modal').style.display = 'block';

        } catch (error) {
            console.error('Error showing logs:', error);
            alert('Error loading logs: ' + error.message);
        }
    }

    closeSummaryModal() {
        document.getElementById('summary-modal').style.display = 'none';
    }

    closeRawContentModal() {
        document.getElementById('raw-content-modal').style.display = 'none';
    }

    closeLogsModal() {
        document.getElementById('logs-modal').style.display = 'none';
    }

    async downloadSummary(id) {
        try {
            const response = await fetch(`/api/summaries/${id}/pdf`);

            if (response.status === 501) {
                alert('PDF download not yet implemented');
                return;
            }

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to download summary');
            }

            // Handle PDF download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `summary-${id}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Error downloading summary:', error);
            alert('Error: ' + error.message);
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

    async deleteSummary(id) {
        if (!confirm('Are you sure you want to delete this summary?')) {
            return;
        }

        try {
            const response = await fetch(`/api/summaries/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to delete summary');
            }

            this.loadKnowledgeBase();

        } catch (error) {
            console.error('Error deleting summary:', error);
            alert('Error: ' + error.message);
        }
    }

    getTypeLabel(type) {
        const labels = {
            'url': '🌐 Web',
            'youtube': '📺 YouTube',
            'playlist': '📋 YouTube Playlist',
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

        return content.split('\n').map(line => {
            if (line.match(/^\d+\./)) {
                return `<p><strong>${line}</strong></p>`;
            }
            return `<p>${line}</p>`;
        }).join('');
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
}

// Global functions for HTML onclick handlers
async function pasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        const mainInput = document.getElementById('main-input');
        mainInput.value = text;
        app.handleInputChange(text);
    } catch (err) {
        console.error('Failed to read clipboard:', err);
        alert('Unable to access clipboard. Please paste manually.');
    }
}

function triggerFileUpload() {
    const uploadBtn = document.getElementById('upload-btn');
    if (!uploadBtn.classList.contains('disabled')) {
        document.getElementById('file-input').click();
    }
}

function startSummarization() {
    app.startSummarization();
}

function removeFile() {
    app.removeFile();
}

function closeSummaryModal() {
    app.closeSummaryModal();
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
            openai: ['gpt-3.5-turbo', 'gpt-3.5-turbo-16k', 'gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini'],
            anthropic: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229', 'claude-3-5-sonnet-20241022'],
            google: ['gemini-2.5-flash'],
            microsoft: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k'],
            grok: ['grok-1', 'grok-1.5'],
            deepseek: ['deepseek-chat', 'deepseek-coder']
        };
        this.providerInfo = {
            openai: { name: 'OpenAI', keyPrefix: 'sk-', help: 'Get your API key from https://platform.openai.com/api-keys' },
            anthropic: { name: 'Anthropic Claude', keyPrefix: 'sk-ant-', help: 'Get your API key from https://console.anthropic.com/' },
            google: { name: 'Google Gemini', keyPrefix: '', help: 'Get your API key from https://makersuite.google.com/app/apikey' },
            microsoft: { name: 'Microsoft Copilot', keyPrefix: '', help: 'Get your API key from Azure OpenAI Service' },
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
            console.log('Frontend: About to save settings to backend:', this.settings);

            // Save to backend (in-memory only for security)
            const response = await fetch('/api/ai-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.settings)
            });
            
            console.log('Frontend: Backend response status:', response.status);

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    console.log('AI settings saved to backend memory successfully');
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
                console.log('AI settings saved to localStorage as fallback (without API key)');
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
    console.log('Opening AI settings modal, loading settings...');
    await loadAISettingsUI();
}

function closeAISettingsModal() {
    const modal = document.getElementById('ai-settings-modal');
    modal.style.display = 'none';
}

async function loadAISettingsUI() {
    const settings = await aiSettingsManager.loadSettings();
    aiSettingsManager.settings = settings;
    
    console.log('Loading AI settings UI with settings:', settings);

    // Set mode toggle
    const modeToggle = document.getElementById('mode-toggle');
    modeToggle.checked = settings.mode === 'online';
    console.log('Setting mode toggle to:', settings.mode, 'checked:', modeToggle.checked);
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
    console.log('Saving AI settings:', settings);
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
    aiSettingsManager.settings = settings;
});