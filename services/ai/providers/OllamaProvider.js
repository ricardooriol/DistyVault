/**
 * Ollama AI Provider
 * Handles communication with local Ollama installation
 */
const AIProvider = require('../AIProvider');
const axios = require('axios');

class OllamaProvider extends AIProvider {
    constructor(config = {}) {
        super(config);
        this.model = config.model;
        this.endpoint = config.endpoint || 'http://localhost:11434';
        this.timeout = config.timeout || 300000; // 5 minutes default
    }

    /**
     * Generate a distillation using Ollama
     * @param {string} text - The text to distill
     * @param {Object} options - Summarization options
     * @returns {Promise<string>} - The generated distillation
     */
    async generateSummary(text, options = {}) {
        try {
            const processedText = this.preprocessText(text);
            const prompt = this.createDistillationPrompt(processedText, options);

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
                const rawSummary = response.data.response.trim();
                console.log(`Ollama response received in ${duration.toFixed(2)}s`);
                console.log(`Summary length: ${rawSummary.length} characters`);
                
                // Apply post-processing to fix numbering and other issues
                const processedSummary = this.postProcessSummary(rawSummary);
                return processedSummary;
            } else {
                throw new Error('Invalid response format from Ollama');
            }

        } catch (error) {
            console.error('Error generating distillation with Ollama:', error);

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

            // Check if model is specified
            if (!this.model) {
                return {
                    valid: false,
                    error: 'No model specified. Please select a model from the available options.'
                };
            }

            // Check if the specified model is available
            const availableModels = response.data.models.map(model => model.name);
            console.log(`Available Ollama models: ${availableModels.join(', ')}`);
            console.log(`Looking for model: "${this.model}"`);

            // Check for exact match or partial match (handles different suffixes)
            let matchedModel = null;
            const modelExists = availableModels.some(model => {
                console.log(`Comparing "${this.model}" with "${model}"`);

                // Exact match
                if (model === this.model) {
                    console.log(`✅ Exact match found: ${model}`);
                    matchedModel = model;
                    return true;
                }

                // Check if model matches without suffix (handles :latest, :instruct, etc.)
                const modelBase = model.split(':')[0];
                const requestedBase = this.model.split(':')[0];
                console.log(`Comparing bases: "${requestedBase}" with "${modelBase}"`);
                if (modelBase === requestedBase) {
                    console.log(`✅ Base match found: ${modelBase} -> using ${model}`);
                    matchedModel = model;
                    return true;
                }

                // Check if requested model matches with :latest added
                if (model === `${this.model}:latest`) {
                    console.log(`✅ Match with :latest suffix: ${model}`);
                    matchedModel = model;
                    return true;
                }

                return false;
            });

            if (modelExists && matchedModel) {
                // Update the model name to the exact match found in Ollama
                console.log(`🔄 Updating model name from "${this.model}" to "${matchedModel}"`);
                this.model = matchedModel;
            }

            if (!modelExists) {
                // Provide helpful suggestions for common mistakes
                const suggestions = [];
                const requestedBase = this.model.split(':')[0];

                availableModels.forEach(model => {
                    const modelBase = model.split(':')[0];
                    if (modelBase.includes(requestedBase) || requestedBase.includes(modelBase)) {
                        suggestions.push(model);
                    }
                });

                let errorMsg = `Model "${this.model}" is not available.\n\nAvailable models: ${availableModels.join(', ')}`;

                if (suggestions.length > 0) {
                    errorMsg += `\n\nDid you mean: ${suggestions.join(', ')}?`;
                }

                return {
                    valid: false,
                    error: errorMsg
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
                placeholder: 'Enter model name (e.g., llama3, phi4-mini)',
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
            return []; // Return empty array - no fallback models
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