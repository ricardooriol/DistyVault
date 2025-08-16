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
        // Clear any problematic stored settings that might cause provider to default to something other than empty
        this.clearProblematicSettings();

        this.loadSettings().then(settings => {
            this.settings = settings;
        });
    }

    /**
     * Clear any stored settings that might cause the provider to not default to empty
     */
    clearProblematicSettings() {
        try {
            const stored = localStorage.getItem('ai-provider-settings');
            if (stored) {
                const settings = JSON.parse(stored);
                if (settings.online && settings.online.provider && settings.online.provider !== '') {
                    settings.online.provider = '';
                    localStorage.setItem('ai-provider-settings', JSON.stringify(settings));
                }
            }
        } catch (error) {
            console.error('Error clearing problematic settings:', error);
        }
    }

    /**
     * Open the AI settings modal
     */
    async openModal() {
        const modal = DomUtils.getElementById('ai-settings-modal');
        if (modal) {
            // Reset scroll position to top
            this.resetModalScroll(modal);
            
            modal.style.display = 'flex';

            // FORCE reset provider to empty before loading settings
            const providerSelect = DomUtils.getElementById('provider-select');
            if (providerSelect) {
                providerSelect.value = '';
                providerSelect.selectedIndex = 0;
            }

            await this.loadSettingsUI();
        }
    }

    /**
     * Reset scroll position for modal and its content areas
     * @param {HTMLElement} modal - The modal element
     */
    resetModalScroll(modal) {
        if (modal) {
            // Immediate reset
            modal.scrollTop = 0;
            
            // Reset scroll for common scrollable elements within the modal
            const scrollableElements = modal.querySelectorAll('.modal-body, .modal-content, .settings-content, .form-container, #ai-settings-form, .provider-config');
            scrollableElements.forEach(element => {
                if (element && element.scrollTop !== undefined) {
                    element.scrollTop = 0;
                }
            });
            
            // Additional reset after a short delay to ensure DOM is fully rendered
            setTimeout(() => {
                modal.scrollTop = 0;
                scrollableElements.forEach(element => {
                    if (element && element.scrollTop !== undefined) {
                        element.scrollTop = 0;
                    }
                });
            }, 10);
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
            if (result.success && result.settings) {
                // FORCE provider to be empty if not explicitly set
                const settings = result.settings;
                if (!settings.online || !settings.online.provider) {
                    settings.online = settings.online || {};
                    settings.online.provider = '';
                }
                return settings;
            }

            // Fallback to localStorage
            const stored = localStorage.getItem('ai-provider-settings');
            if (stored) {
                const settings = JSON.parse(stored);
                // FORCE provider to be empty if not explicitly set
                if (!settings.online || !settings.online.provider) {
                    settings.online = settings.online || {};
                    settings.online.provider = '';
                }
                return settings;
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
            mode: 'online',
            concurrentProcessing: 1,
            offline: {
                model: '',
                endpoint: 'http://localhost:11434'
            },
            online: {
                provider: '',  // Empty to show "Select a provider"
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
            // ALWAYS start with empty provider to show "Select a provider"
            // Only use saved provider if it's explicitly set and valid
            let providerValue = '';

            if (settings.online.provider &&
                ['openai', 'anthropic', 'google', 'grok', 'deepseek'].includes(settings.online.provider)) {
                providerValue = settings.online.provider;
            }

            providerSelect.value = providerValue;
            providerSelect.selectedIndex = providerValue ?
                Array.from(providerSelect.options).findIndex(opt => opt.value === providerValue) : 0;

            // Force the change handler to update the UI properly
            setTimeout(() => {
                this.handleProviderChange();
                // Set model value after provider change is complete
                if (modelSelect) {
                    const savedModel = settings.online.model || 'gpt-3.5-turbo';
                    modelSelect.value = savedModel;
                    
                    // If the saved model is not available in the dropdown, select the first available option
                    if (modelSelect.selectedIndex === -1 && modelSelect.options.length > 0) {
                        modelSelect.selectedIndex = 0;
                    }
                }
            }, 0);
        } else if (modelSelect) {
            // If no provider is selected, still set the model value
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

        // Clear model options first
        modelSelect.innerHTML = '';

        if (!selectedProvider) {
            // No provider selected, add placeholder
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Select a provider first';
            option.disabled = true;
            modelSelect.appendChild(option);
            
            // Update API key help text to show generic message
            this.updateApiKeyHelp();
            return;
        }

        const models = this.providerModels[selectedProvider] || [];

        // Populate model options
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

        if (!selectedProvider) {
            apiKeyHelp.textContent = 'Select a provider to see API key instructions';
            return;
        }

        const providerInfo = this.providerInfo[selectedProvider];

        if (providerInfo) {
            apiKeyHelp.textContent = providerInfo.help;
        } else {
            apiKeyHelp.textContent = 'Enter your API key for the selected provider';
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
        const ollamaModel = DomUtils.getElementById('ollama-model');
        const ollamaEndpoint = DomUtils.getElementById('ollama-endpoint');

        if (!testBtn || !ollamaModel || !ollamaEndpoint) return;

        const originalText = testBtn.innerHTML;
        testBtn.disabled = true;
        testBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Testing...</span>';

        try {
            const result = await this.app.apiClient.testOllamaConnection({
                model: ollamaModel.value,
                endpoint: ollamaEndpoint.value
            });

            // Update button with result
            if (result.success) {
                testBtn.innerHTML = '<span class="btn-icon">✅</span><span class="btn-text">Connection successful!</span>';
                testBtn.style.backgroundColor = '#4caf50';
                testBtn.style.color = 'white';
            } else {
                testBtn.innerHTML = '<span class="btn-icon">❌</span><span class="btn-text">Connection failed!</span>';
                testBtn.style.backgroundColor = '#f44336';
                testBtn.style.color = 'white';
            }

            // Reset button after 5 seconds
            setTimeout(() => {
                testBtn.innerHTML = originalText;
                testBtn.style.backgroundColor = '';
                testBtn.style.color = '';
                testBtn.disabled = false;
            }, 5000);

        } catch (error) {
            // Show error state
            testBtn.innerHTML = '<span class="btn-icon">❌</span><span class="btn-text">Connection failed!</span>';
            testBtn.style.backgroundColor = '#f44336';
            testBtn.style.color = 'white';

            // Reset button after 5 seconds
            setTimeout(() => {
                testBtn.innerHTML = originalText;
                testBtn.style.backgroundColor = '';
                testBtn.style.color = '';
                testBtn.disabled = false;
            }, 5000);
        }
    }

    /**
     * Test provider API connection
     */
    async testProviderConnection() {
        const testBtn = DomUtils.getElementById('test-provider-btn');
        const providerSelect = DomUtils.getElementById('provider-select');
        const modelSelect = DomUtils.getElementById('model-select');
        const apiKey = DomUtils.getElementById('api-key');

        if (!testBtn || !providerSelect || !modelSelect || !apiKey) return;

        const originalText = testBtn.innerHTML;
        testBtn.disabled = true;
        testBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Testing...</span>';

        try {
            const result = await this.app.apiClient.testProviderConnection({
                provider: providerSelect.value,
                model: modelSelect.value,
                apiKey: apiKey.value
            });

            // Update button with result
            if (result.success) {
                testBtn.innerHTML = '<span class="btn-icon">✅</span><span class="btn-text">API key is valid!</span>';
                testBtn.style.backgroundColor = '#4caf50';
                testBtn.style.color = 'white';
            } else {
                testBtn.innerHTML = '<span class="btn-icon">❌</span><span class="btn-text">API key is invalid!</span>';
                testBtn.style.backgroundColor = '#f44336';
                testBtn.style.color = 'white';
            }

            // Reset button after 5 seconds
            setTimeout(() => {
                testBtn.innerHTML = originalText;
                testBtn.style.backgroundColor = '';
                testBtn.style.color = '';
                testBtn.disabled = false;
            }, 5000);

        } catch (error) {
            // Show error state
            testBtn.innerHTML = '<span class="btn-icon">❌</span><span class="btn-text">API key is invalid!</span>';
            testBtn.style.backgroundColor = '#f44336';
            testBtn.style.color = 'white';

            // Reset button after 5 seconds
            setTimeout(() => {
                testBtn.innerHTML = originalText;
                testBtn.style.backgroundColor = '';
                testBtn.style.color = '';
                testBtn.disabled = false;
            }, 5000);
        }
    }

    /**
     * Save AI configuration
     */
    async saveConfiguration() {
        const saveBtn = DomUtils.getElementById('save-config-btn');
        if (!saveBtn) return;

        // Clear any existing validation errors
        this.clearValidationErrors();

        const originalText = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Saving...</span>';

        try {
            const settings = this.collectSettingsFromUI();

            // Validate settings before saving
            const validationErrors = this.validateSettings(settings);
            if (validationErrors.length > 0) {
                // Show validation errors and don't close modal
                this.showValidationErrors(validationErrors);
                return;
            }

            const success = await this.saveSettings(settings);

            if (success) {
                // Only close modal if save was successful
                this.closeModal();
                this.app.showTemporaryMessage('Settings saved', 'success');
            } else {
                throw new Error('Failed to save settings');
            }
        } catch (error) {
            console.error('Error saving configuration:', error);

            // Handle error gracefully - don't close modal on error
            if (typeof ErrorUtils !== 'undefined') {
                ErrorUtils.handleApiError('save configuration', error, {
                    showAlert: true,
                    defaultMessage: 'Error saving configuration'
                });
            } else {
                this.app.showTemporaryMessage('Failed to save settings', 'error');
            }
        } finally {
            // Reset button state
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    }

    /**
     * Reset AI configuration to defaults
     */
    async resetConfiguration() {
        if (!confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
            return;
        }

        const resetBtn = DomUtils.getElementById('reset-config-btn') || document.querySelector('.reset-btn');
        const originalText = resetBtn ? resetBtn.innerHTML : '';

        if (resetBtn) {
            resetBtn.disabled = true;
            resetBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Resetting...</span>';
        }

        try {
            // Reset to default settings
            this.settings = this.getDefaultSettings();
            
            // Clear any stored settings to ensure clean reset
            localStorage.removeItem('ai-provider-settings');

            // Close modal immediately after showing resetting state
            this.closeModal();

            // Save the reset settings
            const success = await this.saveSettings(this.settings);

            if (success) {
                this.app.showTemporaryMessage('Settings reset', 'success');
            } else {
                throw new Error('Failed to save reset settings');
            }
        } catch (error) {
            console.error('Error resetting configuration:', error);
            this.app.showTemporaryMessage('Failed to reset settings', 'error');
        } finally {
            // Reset button state
            if (resetBtn) {
                resetBtn.innerHTML = originalText;
                resetBtn.disabled = false;
            }
        }
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
                provider: providerSelect ? providerSelect.value : '',
                apiKey: apiKey ? apiKey.value : '',
                model: modelSelect ? modelSelect.value : 'gpt-3.5-turbo',
                endpoint: ''
            }
        };
    }

    /**
     * Validate settings before saving
     */
    validateSettings(settings) {
        const errors = [];

        if (settings.mode === 'online') {
            // Validate online provider settings
            if (!settings.online.provider) {
                errors.push({
                    field: 'provider-select',
                    message: 'Please select an AI provider'
                });
            } else {
                const validProviders = ['openai', 'anthropic', 'google', 'grok', 'deepseek'];
                if (!validProviders.includes(settings.online.provider)) {
                    errors.push({
                        field: 'provider-select',
                        message: 'Please select a valid AI provider'
                    });
                }
            }

            if (!settings.online.model) {
                errors.push({
                    field: 'model-select',
                    message: 'Please select a model'
                });
            }

            if (!settings.online.apiKey || settings.online.apiKey.trim() === '') {
                errors.push({
                    field: 'api-key',
                    message: 'Please enter your API key'
                });
            }
        } else {
            // Validate offline settings
            if (!settings.offline.model || settings.offline.model.trim() === '') {
                errors.push({
                    field: 'ollama-model',
                    message: 'Please enter a model name'
                });
            }

            if (!settings.offline.endpoint || settings.offline.endpoint.trim() === '') {
                errors.push({
                    field: 'ollama-endpoint',
                    message: 'Please enter an endpoint URL'
                });
            }
        }

        return errors;
    }

    /**
     * Show validation errors in the UI
     */
    showValidationErrors(errors) {
        errors.forEach(error => {
            const field = DomUtils.getElementById(error.field);
            if (field) {
                // Add error class to field
                field.classList.add('error');

                // Special handling for API key error
                if (error.field === 'api-key') {
                    const apiKeyError = DomUtils.getElementById('api-key-error');
                    if (apiKeyError) {
                        apiKeyError.style.display = 'block';
                        apiKeyError.textContent = error.message;
                    }
                } else {
                    // Create or update error message for other fields
                    let errorElement = field.parentNode.querySelector('.error-message');
                    if (!errorElement) {
                        errorElement = document.createElement('small');
                        errorElement.className = 'error-message';
                        errorElement.style.color = '#f44336';
                        errorElement.style.display = 'block';
                        field.parentNode.appendChild(errorElement);
                    }
                    errorElement.textContent = error.message;
                }
            }
        });

        // Show a general error message
        this.app.showTemporaryMessage('Please fix the highlighted fields', 'error');
    }

    /**
     * Clear validation errors from the UI
     */
    clearValidationErrors() {
        // Remove error classes and messages
        const errorFields = document.querySelectorAll('.form-input.error, .form-select.error');
        errorFields.forEach(field => {
            field.classList.remove('error');
        });

        const errorMessages = document.querySelectorAll('.error-message');
        errorMessages.forEach(message => {
            message.remove();
        });

        // Hide API key error specifically
        const apiKeyError = DomUtils.getElementById('api-key-error');
        if (apiKeyError) {
            apiKeyError.style.display = 'none';
        }
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

// Export for use in other modules
window.SettingsModal = SettingsModal;