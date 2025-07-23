/**
 * Deepseek AI Provider
 * Handles communication with Deepseek's API
 */
const AIProvider = require('../AIProvider');
const axios = require('axios');

class DeepseekProvider extends AIProvider {
    constructor(config = {}) {
        super(config);
        this.apiKey = config.apiKey;
        this.model = config.model || 'deepseek-chat';
        this.endpoint = config.endpoint || 'https://api.deepseek.com/v1';
        this.timeout = config.timeout || 60000; // 1 minute default
        
        if (!this.apiKey) {
            throw new Error('Deepseek API key is required');
        }
    }

    /**
     * Generate a summary using Deepseek
     * @param {string} text - The text to summarize
     * @param {Object} options - Summarization options
     * @returns {Promise<string>} - The generated summary
     */
    async generateSummary(text, options = {}) {
        try {
            const processedText = this.preprocessText(text);
            const prompt = this.createSummarizationPrompt(processedText, options);

            console.log(`Sending request to Deepseek with ${processedText.length} characters`);
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
            console.log(`Deepseek request started at: ${new Date().toISOString()}`);

            const response = await axios.post(`${this.endpoint}/chat/completions`, requestData, {
                timeout: this.timeout,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;

            if (response.data && response.data.choices && response.data.choices[0]) {
                const summary = response.data.choices[0].message.content.trim();
                console.log(`Deepseek response received in ${duration.toFixed(2)}s`);
                console.log(`Summary length: ${summary.length} characters`);
                console.log(`Tokens used: ${response.data.usage?.total_tokens || 'unknown'}`);
                return summary;
            } else {
                throw new Error('Invalid response format from Deepseek');
            }

        } catch (error) {
            console.error('Error generating summary with Deepseek:', error);
            
            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;
                
                if (status === 401) {
                    throw new Error('Invalid Deepseek API key. Please check your API key.');
                } else if (status === 429) {
                    throw new Error('Deepseek API rate limit exceeded. Please wait before making more requests.');
                } else if (status === 400) {
                    throw new Error(`Deepseek API error: ${data.error?.message || 'Bad request'}`);
                } else {
                    throw new Error(`Deepseek API error (${status}): ${data.error?.message || error.message}`);
                }
            }

            throw new Error(`Deepseek error: ${error.message}`);
        }
    }

    /**
     * Validate Deepseek configuration
     * @returns {Promise<{valid: boolean, error?: string}>} - Validation result
     */
    async validateConfiguration() {
        try {
            // Basic API key format validation
            if (!this.apiKey || !this.apiKey.startsWith('sk-')) {
                return {
                    valid: false,
                    error: 'Invalid Deepseek API key format. API key should start with "sk-"'
                };
            }

            // Test API key with a simple request
            const response = await axios.post(`${this.endpoint}/chat/completions`, {
                model: this.model,
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
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data && response.data.choices) {
                return { valid: true };
            } else {
                return {
                    valid: false,
                    error: 'Invalid response from Deepseek API'
                };
            }

        } catch (error) {
            if (error.response) {
                const status = error.response.status;
                if (status === 401) {
                    return {
                        valid: false,
                        error: 'Invalid Deepseek API key'
                    };
                } else if (status === 429) {
                    return {
                        valid: false,
                        error: 'Deepseek API rate limit exceeded'
                    };
                }
            }

            return {
                valid: false,
                error: `Deepseek validation failed: ${error.message}`
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
                description: 'Deepseek API key (starts with sk-)'
            },
            model: {
                type: 'string',
                required: false,
                default: 'deepseek-chat',
                description: 'Deepseek model to use'
            }
        };
    }

    /**
     * Get available models from Deepseek
     * @returns {Array<string>} - List of available model names
     */
    getAvailableModels() {
        return [
            'deepseek-chat',
            'deepseek-coder'
        ];
    }

    /**
     * Get display name for this provider
     * @returns {string} - Human-readable provider name
     */
    getDisplayName() {
        return 'Deepseek';
    }

    /**
     * Get maximum input length for Deepseek
     * @returns {number} - Maximum input length in characters
     */
    getMaxInputLength() {
        // Deepseek has a reasonable context window
        return 60000; // ~15k tokens, conservative estimate
    }

    /**
     * Create Deepseek-specific summarization prompt
     * @param {string} text - The text to summarize
     * @param {Object} options - Summarization options
     * @returns {string} - The formatted prompt
     */
    createSummarizationPrompt(text, options = {}) {
        const maxLength = options.maxLength || 500;
        const style = options.style || 'concise';
        
        let prompt = `Please provide a ${style} summary of the following content. `;
        prompt += `The summary should be approximately ${maxLength} words or less and should highlight the main points and key information.\n\n`;
        prompt += `Content:\n${text}\n\n`;
        prompt += `Summary:`;
        
        return prompt;
    }

    /**
     * Test connection to Deepseek with a simple request
     * @returns {Promise<{success: boolean, error?: string, latency?: number}>} - Test result
     */
    async testConnection() {
        const startTime = Date.now();
        
        try {
            const response = await axios.post(`${this.endpoint}/chat/completions`, {
                model: this.model,
                messages: [
                    {
                        role: 'user',
                        content: 'Please respond with "Deepseek connection test successful" to confirm the connection.'
                    }
                ],
                max_tokens: 20
            }, {
                timeout: 30000,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
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
                    error: 'Invalid response format from Deepseek'
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

module.exports = DeepseekProvider;