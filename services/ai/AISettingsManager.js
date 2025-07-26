/**
 * AI Settings Manager
 * Handles in-memory storage and management of AI provider configurations
 * Note: Settings are not persisted to disk for security reasons
 */
const crypto = require('crypto');

// Shared settings storage across all instances
let sharedSettings = null;

class AISettingsManager {
    constructor() {
        this.algorithm = 'aes-256-gcm';
    }

    /**
     * Get singleton instance of AISettingsManager
     * @returns {AISettingsManager} - Singleton instance
     */
    static getInstance() {
        if (!AISettingsManager.instance) {
            AISettingsManager.instance = new AISettingsManager();
        }
        return AISettingsManager.instance;
    }

    /**
     * Save AI provider settings (in-memory only)
     * @param {Object} settings - Settings to save
     * @param {string} settings.mode - 'offline' or 'online'
     * @param {Object} settings.offline - Offline configuration
     * @param {Object} settings.online - Online configuration
     */
    saveSettings(settings) {
        try {
            console.log('Saving AI provider settings to shared memory...');

            // Validate settings structure
            const validation = this.validateSettings(settings);
            if (!validation.valid) {
                throw new Error(`Invalid settings: ${validation.errors.join(', ')}`);
            }

            // Store in shared memory only (no disk persistence for security)
            sharedSettings = { ...settings, lastUpdated: new Date().toISOString() };

            console.log('AI provider settings saved to shared memory successfully');
            console.log('Saved settings:', JSON.stringify(sharedSettings, (key, value) => {
                // Hide API key in logs
                if (key === 'apiKey' && value) {
                    return '***HIDDEN***';
                }
                return value;
            }, 2));
        } catch (error) {
            console.error('Error saving AI provider settings:', error);
            throw new Error(`Failed to save settings: ${error.message}`);
        }
    }

    /**
     * Load AI provider settings (from memory or defaults)
     * @returns {Object} - Loaded settings or default settings
     */
    loadSettings() {
        try {
            console.log('Loading AI provider settings from shared memory...');

            if (sharedSettings) {
                console.log('AI provider settings loaded from shared memory successfully');
                console.log('Loaded settings:', JSON.stringify(sharedSettings, (key, value) => {
                    // Hide API key in logs
                    if (key === 'apiKey' && value) {
                        return '***HIDDEN***';
                    }
                    return value;
                }, 2));
                return sharedSettings;
            } else {
                console.log('No settings in shared memory, using defaults');
                return this.getDefaultSettings();
            }
        } catch (error) {
            console.error('Error loading AI provider settings:', error);
            console.log('Using default settings due to load error');
            return this.getDefaultSettings();
        }
    }

    /**
     * Get default AI provider settings
     * @returns {Object} - Default settings
     */
    getDefaultSettings() {
        return {
            mode: 'online',
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
            lastUpdated: new Date().toISOString(),
            version: '1.0.0'
        };
    }

    /**
     * Validate settings structure
     * @param {Object} settings - Settings to validate
     * @returns {{valid: boolean, errors: Array<string>}} - Validation result
     */
    validateSettings(settings) {
        const errors = [];

        if (!settings) {
            errors.push('Settings object is required');
            return { valid: false, errors };
        }

        // Validate mode
        if (!settings.mode || !['offline', 'online'].includes(settings.mode)) {
            errors.push('Mode must be either "offline" or "online"');
        }

        // Validate offline settings (only when in offline mode)
        if (settings.mode === 'offline' && settings.offline) {
            if (!settings.offline.model || typeof settings.offline.model !== 'string') {
                errors.push('Offline model must be a non-empty string when in offline mode');
            }
            if (settings.offline.endpoint && typeof settings.offline.endpoint !== 'string') {
                errors.push('Offline endpoint must be a string');
            }
        }

        // Validate online settings (only when in online mode)
        if (settings.mode === 'online' && settings.online) {
            const validProviders = ['openai', 'anthropic', 'google', 'microsoft', 'grok', 'deepseek'];
            if (!settings.online.provider || !validProviders.includes(settings.online.provider)) {
                errors.push(`Online provider must be one of: ${validProviders.join(', ')}`);
            }
            if (!settings.online.model || typeof settings.online.model !== 'string') {
                errors.push('Online model must be a non-empty string');
            }
            // API key validation is optional here since it might be empty initially
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }



    /**
     * Clear all stored settings (from memory)
     */
    clearSettings() {
        try {
            console.log('Clearing AI provider settings from shared memory...');
            sharedSettings = null;
            console.log('AI provider settings cleared successfully');
        } catch (error) {
            console.error('Error clearing settings:', error);
            throw new Error(`Failed to clear settings: ${error.message}`);
        }
    }

    /**
     * Update specific setting
     * @param {string} path - Setting path (e.g., 'online.apiKey')
     * @param {any} value - New value
     */
    updateSetting(path, value) {
        const settings = this.loadSettings();

        // Navigate to the setting path
        const pathParts = path.split('.');
        let current = settings;

        for (let i = 0; i < pathParts.length - 1; i++) {
            if (!current[pathParts[i]]) {
                current[pathParts[i]] = {};
            }
            current = current[pathParts[i]];
        }

        // Set the value
        current[pathParts[pathParts.length - 1]] = value;

        // Update timestamp
        settings.lastUpdated = new Date().toISOString();

        // Save updated settings
        this.saveSettings(settings);
    }

    /**
     * Get current provider configuration for use with AIProviderFactory
     * @returns {Object} - Provider configuration
     */
    getCurrentProviderConfig() {
        const settings = this.loadSettings();

        if (settings.mode === 'offline') {
            return {
                type: 'ollama',
                model: settings.offline.model,
                endpoint: settings.offline.endpoint
            };
        } else {
            return {
                type: settings.online.provider,
                apiKey: settings.online.apiKey,
                model: settings.online.model,
                endpoint: settings.online.endpoint
            };
        }
    }

    /**
     * Migrate settings from older versions
     * @param {Object} settings - Settings to migrate
     * @returns {Object} - Migrated settings
     */
    migrateSettings(settings) {
        if (!settings.version) {
            // Migrate from version-less to v1.0.0
            settings.version = '1.0.0';
            settings.lastUpdated = new Date().toISOString();
        }

        // Add future migration logic here

        return settings;
    }
}

module.exports = AISettingsManager;