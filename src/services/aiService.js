/**
 * Client-side AI service for DistyVault
 * Handles AI provider communication from the browser
 */
class AIService {
    constructor() {
        this.config = this.loadConfig();
    }

    loadConfig() {
        const saved = localStorage.getItem('aiConfig');
        return saved ? JSON.parse(saved) : {
            mode: 'online',
            provider: '',
            model: '',
            apiKey: '',
            ollamaEndpoint: 'http://localhost:11434',
            ollamaModel: 'llama2'
        };
    }

    saveConfig(config) {
        this.config = { ...this.config, ...config };
        localStorage.setItem('aiConfig', JSON.stringify(this.config));
    }

    async distillContent(content) {
        // Check if configuration is complete
        if (this.config.mode === 'offline') {
            if (!this.config.ollamaEndpoint || !this.config.ollamaModel) {
                throw new Error('AI provider configuration is incomplete. Please configure Ollama settings.');
            }
            const raw = await this.distillWithOllama(content);
            return (window.NumberingProcessor ? NumberingProcessor.fixNumberingAsHTML(raw) : raw);
        } else {
            if (!this.config.provider || !this.config.apiKey) {
                throw new Error('AI provider configuration is incomplete. Please configure your AI provider and API key in Settings.');
            }
            const raw = await this.distillWithProvider(content);
            return (window.NumberingProcessor ? NumberingProcessor.fixNumberingAsHTML(raw) : raw);
        }
    }

    async distillWithOllama(content) {
        if (!this.config.ollamaEndpoint || !this.config.ollamaModel) {
            throw new Error('Ollama configuration is incomplete');
        }

        const prompt = this.buildDistillationPrompt(content);
        
        try {
            const response = await fetch(`${this.config.ollamaEndpoint}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.config.ollamaModel,
                    prompt: prompt,
                    stream: false
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama request failed: ${response.status}`);
            }

            const result = await response.json();
            return result.response || 'No response from Ollama';
        } catch (error) {
            console.error('Ollama distillation error:', error);
            throw new Error(`Ollama processing failed: ${error.message}`);
        }
    }

    async distillWithProvider(content) {
        if (!this.config.provider || !this.config.apiKey) {
            throw new Error('AI provider configuration is incomplete');
        }

        const prompt = this.buildDistillationPrompt(content);

        switch (this.config.provider) {
            case 'openai':
                return await this.distillWithOpenAI(prompt);
            case 'anthropic':
                return await this.distillWithAnthropic(prompt);
            case 'google':
                return await this.distillWithGemini(prompt);
            default:
                throw new Error(`Unsupported provider: ${this.config.provider}`);
        }
    }

    async distillWithOpenAI(prompt) {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: this.config.model || 'gpt-4o',
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 2000
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
            }

            const result = await response.json();
            return result.choices[0]?.message?.content || 'No response from OpenAI';
        } catch (error) {
            console.error('OpenAI distillation error:', error);
            throw new Error(`OpenAI processing failed: ${error.message}`);
        }
    }

    async distillWithAnthropic(prompt) {
        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.config.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: this.config.model || 'claude-3-5-haiku-latest',
                    max_tokens: 2000,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `Anthropic API error: ${response.status}`);
            }

            const result = await response.json();
            return result.content[0]?.text || 'No response from Anthropic';
        } catch (error) {
            console.error('Anthropic distillation error:', error);
            throw new Error(`Anthropic processing failed: ${error.message}`);
        }
    }

    async distillWithGemini(prompt) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.config.model || 'gemini-2.5-flash'}:generateContent?key=${this.config.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: prompt
                                }
                            ]
                        }
                    ]
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
            }

            const result = await response.json();
            return result.candidates[0]?.content?.parts[0]?.text || 'No response from Gemini';
        } catch (error) {
            console.error('Gemini distillation error:', error);
            throw new Error(`Gemini processing failed: ${error.message}`);
        }
    }

    buildDistillationPrompt(content) {
        return `Please analyze and distill the following content into a clear, concise summary that captures the key points, main ideas, and important details. Focus on creating a well-structured summary that would be valuable for knowledge retention and future reference.

Content to distill:
${content}

Please provide a comprehensive yet concise distillation of this content:`;
    }

    async testConnection(config = null) {
        const testConfig = config || this.config;
        
        if (testConfig.mode === 'offline') {
            return await this.testOllamaConnection(testConfig);
        } else {
            return await this.testProviderConnection(testConfig);
        }
    }

    async testOllamaConnection(config) {
        try {
            const response = await fetch(`${config.ollamaEndpoint}/api/tags`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return { success: true, message: 'Ollama connection successful' };
        } catch (error) {
            return { success: false, message: `Ollama connection failed: ${error.message}` };
        }
    }

    async testProviderConnection(config) {
        try {
            const testPrompt = 'Hello, this is a test. Please respond with "Test successful".';
            
            switch (config.provider) {
                case 'openai':
                    await this.testOpenAI(config, testPrompt);
                    break;
                case 'anthropic':
                    await this.testAnthropic(config, testPrompt);
                    break;
                case 'google':
                    await this.testGemini(config, testPrompt);
                    break;
                default:
                    throw new Error(`Unsupported provider: ${config.provider}`);
            }
            
            return { success: true, message: 'API connection successful' };
        } catch (error) {
            return { success: false, message: `API test failed: ${error.message}` };
        }
    }

    async testOpenAI(config, prompt) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model || 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 50
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `HTTP ${response.status}`);
        }
    }

    async testAnthropic(config, prompt) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: config.model || 'claude-3-sonnet-20240229',
                max_tokens: 50,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `HTTP ${response.status}`);
        }
    }

    async testGemini(config, prompt) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model || 'gemini-pro'}:generateContent?key=${config.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `HTTP ${response.status}`);
        }
    }
}

window.AIService = AIService;