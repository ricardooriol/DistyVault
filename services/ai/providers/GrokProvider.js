/**
 * Grok AI Provider
 * Handles communication with xAI's Grok API
 */
const AIProvider = require('../AIProvider');
const axios = require('axios');

class GrokProvider extends AIProvider {
    constructor(config = {}) {
        super(config);
        this.apiKey = config.apiKey;
        this.model = config.model || 'grok-1';
        this.endpoint = config.endpoint || 'https://api.x.ai/v1';
        this.timeout = config.timeout || 60000; // 1 minute default
        
        if (!this.apiKey) {
            throw new Error('Grok API key is required');
        }
    }

    /**
     * Generate a summary using Grok
     * @param {string} text - The text to summarize
     * @param {Object} options - Summarization options
     * @returns {Promise<string>} - The generated summary
     */
    async generateSummary(text, options = {}) {
        try {
            const processedText = this.preprocessText(text);
            const prompt = this.createSummarizationPrompt(processedText, options);

            console.log(`Sending request to Grok with ${processedText.length} characters`);
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
            console.log(`Grok request started at: ${new Date().toISOString()}`);

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
                console.log(`Grok response received in ${duration.toFixed(2)}s`);
                console.log(`Summary length: ${summary.length} characters`);
                console.log(`Tokens used: ${response.data.usage?.total_tokens || 'unknown'}`);
                return summary;
            } else {
                throw new Error('Invalid response format from Grok');
            }

        } catch (error) {
            console.error('Error generating summary with Grok:', error);
            
            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;
                
                if (status === 401) {
                    throw new Error('Invalid Grok API key. Please check your API key.');
                } else if (status === 429) {
                    throw new Error('Grok API rate limit exceeded. Please wait before making more requests.');
                } else if (status === 400) {
                    throw new Error(`Grok API error: ${data.error?.message || 'Bad request'}`);
                } else {
                    throw new Error(`Grok API error (${status}): ${data.error?.message || error.message}`);
                }
            }

            throw new Error(`Grok error: ${error.message}`);
        }
    }

    /**
     * Validate Grok configuration
     * @returns {Promise<{valid: boolean, error?: string}>} - Validation result
     */
    async validateConfiguration() {
        try {
            // Basic API key format validation
            if (!this.apiKey || !this.apiKey.startsWith('xai-')) {
                return {
                    valid: false,
                    error: 'Invalid Grok API key format. API key should start with "xai-"'
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
                    error: 'Invalid response from Grok API'
                };
            }

        } catch (error) {
            if (error.response) {
                const status = error.response.status;
                if (status === 401) {
                    return {
                        valid: false,
                        error: 'Invalid Grok API key'
                    };
                } else if (status === 429) {
                    return {
                        valid: false,
                        error: 'Grok API rate limit exceeded'
                    };
                }
            }

            return {
                valid: false,
                error: `Grok validation failed: ${error.message}`
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
                description: 'Grok API key (starts with xai-)'
            },
            model: {
                type: 'string',
                required: false,
                default: 'grok-1',
                description: 'Grok model to use'
            }
        };
    }

    /**
     * Get available models from Grok
     * @returns {Array<string>} - List of available model names
     */
    getAvailableModels() {
        return [
            'grok-1',
            'grok-1.5'
        ];
    }

    /**
     * Get display name for this provider
     * @returns {string} - Human-readable provider name
     */
    getDisplayName() {
        return 'Grok';
    }

    /**
     * Get maximum input length for Grok
     * @returns {number} - Maximum input length in characters
     */
    getMaxInputLength() {
        // Grok has a large context window
        return 100000; // ~25k tokens, conservative estimate
    }

    /**
     * Create Grok-specific summarization prompt
     * @param {string} text - The text to summarize
     * @param {Object} options - Summarization options
     * @returns {string} - The formatted prompt
     */
    createSummarizationPrompt(text, options = {}) {
        const maxLength = options.maxLength || 500;
        const style = options.style || 'concise';
        
        let prompt = `Please provide a ${style} summary of the following content. `;
        prompt += `The summary should be approximately ${maxLength} words or less and should capture the main points and key insights.\n\n`;
        prompt += `Content:\n${text}\n\n`;
        prompt += `Summary:`;
        
        return prompt;
    }

    /**
     * Test connection to Grok with a simple request
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
                        content: 'Please respond with "Grok connection test successful" to confirm the connection.'
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
                    error: 'Invalid response format from Grok'
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

module.exports = GrokProvider;