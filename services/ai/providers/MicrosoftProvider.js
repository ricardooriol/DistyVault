/**
 * Microsoft Copilot AI Provider
 * Handles communication with Microsoft's Azure OpenAI Service
 */
const AIProvider = require('../AIProvider');
const axios = require('axios');

class MicrosoftProvider extends AIProvider {
    constructor(config = {}) {
        super(config);
        this.apiKey = config.apiKey;
        this.model = config.model || 'gpt-4';
        this.endpoint = config.endpoint || 'https://api.cognitive.microsoft.com';
        this.timeout = config.timeout || 60000; // 1 minute default
        
        if (!this.apiKey) {
            throw new Error('Microsoft API key is required');
        }
    }

    /**
     * Generate a summary using Microsoft Copilot
     * @param {string} text - The text to summarize
     * @param {Object} options - Summarization options
     * @returns {Promise<string>} - The generated summary
     */
    async generateSummary(text, options = {}) {
        try {
            const processedText = this.preprocessText(text);
            const prompt = this.createSummarizationPrompt(processedText, options);

            console.log(`Sending request to Microsoft Copilot with ${processedText.length} characters`);
            console.log(`Using model: ${this.model}`);

            const requestData = {
                model: this.model,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: options.max_tokens || 1000,
                temperature: options.temperature || 0.7,
                top_p: options.top_p || 1.0
            };

            const startTime = Date.now();
            console.log(`Microsoft request started at: ${new Date().toISOString()}`);

            const response = await axios.post(`${this.endpoint}/openai/deployments/${this.model}/chat/completions?api-version=2023-12-01-preview`, requestData, {
                timeout: this.timeout,
                headers: {
                    'api-key': this.apiKey,
                    'Content-Type': 'application/json'
                }
            });

            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;

            if (response.data && response.data.choices && response.data.choices[0]) {
                const summary = response.data.choices[0].message.content.trim();
                console.log(`Microsoft response received in ${duration.toFixed(2)}s`);
                console.log(`Summary length: ${summary.length} characters`);
                console.log(`Tokens used: ${response.data.usage?.total_tokens || 'unknown'}`);
                return summary;
            } else {
                throw new Error('Invalid response format from Microsoft');
            }

        } catch (error) {
            console.error('Error generating summary with Microsoft:', error);
            
            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;
                
                if (status === 401) {
                    throw new Error('Invalid Microsoft API key. Please check your API key.');
                } else if (status === 429) {
                    throw new Error('Microsoft API rate limit exceeded. Please wait before making more requests.');
                } else if (status === 400) {
                    throw new Error(`Microsoft API error: ${data.error?.message || 'Bad request'}`);
                } else {
                    throw new Error(`Microsoft API error (${status}): ${data.error?.message || error.message}`);
                }
            }

            throw new Error(`Microsoft error: ${error.message}`);
        }
    }

    /**
     * Validate Microsoft configuration
     * @returns {Promise<{valid: boolean, error?: string}>} - Validation result
     */
    async validateConfiguration() {
        try {
            // Basic API key format validation
            if (!this.apiKey || this.apiKey.length < 20) {
                return {
                    valid: false,
                    error: 'Invalid Microsoft API key format'
                };
            }

            // Test API key with a simple request
            const response = await axios.post(`${this.endpoint}/openai/deployments/${this.model}/chat/completions?api-version=2023-12-01-preview`, {
                messages: [
                    {
                        role: 'user',
                        content: 'Hello'
                    }
                ],
                max_tokens: 10
            }, {
                timeout: 10000,
                headers: {
                    'api-key': this.apiKey,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data && response.data.choices) {
                return { valid: true };
            } else {
                return {
                    valid: false,
                    error: 'Invalid response from Microsoft API'
                };
            }

        } catch (error) {
            if (error.response) {
                const status = error.response.status;
                if (status === 401) {
                    return {
                        valid: false,
                        error: 'Invalid Microsoft API key'
                    };
                } else if (status === 429) {
                    return {
                        valid: false,
                        error: 'Microsoft API rate limit exceeded'
                    };
                } else if (status === 404) {
                    return {
                        valid: false,
                        error: `Model deployment "${this.model}" not found`
                    };
                }
            }

            return {
                valid: false,
                error: `Microsoft validation failed: ${error.message}`
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
                description: 'Microsoft Azure OpenAI API key'
            },
            model: {
                type: 'string',
                required: false,
                default: 'gpt-4',
                description: 'Azure OpenAI model deployment name'
            }
        };
    }

    /**
     * Get available models from Microsoft
     * @returns {Array<string>} - List of available model names
     */
    getAvailableModels() {
        return [
            'gpt-4',
            'gpt-4-turbo',
            'gpt-3.5-turbo',
            'gpt-3.5-turbo-16k'
        ];
    }

    /**
     * Get display name for this provider
     * @returns {string} - Human-readable provider name
     */
    getDisplayName() {
        return 'Microsoft Copilot';
    }

    /**
     * Get maximum input length for Microsoft
     * @returns {number} - Maximum input length in characters
     */
    getMaxInputLength() {
        // Similar to OpenAI limits
        if (this.model.includes('gpt-4')) {
            return 25000; // ~6k tokens for input
        }
        return 12000; // ~3k tokens for input
    }

    /**
     * Create Microsoft-specific summarization prompt
     * @param {string} text - The text to summarize
     * @param {Object} options - Summarization options
     * @returns {string} - The formatted prompt
     */
    createSummarizationPrompt(text, options = {}) {
        const maxLength = options.maxLength || 500;
        const style = options.style || 'concise';
        
        let prompt = `Please provide a ${style} summary of the following content. `;
        prompt += `The summary should be approximately ${maxLength} words or less and capture the main points and key information.\n\n`;
        prompt += `Content:\n${text}\n\n`;
        prompt += `Summary:`;
        
        return prompt;
    }

    /**
     * Test connection to Microsoft with a simple request
     * @returns {Promise<{success: boolean, error?: string, latency?: number}>} - Test result
     */
    async testConnection() {
        const startTime = Date.now();
        
        try {
            const response = await axios.post(`${this.endpoint}/openai/deployments/${this.model}/chat/completions?api-version=2023-12-01-preview`, {
                messages: [
                    {
                        role: 'user',
                        content: 'Please respond with "Microsoft connection test successful" to confirm the connection.'
                    }
                ],
                max_tokens: 20
            }, {
                timeout: 30000,
                headers: {
                    'api-key': this.apiKey,
                    'Content-Type': 'application/json'
                }
            });

            const latency = Date.now() - startTime;

            if (response.data && response.data.choices && response.data.choices[0]) {
                return {
                    success: true,
                    latency: latency,
                    response: response.data.choices[0].message.content.trim(),
                    tokensUsed: response.data.usage?.total_tokens
                };
            } else {
                return {
                    success: false,
                    error: 'Invalid response format from Microsoft'
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

module.exports = MicrosoftProvider;