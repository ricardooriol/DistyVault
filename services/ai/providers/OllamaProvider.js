/**
 * Ollama AI Provider
 * Handles communication with local Ollama installation
 */
const AIProvider = require('../AIProvider');
const axios = require('axios');

class OllamaProvider extends AIProvider {
    constructor(config = {}) {
        super(config);
        this.model = config.model || 'llama2';
        this.endpoint = config.endpoint || 'http://localhost:11434';
        this.timeout = config.timeout || 300000; // 5 minutes default
    }

    /**
     * Generate a summary using Ollama
     * @param {string} text - The text to summarize
     * @param {Object} options - Summarization options
     * @returns {Promise<string>} - The generated summary
     */
    async generateSummary(text, options = {}) {
        try {
            const processedText = this.preprocessText(text);
            const prompt = this.createSummarizationPrompt(processedText, options);

            console.log(`Sending request to Ollama with ${processedText.length} characters`);
            console.log(`Using model: ${this.model}`);
            console.log(`Text preview: ${processedText.substring(0, 100)}...`);

            const requestData = {
                model: this.model,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: options.temperature || 0.7,
                    top_p: options.top_p || 0.9,
                    max_tokens: options.max_tokens || 1000
                }
            };

            const startTime = Date.now();
            console.log(`Ollama request started at: ${new Date().toISOString()}`);

            const response = await axios.post(`${this.endpoint}/api/generate`, requestData, {
                timeout: this.timeout,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;

            if (response.data && response.data.response) {
                const summary = response.data.response.trim();
                console.log(`Ollama response received in ${duration.toFixed(2)}s`);
                console.log(`Summary length: ${summary.length} characters`);
                return summary;
            } else {
                throw new Error('Invalid response format from Ollama');
            }

        } catch (error) {
            console.error('Error generating summary with Ollama:', error);
            
            if (error.code === 'ECONNREFUSED') {
                throw new Error('Cannot connect to Ollama. Please ensure Ollama is running on ' + this.endpoint);
            }
            
            if (error.code === 'ETIMEDOUT') {
                throw new Error('Ollama request timed out. The text might be too long or the model is slow.');
            }

            throw new Error(`Ollama error: ${error.message}`);
        }
    }

    /**
     * Validate Ollama configuration
     * @returns {Promise<{valid: boolean, error?: string}>} - Validation result
     */
    async validateConfiguration() {
        try {
            // Check if Ollama is running
            const response = await axios.get(`${this.endpoint}/api/tags`, {
                timeout: 5000
            });

            if (!response.data || !response.data.models) {
                return {
                    valid: false,
                    error: 'Invalid response from Ollama server'
                };
            }

            // Check if the specified model is available
            const availableModels = response.data.models.map(model => model.name);
            console.log(`Available Ollama models: ${availableModels.join(', ')}`);
            console.log(`Looking for model: ${this.model}`);
            
            // Check for exact match or partial match (handles :latest suffix)
            const modelExists = availableModels.some(model => {
                // Exact match
                if (model === this.model) return true;
                
                // Check if model matches without :latest suffix
                const modelBase = model.split(':')[0];
                const requestedBase = this.model.split(':')[0];
                if (modelBase === requestedBase) return true;
                
                // Check if requested model matches with :latest added
                if (model === `${this.model}:latest`) return true;
                
                return false;
            });
            
            if (!modelExists) {
                return {
                    valid: false,
                    error: `Model "${this.model}" is not available. Available models: ${availableModels.join(', ')}`
                };
            }
            
            console.log(`✅ Model "${this.model}" found in Ollama`);

            return { valid: true };

        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                return {
                    valid: false,
                    error: 'Cannot connect to Ollama. Please ensure Ollama is running.'
                };
            }

            return {
                valid: false,
                error: `Ollama validation failed: ${error.message}`
            };
        }
    }

    /**
     * Get required configuration fields
     * @returns {Object} - Configuration schema
     */
    getRequiredConfig() {
        return {
            model: {
                type: 'string',
                required: true,
                default: 'llama2',
                description: 'Ollama model name'
            },
            endpoint: {
                type: 'string',
                required: false,
                default: 'http://localhost:11434',
                description: 'Ollama server endpoint'
            }
        };
    }

    /**
     * Get available models from Ollama
     * @returns {Promise<Array<string>>} - List of available model names
     */
    async getAvailableModels() {
        try {
            const response = await axios.get(`${this.endpoint}/api/tags`, {
                timeout: 5000
            });

            if (response.data && response.data.models) {
                return response.data.models.map(model => model.name);
            }

            return [];
        } catch (error) {
            console.warn('Could not fetch available Ollama models:', error.message);
            return ['llama2', 'llama3', 'mistral', 'codellama']; // Default fallback
        }
    }

    /**
     * Get display name for this provider
     * @returns {string} - Human-readable provider name
     */
    getDisplayName() {
        return 'Ollama (Local)';
    }

    /**
     * Get maximum input length for Ollama
     * @returns {number} - Maximum input length in characters
     */
    getMaxInputLength() {
        // Ollama can handle longer texts, but we'll be conservative
        return 50000; // 50k characters
    }

    /**
     * Create Ollama-specific summarization prompt
     * @param {string} text - The text to summarize
     * @param {Object} options - Summarization options
     * @returns {string} - The formatted prompt
     */
    createSummarizationPrompt(text, options = {}) {
        const maxLength = options.maxLength || 500;
        const style = options.style || 'concise';
        
        let prompt = `You are a helpful AI assistant that creates ${style} summaries. `;
        prompt += `Please summarize the following content in approximately ${maxLength} words or less. `;
        prompt += `Focus on the main points and key information.\n\n`;
        prompt += `Content to summarize:\n${text}\n\n`;
        prompt += `Summary:`;
        
        return prompt;
    }

    /**
     * Test connection to Ollama with a simple request
     * @returns {Promise<{success: boolean, error?: string, latency?: number}>} - Test result
     */
    async testConnection() {
        const startTime = Date.now();
        
        try {
            // First check if Ollama is running
            const validation = await this.validateConfiguration();
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.error
                };
            }

            // Test with a simple generation request
            const testPrompt = "Please respond with 'Hello, Ollama is working!' to confirm the connection.";
            const response = await axios.post(`${this.endpoint}/api/generate`, {
                model: this.model,
                prompt: testPrompt,
                stream: false,
                options: {
                    max_tokens: 50
                }
            }, {
                timeout: 30000 // 30 second timeout for test
            });

            const latency = Date.now() - startTime;

            if (response.data && response.data.response) {
                return {
                    success: true,
                    latency: latency,
                    response: response.data.response.trim()
                };
            } else {
                return {
                    success: false,
                    error: 'Invalid response format from Ollama'
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

module.exports = OllamaProvider;