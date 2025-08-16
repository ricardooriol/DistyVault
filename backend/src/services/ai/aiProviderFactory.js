/**
 * Factory class for creating AI provider instances
 * Handles the instantiation of different AI providers based on configuration
 */
const OllamaProvider = require('./providers/ollama');
const OpenAIProvider = require('./providers/openAI');
const AnthropicProvider = require('./providers/anthropic');
const GoogleProvider = require('./providers/google');

const GrokProvider = require('./providers/grok');
const DeepseekProvider = require('./providers/deepseek');

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
                    model: model || 'gpt-4o',
                    endpoint: endpoint || 'https://api.openai.com/v1',
                    ...otherOptions
                });

            case 'anthropic':
                if (!apiKey) {
                    throw new Error('API key is required for Anthropic provider');
                }
                return new AnthropicProvider({
                    apiKey,
                    model: model || 'claude-3-5-haiku-latest',
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

            case 'grok':
                if (!apiKey) {
                    throw new Error('API key is required for Grok provider');
                }
                return new GrokProvider({
                    apiKey,
                    model: model || 'grok-3',
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
                defaultModel: 'gpt-4o',
                models: ['o3-mini', 'o4-mini', 'gpt-4o', 'gpt-4.1']
            },
            {
                type: 'anthropic',
                name: 'Anthropic Claude',
                category: 'online',
                requiresApiKey: true,
                defaultModel: 'claude-3-5-haiku-latest',
                models: ['claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest']
            },
            {
                type: 'google',
                name: 'Google Gemini',
                category: 'online',
                requiresApiKey: true,
                defaultModel: 'gemini-2.5-flash',
                models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']
            },
            {
                type: 'grok',
                name: 'Grok',
                category: 'online',
                requiresApiKey: true,
                defaultModel: 'grok-3',
                models: ['grok-4-0709', 'grok-3', 'grok-3-mini', 'grok-3-fast']
            },
            {
                type: 'deepseek',
                name: 'Deepseek',
                category: 'online',
                requiresApiKey: true,
                defaultModel: 'deepseek-chat',
                models: ['deepseek-chat', 'deepseek-reasoner']
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