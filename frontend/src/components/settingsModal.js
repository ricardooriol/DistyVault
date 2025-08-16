/**
 * SettingsModal Component
 * Handles AI settings configuration modal and related functionality
 */
class SettingsModal {
    constructor(app) {
        this.app = app;
        this.settings = this.getDefaultSettings();
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

    /**
     * Initialize the settings modal component
     */
    init() {
        this.loadSettings().then(settings => {
            this.settings = settings;
        });
    }

    /**
     * Open the AI settings modal
     */
    async openModal() {
        const modal = DomUtils.getElementById('ai-settings-modal');
        if (modal) {
            modal.style.display = 'flex';
            await this.loadSettingsUI();
        }
    }

    /**
     * Close the AI settings modal
     */
    closeModal() {
        const modal = DomUtils.getElementById('ai-settings-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Load settings from backend or localStorage
     */
    async loadSettings() {
        try {
            // Try to load from backend first
            const result = await this.app.apiClient.getAiSettings();
            if (result.success) {
                return result.settings;
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

    /**
     * Get default settings configuration
     */
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

    /**
     * Save settings to backend and localStorage
     */
    async saveSettings(settings) {
        try {
            this.settings = { ...settings, lastUpdated: new Date().toISOString() };
            
            // Save to backend (in-memory only for security)
            const result = await this.app.apiClient.saveAiSettings(this.settings);
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

    /**
     * Load and populate the settings UI
     */
    async loadSettingsUI() {
        const settings = await this.loadSettings();
        this.settings = settings;

        // Update mode toggle
        const modeToggle = DomUtils.getElementById('mode-toggle');
        const offlineLabel = DomUtils.getElementById('offline-label');
        const onlineLabel = DomUtils.getElementById('online-label');
        const modeDescription = DomUtils.getElementById('mode-description');
        const offlineConfig = DomUtils.getElementById('offline-config');
        const onlineConfig = DomUtils.getElementById('online-config');

        if (modeToggle) {
            modeToggle.checked = settings.mode === 'online';
        }

        // Update mode labels
        if (offlineLabel && onlineLabel) {
            if (settings.mode === 'offline') {
                offlineLabel.classList.add('active');
                onlineLabel.classList.remove('active');
            } else {
                offlineLabel.classList.remove('active');
                onlineLabel.classList.add('active');
            }
        }

        // Update mode description
        if (modeDescription) {
            modeDescription.textContent = settings.mode === 'offline' 
                ? 'Use local Ollama server for processing'
                : 'Use cloud-based AI providers for processing';
        }

        // Show/hide config sections
        if (offlineConfig && onlineConfig) {
            if (settings.mode === 'offline') {
                offlineConfig.classList.remove('hidden');
                onlineConfig.classList.add('hidden');
            } else {
                offlineConfig.classList.add('hidden');
                onlineConfig.classList.remove('hidden');
            }
        }

        // Load offline settings
        const ollamaModel = DomUtils.getElementById('ollama-model');
        const ollamaEndpoint = DomUtils.getElementById('ollama-endpoint');
        
        if (ollamaModel) {
            ollamaModel.value = settings.offline.model || '';
        }
        if (ollamaEndpoint) {
            ollamaEndpoint.value = settings.offline.endpoint || 'http://localhost:11434';
        }

        // Load online settings
        const providerSelect = DomUtils.getElementById('provider-select');
        const modelSelect = DomUtils.getElementById('model-select');
        const apiKey = DomUtils.getElementById('api-key');

        if (providerSelect) {
            providerSelect.value = settings.online.provider || 'openai';
            this.handleProviderChange();
        }

        if (modelSelect) {
            modelSelect.value = settings.online.model || 'gpt-3.5-turbo';
        }

        if (apiKey) {
            apiKey.value = settings.online.apiKey || '';
        }

        // Load concurrent processing setting
        const concurrentProcessing = DomUtils.getElementById('concurrent-processing');
        if (concurrentProcessing) {
            concurrentProcessing.value = settings.concurrentProcessing || 1;
        }

        // Update API key help text
        this.updateApiKeyHelp();
    }

    /**
     * Handle mode toggle change
     */
    handleModeToggle() {
        const modeToggle = DomUtils.getElementById('mode-toggle');
        const offlineLabel = DomUtils.getElementById('offline-label');
        const onlineLabel = DomUtils.getElementById('online-label');
        const modeDescription = DomUtils.getElementById('mode-description');
        const offlineConfig = DomUtils.getElementById('offline-config');
        const onlineConfig = DomUtils.getElementById('online-config');

        if (!modeToggle) return;

        const isOnline = modeToggle.checked;

        // Update labels
        if (offlineLabel && onlineLabel) {
            if (isOnline) {
                offlineLabel.classList.remove('active');
                onlineLabel.classList.add('active');
            } else {
                offlineLabel.classList.add('active');
                onlineLabel.classList.remove('active');
            }
        }

        // Update description
        if (modeDescription) {
            modeDescription.textContent = isOnline 
                ? 'Use cloud-based AI providers for processing'
                : 'Use local Ollama server for processing';
        }

        // Show/hide config sections
        if (offlineConfig && onlineConfig) {
            if (isOnline) {
                offlineConfig.classList.add('hidden');
                onlineConfig.classList.remove('hidden');
            } else {
                offlineConfig.classList.remove('hidden');
                onlineConfig.classList.add('hidden');
            }
        }
    }

    /**
     * Handle provider selection change
     */
    handleProviderChange() {
        const providerSelect = DomUtils.getElementById('provider-select');
        const modelSelect = DomUtils.getElementById('model-select');

        if (!providerSelect || !modelSelect) return;

        const selectedProvider = providerSelect.value;
        const models = this.providerModels[selectedProvider] || [];

        // Clear and populate model options
        modelSelect.innerHTML = '';
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            modelSelect.appendChild(option);
        });

        // Update API key help text
        this.updateApiKeyHelp();
    }

    /**
     * Update API key help text based on selected provider
     */
    updateApiKeyHelp() {
        const providerSelect = DomUtils.getElementById('provider-select');
        const apiKeyHelp = DomUtils.getElementById('api-key-help');

        if (!providerSelect || !apiKeyHelp) return;

        const selectedProvider = providerSelect.value;
        const providerInfo = this.providerInfo[selectedProvider];

        if (providerInfo) {
            apiKeyHelp.textContent = providerInfo.help;
        }
    }

    /**
     * Toggle API key visibility
     */
    toggleApiKeyVisibility() {
        const apiKey = DomUtils.getElementById('api-key');
        const visibilityIcon = DomUtils.getElementById('visibility-icon');

        if (!apiKey || !visibilityIcon) return;

        if (apiKey.type === 'password') {
            apiKey.type = 'text';
            visibilityIcon.textContent = '🙈';
        } else {
            apiKey.type = 'password';
            visibilityIcon.textContent = '👁️';
        }
    }

    /**
     * Adjust concurrent processing value
     */
    adjustConcurrentProcessing(delta) {
        const input = DomUtils.getElementById('concurrent-processing');
        if (!input) return;

        const currentValue = parseInt(input.value) || 1;
        const newValue = Math.max(1, Math.min(10, currentValue + delta));
        input.value = newValue;
    }

    /**
     * Test Ollama connection
     */
    async testOllamaConnection() {
        const testBtn = DomUtils.getElementById('test-ollama-btn');
        const testResults = DomUtils.getElementById('test-results');
        const testResultContent = DomUtils.getElementById('test-result-content');
        const ollamaModel = DomUtils.getElementById('ollama-model');
        const ollamaEndpoint = DomUtils.getElementById('ollama-endpoint');

        if (!testBtn || !testResults || !testResultContent || !ollamaModel || !ollamaEndpoint) return;

        const originalText = testBtn.innerHTML;
        testBtn.disabled = true;
        testBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Testing...</span>';

        try {
            const result = await this.app.apiClient.testOllamaConnection({
                model: ollamaModel.value,
                endpoint: ollamaEndpoint.value
            });
            
            testResults.style.display = 'block';
            if (result.success) {
                testResultContent.innerHTML = `
                    <div class="test-success">
                        <span class="test-icon">✅</span>
                        <span class="test-message">Connection successful! Model "${result.model}" is available.</span>
                    </div>
                `;
            } else {
                testResultContent.innerHTML = `
                    <div class="test-error">
                        <span class="test-icon">❌</span>
                        <span class="test-message">Connection failed: ${result.error}</span>
                    </div>
                `;
            }
        } catch (error) {
            testResults.style.display = 'block';
            testResultContent.innerHTML = `
                <div class="test-error">
                    <span class="test-icon">❌</span>
                    <span class="test-message">Test failed: ${error.message}</span>
                </div>
            `;
        } finally {
            testBtn.disabled = false;
            testBtn.innerHTML = originalText;
        }
    }

    /**
     * Test provider API connection
     */
    async testProviderConnection() {
        const testBtn = DomUtils.getElementById('test-provider-btn');
        const testResults = DomUtils.getElementById('test-results');
        const testResultContent = DomUtils.getElementById('test-result-content');
        const providerSelect = DomUtils.getElementById('provider-select');
        const modelSelect = DomUtils.getElementById('model-select');
        const apiKey = DomUtils.getElementById('api-key');

        if (!testBtn || !testResults || !testResultContent || !providerSelect || !modelSelect || !apiKey) return;

        const originalText = testBtn.innerHTML;
        testBtn.disabled = true;
        testBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Testing...</span>';

        try {
            const result = await this.app.apiClient.testProviderConnection({
                provider: providerSelect.value,
                model: modelSelect.value,
                apiKey: apiKey.value
            });
            
            testResults.style.display = 'block';
            if (result.success) {
                testResultContent.innerHTML = `
                    <div class="test-success">
                        <span class="test-icon">✅</span>
                        <span class="test-message">API key is valid! Connected to ${result.provider} ${result.model}.</span>
                    </div>
                `;
            } else {
                testResultContent.innerHTML = `
                    <div class="test-error">
                        <span class="test-icon">❌</span>
                        <span class="test-message">API test failed: ${result.error}</span>
                    </div>
                `;
            }
        } catch (error) {
            testResults.style.display = 'block';
            testResultContent.innerHTML = `
                <div class="test-error">
                    <span class="test-icon">❌</span>
                    <span class="test-message">Test failed: ${error.message}</span>
                </div>
            `;
        } finally {
            testBtn.disabled = false;
            testBtn.innerHTML = originalText;
        }
    }

    /**
     * Save AI configuration
     */
    async saveConfiguration() {
        const saveBtn = DomUtils.getElementById('save-config-btn');
        if (!saveBtn) return;

        const originalText = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Saving...</span>';

        try {
            const settings = this.collectSettingsFromUI();
            const success = await this.saveSettings(settings);

            if (success) {
                // Show success feedback
                saveBtn.innerHTML = '<span class="btn-icon">✅</span><span class="btn-text">Saved!</span>';
                setTimeout(() => {
                    saveBtn.innerHTML = originalText;
                    saveBtn.disabled = false;
                }, 2000);
            } else {
                throw new Error('Failed to save settings');
            }
        } catch (error) {
            ErrorUtils.handleApiError('save configuration', error, {
                showAlert: true,
                defaultMessage: 'Error saving configuration'
            });
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    }

    /**
     * Reset AI configuration to defaults
     */
    resetConfiguration() {
        if (!confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
            return;
        }

        this.settings = this.getDefaultSettings();
        this.loadSettingsUI();
    }

    /**
     * Collect settings from UI elements
     */
    collectSettingsFromUI() {
        const modeToggle = DomUtils.getElementById('mode-toggle');
        const ollamaModel = DomUtils.getElementById('ollama-model');
        const ollamaEndpoint = DomUtils.getElementById('ollama-endpoint');
        const providerSelect = DomUtils.getElementById('provider-select');
        const modelSelect = DomUtils.getElementById('model-select');
        const apiKey = DomUtils.getElementById('api-key');
        const concurrentProcessing = DomUtils.getElementById('concurrent-processing');

        return {
            mode: modeToggle && modeToggle.checked ? 'online' : 'offline',
            concurrentProcessing: concurrentProcessing ? parseInt(concurrentProcessing.value) || 1 : 1,
            offline: {
                model: ollamaModel ? ollamaModel.value : '',
                endpoint: ollamaEndpoint ? ollamaEndpoint.value : 'http://localhost:11434'
            },
            online: {
                provider: providerSelect ? providerSelect.value : 'openai',
                apiKey: apiKey ? apiKey.value : '',
                model: modelSelect ? modelSelect.value : 'gpt-3.5-turbo',
                endpoint: ''
            }
        };
    }

    /**
     * Get current provider configuration
     */
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

// Global functions are now handled in init.js

// Global functions are now handled in init.js