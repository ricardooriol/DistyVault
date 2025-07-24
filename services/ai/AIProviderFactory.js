/**
 * Factory class for creating AI provider instances
 * Handles the instantiation of different AI providers based on configuration
 */
const OllamaProvider = require('./providers/OllamaProvider');
const OpenAIProvider = require('./providers/OpenAIProvider');
const AnthropicProvider = require('./providers/AnthropicProvider');
const GoogleProvider = require('./providers/GoogleProvider');
const MicrosoftProvider = require('./providers/MicrosoftProvider');
const GrokProvider = require('./providers/GrokProvider');
const DeepseekProvider = require('./providers/DeepseekProvider');

class AIProviderFactory {
    /**
     * Create an AI provider instance based on configuration
     * @param {Object} config - Provider configuration
     * @param {string} config.type - Provider type (ollama, openai, anthropic, etc.)
     * @param {string} config.apiKey - API key for cloud providers
     * @param {string} config.model - Model name to use
     * @param {string} config.endpoint - Custom endpoint (optional)
     * @returns {AIProvider} - Configured AI provider instance
     */
    static createProvider(config) {
        if (!config || !config.type) {
            throw new Error('Provider configuration is required');
        }

        const { type, apiKey, model, endpoint, ...otherOptions } = config;

        switch (type.toLowerCase()) {
            case 'ollama':
                return new OllamaProvider({
                    model: model,
                    endpoint: endpoint || 'http://localhost:11434',
                    ...otherOptions
                });

            case 'openai':
                if (!apiKey) {
                    throw new Error('API key is required for OpenAI provider');
                }
                return new OpenAIProvider({
                    apiKey,
                    model: model || 'gpt-3.5-turbo',
                    endpoint: endpoint || 'https://api.openai.com/v1',
                    ...otherOptions
                });

            case 'anthropic':
                if (!apiKey) {
                    throw new Error('API key is required for Anthropic provider');
                }
                return new AnthropicProvider({
                    apiKey,
                    model: model || 'claude-3-haiku-20240307',
                    endpoint: endpoint || 'https://api.anthropic.com/v1',
                    ...otherOptions
                });

            case 'google':
                if (!apiKey) {
                    throw new Error('API key is required for Google provider');
                }
                return new GoogleProvider({
                    apiKey,
                    model: model || 'gemini-2.5-flash',
                    ...otherOptions
                });

            case 'microsoft':
                if (!apiKey) {
                    throw new Error('API key is required for Microsoft provider');
                }
                return new MicrosoftProvider({
                    apiKey,
                    model: model || 'gpt-4',
                    endpoint: endpoint || 'https://api.cognitive.microsoft.com',
                    ...otherOptions
                });

            case 'grok':
                if (!apiKey) {
                    throw new Error('API key is required for Grok provider');
                }
                return new GrokProvider({
                    apiKey,
                    model: model || 'grok-1',
                    endpoint: endpoint || 'https://api.x.ai/v1',
                    ...otherOptions
                });

            case 'deepseek':
                if (!apiKey) {
                    throw new Error('API key is required for Deepseek provider');
                }
                return new DeepseekProvider({
                    apiKey,
                    model: model || 'deepseek-chat',
                    endpoint: endpoint || 'https://api.deepseek.com/v1',
                    ...otherOptions
                });

            default:
                throw new Error(`Unknown provider type: ${type}`);
        }
    }

    /**
     * Get a list of all supported provider types
     * @returns {Array<Object>} - List of provider information
     */
    static getSupportedProviders() {
        return [
            {
                type: 'ollama',
                name: 'Ollama (Local)',
                category: 'offline',
                requiresApiKey: false,
                defaultModel: null,
                models: []
            },
            {
                type: 'openai',
                name: 'OpenAI',
                category: 'online',
                requiresApiKey: true,
                defaultModel: 'gpt-3.5-turbo',
                models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o']
            },
            {
                type: 'anthropic',
                name: 'Anthropic Claude',
                category: 'online',
                requiresApiKey: true,
                defaultModel: 'claude-3-haiku-20240307',
                models: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229']
            },
            {
                type: 'google',
                name: 'Google Gemini',
                category: 'online',
                requiresApiKey: true,
                defaultModel: 'gemini-2.5-flash',
                models: ['gemini-2.5-flash']
            },
            {
                type: 'microsoft',
                name: 'Microsoft Copilot',
                category: 'online',
                requiresApiKey: true,
                defaultModel: 'gpt-4',
                models: ['gpt-4', 'gpt-3.5-turbo']
            },
            {
                type: 'grok',
                name: 'Grok',
                category: 'online',
                requiresApiKey: true,
                defaultModel: 'grok-1',
                models: ['grok-1', 'grok-1.5']
            },
            {
                type: 'deepseek',
                name: 'Deepseek',
                category: 'online',
                requiresApiKey: true,
                defaultModel: 'deepseek-chat',
                models: ['deepseek-chat', 'deepseek-coder']
            }
        ];
    }

    /**
     * Get provider information by type
     * @param {string} type - Provider type
     * @returns {Object|null} - Provider information or null if not found
     */
    static getProviderInfo(type) {
        return this.getSupportedProviders().find(provider => provider.type === type) || null;
    }

    /**
     * Validate provider configuration
     * @param {Object} config - Provider configuration
     * @returns {{valid: boolean, errors: Array<string>}} - Validation result
     */
    static validateConfig(config) {
        const errors = [];

        if (!config) {
            errors.push('Configuration is required');
            return { valid: false, errors };
        }

        if (!config.type) {
            errors.push('Provider type is required');
        } else {
            const providerInfo = this.getProviderInfo(config.type);
            if (!providerInfo) {
                errors.push(`Unknown provider type: ${config.type}`);
            } else {
                // Check API key requirement
                if (providerInfo.requiresApiKey && !config.apiKey) {
                    errors.push(`API key is required for ${providerInfo.name}`);
                }

                // Validate API key format (basic validation)
                if (config.apiKey && config.type === 'openai' && !config.apiKey.startsWith('sk-')) {
                    errors.push('OpenAI API key should start with "sk-"');
                }

                if (config.apiKey && config.type === 'anthropic' && !config.apiKey.startsWith('sk-ant-')) {
                    errors.push('Anthropic API key should start with "sk-ant-"');
                }

                if (config.apiKey && config.type === 'grok' && !config.apiKey.startsWith('xai-')) {
                    errors.push('Grok API key should start with "xai-"');
                }

                // Validate model (skip for Ollama since it validates against actual installation)
                if (config.model && providerInfo.models && providerInfo.models.length > 0 && !providerInfo.models.includes(config.model)) {
                    errors.push(`Model "${config.model}" is not supported by ${providerInfo.name}`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

module.exports = AIProviderFactory;