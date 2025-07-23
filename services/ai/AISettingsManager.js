/**
 * AI Settings Manager
 * Handles persistent storage and management of AI provider configurations
 */
const crypto = require('crypto');

class AISettingsManager {
    constructor() {
        this.storageKey = 'ai-provider-settings';
        this.encryptionKey = this.getOrCreateEncryptionKey();
        this.algorithm = 'aes-256-gcm';
    }

    /**
     * Save AI provider settings
     * @param {Object} settings - Settings to save
     * @param {string} settings.mode - 'offline' or 'online'
     * @param {Object} settings.offline - Offline configuration
     * @param {Object} settings.online - Online configuration
     */
    saveSettings(settings) {
        try {
            console.log('Saving AI provider settings...');
            
            // Validate settings structure
            const validation = this.validateSettings(settings);
            if (!validation.valid) {
                throw new Error(`Invalid settings: ${validation.errors.join(', ')}`);
            }

            // Encrypt sensitive data
            const encryptedSettings = this.encryptSensitiveData(settings);
            
            // Save to localStorage (in browser) or file system (in Node.js)
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.setItem(this.storageKey, JSON.stringify(encryptedSettings));
            } else {
                // For Node.js environment, we'll use a simple file-based storage
                const fs = require('fs');
                const path = require('path');
                const settingsDir = path.join(process.cwd(), '.ai-settings');
                
                if (!fs.existsSync(settingsDir)) {
                    fs.mkdirSync(settingsDir, { recursive: true });
                }
                
                const settingsFile = path.join(settingsDir, 'config.json');
                fs.writeFileSync(settingsFile, JSON.stringify(encryptedSettings, null, 2));
            }
            
            console.log('AI provider settings saved successfully');
        } catch (error) {
            console.error('Error saving AI provider settings:', error);
            throw new Error(`Failed to save settings: ${error.message}`);
        }
    }

    /**
     * Load AI provider settings
     * @returns {Object} - Loaded settings or default settings
     */
    loadSettings() {
        try {
            console.log('Loading AI provider settings...');
            
            let storedData = null;
            
            // Load from localStorage (in browser) or file system (in Node.js)
            if (typeof window !== 'undefined' && window.localStorage) {
                const stored = localStorage.getItem(this.storageKey);
                if (stored) {
                    storedData = JSON.parse(stored);
                }
            } else {
                // For Node.js environment
                const fs = require('fs');
                const path = require('path');
                const settingsFile = path.join(process.cwd(), '.ai-settings', 'config.json');
                
                if (fs.existsSync(settingsFile)) {
                    const fileContent = fs.readFileSync(settingsFile, 'utf8');
                    storedData = JSON.parse(fileContent);
                }
            }
            
            if (storedData) {
                // Decrypt sensitive data
                const decryptedSettings = this.decryptSensitiveData(storedData);
                console.log('AI provider settings loaded successfully');
                return decryptedSettings;
            } else {
                console.log('No stored settings found, using defaults');
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
            mode: 'offline',
            offline: {
                model: 'llama2',
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

        // Validate offline settings
        if (settings.offline) {
            if (!settings.offline.model || typeof settings.offline.model !== 'string') {
                errors.push('Offline model must be a non-empty string');
            }
            if (settings.offline.endpoint && typeof settings.offline.endpoint !== 'string') {
                errors.push('Offline endpoint must be a string');
            }
        }

        // Validate online settings
        if (settings.online) {
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
     * Encrypt sensitive data in settings
     * @param {Object} settings - Settings to encrypt
     * @returns {Object} - Settings with encrypted sensitive data
     */
    encryptSensitiveData(settings) {
        const encrypted = JSON.parse(JSON.stringify(settings)); // Deep clone
        
        // Encrypt API key if present
        if (encrypted.online && encrypted.online.apiKey) {
            encrypted.online.apiKey = this.encrypt(encrypted.online.apiKey);
        }
        
        // Mark as encrypted
        encrypted._encrypted = true;
        encrypted._encryptedAt = new Date().toISOString();
        
        return encrypted;
    }

    /**
     * Decrypt sensitive data in settings
     * @param {Object} encryptedSettings - Settings with encrypted data
     * @returns {Object} - Settings with decrypted sensitive data
     */
    decryptSensitiveData(encryptedSettings) {
        if (!encryptedSettings._encrypted) {
            // Not encrypted, return as-is
            return encryptedSettings;
        }
        
        const decrypted = JSON.parse(JSON.stringify(encryptedSettings)); // Deep clone
        
        // Decrypt API key if present
        if (decrypted.online && decrypted.online.apiKey) {
            try {
                decrypted.online.apiKey = this.decrypt(decrypted.online.apiKey);
            } catch (error) {
                console.warn('Failed to decrypt API key, clearing it');
                decrypted.online.apiKey = '';
            }
        }
        
        // Remove encryption metadata
        delete decrypted._encrypted;
        delete decrypted._encryptedAt;
        
        return decrypted;
    }

    /**
     * Encrypt a string
     * @param {string} text - Text to encrypt
     * @returns {string} - Encrypted text (base64 encoded)
     */
    encrypt(text) {
        if (!text) return '';
        
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipherGCM(this.algorithm, Buffer.from(this.encryptionKey, 'hex'), iv);
            cipher.setAAD(Buffer.from('ai-settings'));
            
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag();
            
            // Combine iv, authTag, and encrypted data
            const combined = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
            return Buffer.from(combined).toString('base64');
        } catch (error) {
            console.error('Encryption error:', error);
            return text; // Return original text if encryption fails
        }
    }

    /**
     * Decrypt a string
     * @param {string} encryptedText - Encrypted text (base64 encoded)
     * @returns {string} - Decrypted text
     */
    decrypt(encryptedText) {
        if (!encryptedText) return '';
        
        try {
            const combined = Buffer.from(encryptedText, 'base64').toString();
            const parts = combined.split(':');
            
            if (parts.length !== 3) {
                throw new Error('Invalid encrypted data format');
            }
            
            const iv = Buffer.from(parts[0], 'hex');
            const authTag = Buffer.from(parts[1], 'hex');
            const encrypted = parts[2];
            
            const decipher = crypto.createDecipherGCM(this.algorithm, Buffer.from(this.encryptionKey, 'hex'), iv);
            decipher.setAAD(Buffer.from('ai-settings'));
            decipher.setAuthTag(authTag);
            
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Failed to decrypt data');
        }
    }

    /**
     * Get or create encryption key
     * @returns {string} - Encryption key
     */
    getOrCreateEncryptionKey() {
        const keyStorageKey = 'ai-settings-key';
        
        try {
            let key = null;
            
            if (typeof window !== 'undefined' && window.localStorage) {
                key = localStorage.getItem(keyStorageKey);
            } else {
                // For Node.js environment
                const fs = require('fs');
                const path = require('path');
                const keyFile = path.join(process.cwd(), '.ai-settings', 'key');
                
                if (fs.existsSync(keyFile)) {
                    key = fs.readFileSync(keyFile, 'utf8');
                }
            }
            
            if (!key) {
                // Generate new key
                key = crypto.randomBytes(32).toString('hex');
                
                // Store the key
                if (typeof window !== 'undefined' && window.localStorage) {
                    localStorage.setItem(keyStorageKey, key);
                } else {
                    const fs = require('fs');
                    const path = require('path');
                    const settingsDir = path.join(process.cwd(), '.ai-settings');
                    
                    if (!fs.existsSync(settingsDir)) {
                        fs.mkdirSync(settingsDir, { recursive: true });
                    }
                    
                    const keyFile = path.join(settingsDir, 'key');
                    fs.writeFileSync(keyFile, key);
                }
            }
            
            return key;
        } catch (error) {
            console.error('Error managing encryption key:', error);
            // Fallback to a default key (not secure, but prevents crashes)
            return 'default-fallback-key-not-secure';
        }
    }

    /**
     * Clear all stored settings
     */
    clearSettings() {
        try {
            console.log('Clearing AI provider settings...');
            
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.removeItem(this.storageKey);
                localStorage.removeItem('ai-settings-key');
            } else {
                const fs = require('fs');
                const path = require('path');
                const settingsDir = path.join(process.cwd(), '.ai-settings');
                
                if (fs.existsSync(settingsDir)) {
                    const files = fs.readdirSync(settingsDir);
                    files.forEach(file => {
                        fs.unlinkSync(path.join(settingsDir, file));
                    });
                    fs.rmdirSync(settingsDir);
                }
            }
            
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