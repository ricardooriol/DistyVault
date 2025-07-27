/**
 * OpenAI AI Provider
 * Handles communication with OpenAI's API
 */
const AIProvider = require('../AIProvider');
const axios = require('axios');

class OpenAIProvider extends AIProvider {
    constructor(config = {}) {
        super(config);
        this.apiKey = config.apiKey;
        this.model = config.model || 'gpt-4o';
        this.endpoint = config.endpoint || 'https://api.openai.com/v1';
        this.timeout = config.timeout || 60000; // 1 minute default
        
        if (!this.apiKey) {
            throw new Error('OpenAI API key is required');
        }
    }

    /**
     * Generate a distillation using OpenAI
     * @param {string} text - The text to distill
     * @param {Object} options - Distillation options
     * @returns {Promise<string>} - The generated distillation
     */
    async generateSummary(text, options = {}) {
        try {
            const processedText = this.preprocessText(text);
            const prompt = this.createDistillationPrompt(processedText, options);

            console.log(`Sending request to OpenAI with ${processedText.length} characters`);
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
            console.log(`OpenAI request started at: ${new Date().toISOString()}`);

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
                const rawDistillation = response.data.choices[0].message.content.trim();
                console.log(`OpenAI response received in ${duration.toFixed(2)}s`);
                console.log(`Distillation length: ${rawDistillation.length} characters`);
                console.log(`Tokens used: ${response.data.usage?.total_tokens || 'unknown'}`);
                
                // Apply post-processing to fix numbering and other issues
                const processedDistillation = this.postProcessDistillation(rawDistillation);
                return processedDistillation;
            } else {
                throw new Error('Invalid response format from OpenAI');
            }

        } catch (error) {
            console.error('Error generating distillation with OpenAI:', error);
            
            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;
                
                if (status === 401) {
                    throw new Error('Invalid OpenAI API key. Please check your API key.');
                } else if (status === 429) {
                    throw new Error('OpenAI API rate limit exceeded. Please wait before making more requests.');
                } else if (status === 400) {
                    throw new Error(`OpenAI API error: ${data.error?.message || 'Bad request'}`);
                } else {
                    throw new Error(`OpenAI API error (${status}): ${data.error?.message || error.message}`);
                }
            }

            throw new Error(`OpenAI error: ${error.message}`);
        }
    }

    /**
     * Validate OpenAI configuration
     * @returns {Promise<{valid: boolean, error?: string}>} - Validation result
     */
    async validateConfiguration() {
        try {
            // Basic API key format validation
            if (!this.apiKey || !this.apiKey.startsWith('sk-')) {
                return {
                    valid: false,
                    error: 'Invalid OpenAI API key format. API key should start with "sk-"'
                };
            }

            // Test API key with a simple request
            const response = await axios.get(`${this.endpoint}/models`, {
                timeout: 10000,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            if (response.data && response.data.data) {
                // Check if the specified model is available
                const availableModels = response.data.data.map(model => model.id);
                if (!availableModels.includes(this.model)) {
                    return {
                        valid: false,
                        error: `Model "${this.model}" is not available. Available models: ${availableModels.slice(0, 5).join(', ')}...`
                    };
                }

                return { valid: true };
            } else {
                return {
                    valid: false,
                    error: 'Invalid response from OpenAI API'
                };
            }

        } catch (error) {
            if (error.response) {
                const status = error.response.status;
                if (status === 401) {
                    return {
                        valid: false,
                        error: 'Invalid OpenAI API key'
                    };
                } else if (status === 429) {
                    return {
                        valid: false,
                        error: 'OpenAI API rate limit exceeded'
                    };
                }
            }

            return {
                valid: false,
                error: `OpenAI validation failed: ${error.message}`
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
                description: 'OpenAI API key (starts with sk-)'
            },
            model: {
                type: 'string',
                required: false,
                default: 'gpt-4o',
                description: 'OpenAI model to use'
            }
        };
    }

    /**
     * Get available models from OpenAI
     * @returns {Array<string>} - List of available model names
     */
    getAvailableModels() {
        return [
            'o3-mini',
            'o4-mini',
            'gpt-4o',
            'gpt-4.1'
        ];
    }

    /**
     * Get display name for this provider
     * @returns {string} - Human-readable provider name
     */
    getDisplayName() {
        return 'OpenAI';
    }

    /**
     * Get maximum input length for OpenAI
     * @returns {number} - Maximum input length in characters
     */
    getMaxInputLength() {
        // GPT-3.5-turbo: ~4k tokens, GPT-4: ~8k tokens
        // Rough estimate: 1 token ≈ 4 characters
        if (this.model.includes('gpt-4')) {
            return 25000; // ~6k tokens for input, leaving room for output
        }
        return 12000; // ~3k tokens for input, leaving room for output
    }


    /**
     * Test connection to OpenAI with a simple request
     * @returns {Promise<{success: boolean, error?: string, latency?: number}>} - Test result
     */
    async testConnection() {
        const startTime = Date.now();
        
        try {
            // Test with a simple chat completion
            const response = await axios.post(`${this.endpoint}/chat/completions`, {
                model: this.model,
                messages: [
                    {
                        role: 'user',
                        content: 'Please respond with "OpenAI connection test successful" to confirm the connection.'
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
                    error: 'Invalid response format from OpenAI'
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

module.exports = OpenAIProvider;