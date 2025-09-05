/**
 * Anthropic Claude AI Provider
 * Handles communication with Anthropic's Claude API
 */
const AIProvider = require('../aiProvider');
const axios = require('axios');

class AnthropicProvider extends AIProvider {
    constructor(config = {}) {
        super(config);
        this.apiKey = config.apiKey;
        this.model = config.model || 'claude-3-5-haiku-latest';
        this.endpoint = config.endpoint || 'https://api.anthropic.com/v1';
        this.timeout = config.timeout || 60000; // 1 minute default
        
        if (!this.apiKey) {
            throw new Error('Anthropic API key is required');
        }
    }

    /**
     * Generate a distillation using Anthropic Claude
     * @param {string} text - The text to distill
     * @param {Object} options - Distillation options
     * @returns {Promise<string>} - The generated distillation
     */
    async generateSummary(text, options = {}) {
        try {
            const processedText = this.preprocessText(text);
            const prompt = this.createDistillationPrompt(processedText, options);

            console.log(`Sending request to Anthropic with ${processedText.length} characters`);
            console.log(`Using model: ${this.model}`);

            const requestData = {
                model: this.model,
                max_tokens: options.max_tokens || 1000,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: options.temperature || 0.7,
                top_p: options.top_p || 1.0
            };

            const startTime = Date.now();
            console.log(`Anthropic request started at: ${new Date().toISOString()}`);

            const response = await axios.post(`${this.endpoint}/messages`, requestData, {
                timeout: this.timeout,
                headers: {
                    'x-api-key': this.apiKey,
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                }
            });

            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;

            if (response.data && response.data.content && response.data.content[0]) {
                const rawDistillation = response.data.content[0].text.trim();
                console.log(`Anthropic response received in ${duration.toFixed(2)}s`);
                console.log(`Distillation length: ${rawDistillation.length} characters`);
                console.log(`Input tokens: ${response.data.usage?.input_tokens || 'unknown'}`);
                console.log(`Output tokens: ${response.data.usage?.output_tokens || 'unknown'}`);
                
                // Apply post-processing to fix numbering and other issues
                const processedDistillation = this.postProcessDistillation(rawDistillation);
                return processedDistillation;
            } else {
                throw new Error('Invalid response format from Anthropic');
            }

        } catch (error) {
            console.error('Error generating distillation with Anthropic:', error);
            
            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;
                
                if (status === 401) {
                    throw new Error('Invalid Anthropic API key. Please check your API key.');
                } else if (status === 429) {
                    throw new Error('Anthropic API rate limit exceeded. Please wait before making more requests.');
                } else if (status === 400) {
                    throw new Error(`Anthropic API error: ${data.error?.message || 'Bad request'}`);
                } else {
                    throw new Error(`Anthropic API error (${status}): ${data.error?.message || error.message}`);
                }
            }

            throw new Error(`Anthropic error: ${error.message}`);
        }
    }

    /**
     * Validate Anthropic configuration
     * @returns {Promise<{valid: boolean, error?: string}>} - Validation result
     */
    async validateConfiguration() {
        try {
            // Basic API key format validation
            if (!this.apiKey || !this.apiKey.startsWith('sk-ant-')) {
                return {
                    valid: false,
                    error: 'Invalid Anthropic API key format. API key should start with "sk-ant-"'
                };
            }

            // Test API key with a simple request
            const response = await axios.post(`${this.endpoint}/messages`, {
                model: this.model,
                max_tokens: 10,
                messages: [
                    {
                        role: 'user',
                        content: 'Hello'
                    }
                ]
            }, {
                timeout: 10000,
                headers: {
                    'x-api-key': this.apiKey,
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                }
            });

            if (response.data && response.data.content) {
                return { valid: true };
            } else {
                return {
                    valid: false,
                    error: 'Invalid response from Anthropic API'
                };
            }

        } catch (error) {
            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;
                
                if (status === 401) {
                    return {
                        valid: false,
                        error: 'Invalid Anthropic API key'
                    };
                } else if (status === 429) {
                    return {
                        valid: false,
                        error: 'Anthropic API rate limit exceeded'
                    };
                } else if (status === 400 && data.error?.type === 'invalid_request_error') {
                    if (data.error.message.includes('model')) {
                        return {
                            valid: false,
                            error: `Model "${this.model}" is not available`
                        };
                    }
                }
            }

            return {
                valid: false,
                error: `Anthropic validation failed: ${error.message}`
            };
        }
    }

    /**
     * Get required configuration fields
     * @returns {Object} - Configuration schema
     */
    getRequiredConfig() {
        return {
            apiKey: {
                type: 'string',
                required: true,
                sensitive: true,
                description: 'Anthropic API key (starts with sk-ant-)'
            },
            model: {
                type: 'string',
                required: false,
                default: 'claude-3-5-haiku-latest',
                description: 'Claude model to use'
            }
        };
    }

    /**
     * Get available models from Anthropic
     * @returns {Array<string>} - List of available model names
     */
    getAvailableModels() {
        return [
            'claude-opus-4-20250514',
            'claude-sonnet-4-20250514',
            'claude-3-7-sonnet-latest',
            'claude-3-5-haiku-latest'
        ];
    }

    /**
     * Get display name for this provider
     * @returns {string} - Human-readable provider name
     */
    getDisplayName() {
        return 'Anthropic Claude';
    }

    /**
     * Get maximum input length for Anthropic
     * @returns {number} - Maximum input length in characters
     */
    getMaxInputLength() {
        // Claude models have different context windows
        if (this.model.includes('claude-3')) {
            return 150000; // ~200k tokens, leaving room for output
        }
        return 75000; // Conservative estimate for older models
    }

    /**
     * Test connection to Anthropic with a simple request
     * @returns {Promise<{success: boolean, error?: string, latency?: number}>} - Test result
     */
    async testConnection() {
        const startTime = Date.now();
        
        try {
            const response = await axios.post(`${this.endpoint}/messages`, {
                model: this.model,
                max_tokens: 20,
                messages: [
                    {
                        role: 'user',
                        content: 'Please respond with "Claude connection test successful" to confirm the connection.'
                    }
                ]
            }, {
                timeout: 30000,
                headers: {
                    'x-api-key': this.apiKey,
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                }
            });

            const latency = Date.now() - startTime;

            if (response.data && response.data.content && response.data.content[0]) {
                return {
                    success: true,
                    latency: latency,
                    response: response.data.content[0].text.trim(),
                    inputTokens: response.data.usage?.input_tokens,
                    outputTokens: response.data.usage?.output_tokens
                };
            } else {
                return {
                    success: false,
                    error: 'Invalid response format from Anthropic'
                };
            }

        } catch (error) {
            return {
                success: false,
                error: this.formatError(error),
                latency: Date.now() - startTime
            };
        }
    }
}

module.exports = AnthropicProvider;