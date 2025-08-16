/**
 * Google Gemini AI Provider
 * Handles communication with Google's Gemini API using @google/genai
 */
const AIProvider = require('../aiProvider');

class GoogleProvider extends AIProvider {
    constructor(config = {}) {
        super(config);
        this.apiKey = config.apiKey;
        this.model = config.model || 'gemini-2.5-flash';
        this.timeout = config.timeout || 60000; // 1 minute default
        
        if (!this.apiKey) {
            throw new Error('Google API key is required');
        }

        // Initialize Google GenAI
        this.ai = null;
        this.initializeGenAI();
    }

    /**
     * Initialize Google GenAI SDK
     */
    initializeGenAI() {
        try {
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            this.ai = new GoogleGenerativeAI(this.apiKey);
        } catch (error) {
            console.warn('Google GenAI library not found. Please install it with: npm install @google/generative-ai');
            this.ai = null;
        }
    }

    async generateSummary(text, options = {}) {
        try {
            const processedText = this.preprocessText(text);
            const prompt = this.createDistillationPrompt(processedText, options);

            console.log(`Sending request to Google Gemini with ${processedText.length} characters`);
            console.log(`Using model: ${this.model} with web search enabled`);

            const startTime = Date.now();
            console.log(`Google Gemini request started at: ${new Date().toISOString()}`);

            if (this.ai) {
                // Use the Google GenAI SDK with web search
                const model = this.ai.getGenerativeModel({ 
                    model: this.model,
                    tools: [{
                        googleSearch: {}
                    }]
                });
                
                const result = await model.generateContent(prompt);
                const response = await result.response;

                const endTime = Date.now();
                const duration = (endTime - startTime) / 1000;

                if (response && response.text) {
                    const rawDistillation = response.text().trim();
                    console.log(`Google Gemini response received in ${duration.toFixed(2)}s`);
                    console.log(`Distillation length: ${rawDistillation.length} characters`);
                    console.log(`Web search was used to enhance the distillation`);
                    
                    const processedDistillation = this.postProcessDistillation(rawDistillation);
                    return processedDistillation;
                } else {
                    throw new Error('Invalid response format from Google Gemini');
                }
            } else {
                // Fallback to REST API if SDK is not available
                return await this.generateSummaryWithRestAPI(prompt, options);
            }

        } catch (error) {
            console.error('Error generating distillation with Google Gemini:', error);
            
            if (error.message.includes('API key')) {
                throw new Error('Invalid Google API key. Please check your API key.');
            } else if (error.message.includes('rate limit') || error.message.includes('429')) {
                throw new Error('Google Gemini API rate limit exceeded. Please wait before making more requests.');
            } else if (error.message.includes('403')) {
                throw new Error('Google Gemini API access forbidden. Please check your API key permissions.');
            } else {
                throw new Error(`Google Gemini error: ${error.message}`);
            }
        }
    }

    async generateSummaryWithRestAPI(prompt, options = {}) {
        const axios = require('axios');
        
        const requestData = {
            contents: [
                {
                    parts: [
                        {
                            text: prompt
                        }
                    ]
                }
            ],
            tools: [
                {
                    googleSearch: {}
                }
            ],
            generationConfig: {
                temperature: options.temperature || 0.7,
                topP: options.top_p || 0.8,
                topK: options.top_k || 40,
                maxOutputTokens: options.max_tokens || 1000
            }
        };

        console.log(`Using REST API with web search for model: ${this.model}`);

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
            requestData,
            {
                timeout: this.timeout,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data && response.data.candidates && response.data.candidates[0]) {
            const candidate = response.data.candidates[0];
            
            if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
                const rawDistillation = candidate.content.parts[0].text.trim();
                console.log(`REST API web search response received`);
                
                const processedDistillation = this.postProcessDistillation(rawDistillation);
                return processedDistillation;
            } else {
                throw new Error('Invalid content structure in Gemini response');
            }
        } else {
            throw new Error('Invalid response format from Google Gemini');
        }
    }

    async validateConfiguration() {
        try {
            if (!this.apiKey || this.apiKey.length < 30) {
                return {
                    valid: false,
                    error: 'Invalid Google API key format'
                };
            }

            if (this.ai) {
                const model = this.ai.getGenerativeModel({ model: this.model });
                const result = await model.generateContent('Hello');
                const response = await result.response;

                if (response && response.text) {
                    return { valid: true };
                } else {
                    return {
                        valid: false,
                        error: 'Invalid response from Google Gemini API'
                    };
                }
            } else {
                const axios = require('axios');
                const response = await axios.post(
                    `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
                    {
                        contents: [
                            {
                                parts: [
                                    {
                                        text: 'Hello'
                                    }
                                ]
                            }
                        ],
                        generationConfig: {
                            maxOutputTokens: 10
                        }
                    },
                    {
                        timeout: 10000,
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (response.data && response.data.candidates) {
                    return { valid: true };
                } else {
                    return {
                        valid: false,
                        error: 'Invalid response from Google Gemini API'
                    };
                }
            }

        } catch (error) {
            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;
                
                if (status === 400) {
                    if (data.error?.message?.includes('API key')) {
                        return {
                            valid: false,
                            error: 'Invalid Google API key'
                        };
                    } else if (data.error?.message?.includes('model')) {
                        return {
                            valid: false,
                            error: `Model "${this.model}" is not available`
                        };
                    }
                } else if (status === 403) {
                    return {
                        valid: false,
                        error: 'Google API access forbidden. Please check your API key permissions.'
                    };
                } else if (status === 429) {
                    return {
                        valid: false,
                        error: 'Google API rate limit exceeded'
                    };
                }
            }

            return {
                valid: false,
                error: `Google validation failed: ${error.message}`
            };
        }
    }

    getRequiredConfig() {
        return {
            apiKey: {
                type: 'string',
                required: true,
                sensitive: true,
                description: 'Google API key for Gemini'
            },
            model: {
                type: 'string',
                required: false,
                default: 'gemini-2.5-flash',
                description: 'Gemini model to use'
            }
        };
    }

    getAvailableModels() {
        return [
            'gemini-2.5-pro',
            'gemini-2.5-flash',
            'gemini-2.5-flash-lite'
        ];
    }

    getDisplayName() {
        return 'Google Gemini';
    }

    getMaxInputLength() {
        return 800000; // ~1M tokens
    }

    async testConnection() {
        const startTime = Date.now();
        
        try {
            if (this.ai) {
                const model = this.ai.getGenerativeModel({ model: this.model });
                const result = await model.generateContent('Please respond with "Gemini connection test successful" to confirm the connection.');
                const response = await result.response;

                const latency = Date.now() - startTime;

                if (response && response.text) {
                    return {
                        success: true,
                        latency: latency,
                        response: response.text().trim()
                    };
                } else {
                    return {
                        success: false,
                        error: 'Invalid response format from Google Gemini'
                    };
                }
            } else {
                const axios = require('axios');
                const response = await axios.post(
                    `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
                    {
                        contents: [
                            {
                                parts: [
                                    {
                                        text: 'Please respond with "Gemini connection test successful" to confirm the connection.'
                                    }
                                ]
                            }
                        ],
                        generationConfig: {
                            maxOutputTokens: 20
                        }
                    },
                    {
                        timeout: 30000,
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );

                const latency = Date.now() - startTime;

                if (response.data && response.data.candidates && response.data.candidates[0]) {
                    const candidate = response.data.candidates[0];
                    if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
                        return {
                            success: true,
                            latency: latency,
                            response: candidate.content.parts[0].text.trim()
                        };
                    }
                }

                return {
                    success: false,
                    error: 'Invalid response format from Google Gemini'
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

module.exports = GoogleProvider;