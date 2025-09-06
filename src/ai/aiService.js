/**
 * Client-side AI service for DistyVault
 * Handles AI provider communication from the browser
 */
class AIService {
    constructor() {
    this.config = this.loadConfig();
    this.database = new Database();
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

    async distillContent(content, context = {}) {
        // Check if configuration is complete
        if (this.config.mode === 'offline') {
            if (!this.config.ollamaEndpoint || !this.config.ollamaModel) {
                throw new Error('AI provider configuration is incomplete. Please configure Ollama settings.');
            }
            if (context?.id) await this.database.addLog(context.id, 'Calling Ollama', 'info', { model: this.config.ollamaModel, endpoint: this.config.ollamaEndpoint });
            const t0 = Date.now();
            try {
                const raw = await this.distillWithOllama(content);
                if (context?.id) await this.database.addLog(context.id, 'Received Ollama response', 'info', { ms: Date.now() - t0 });
                return this.postProcessDistillation(raw);
            } catch (e) {
                if (context?.id) {
                    await this.database.addLog(context.id, 'AI provider error', 'error', {
                        provider: 'ollama',
                        model: this.config.ollamaModel,
                        endpoint: this.config.ollamaEndpoint,
                        httpStatus: e?.status || e?.httpStatus,
                        message: e?.message || String(e)
                    });
                }
                throw e;
            }
        } else {
            if (!this.config.provider || !this.config.apiKey) {
                throw new Error('AI provider configuration is incomplete. Please configure your AI provider and API key in Settings.');
            }
            if (context?.id) await this.database.addLog(context.id, 'Calling AI provider', 'info', { provider: this.config.provider, model: this.config.model || 'auto' });
            const t0 = Date.now();
            try {
                const raw = await this.distillWithProvider(content);
                if (context?.id) await this.database.addLog(context.id, 'Received AI response', 'info', { ms: Date.now() - t0 });
                return this.postProcessDistillation(raw);
            } catch (e) {
                if (context?.id) {
                    await this.database.addLog(context.id, 'AI provider error', 'error', {
                        provider: this.config.provider,
                        model: this.config.model || 'auto',
                        httpStatus: e?.status || e?.httpStatus,
                        message: e?.message || String(e)
                    });
                }
                throw e;
            }
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
                const err = new Error(`Ollama request failed: HTTP ${response.status}`);
                err.status = response.status;
                err.provider = 'ollama';
                err.model = this.config.ollamaModel;
                err.endpoint = this.config.ollamaEndpoint;
                throw err;
            }

            const result = await response.json();
            return result.response || 'No response from Ollama';
        } catch (error) {
            console.error('Ollama distillation error:', error);
            if (!error.provider) {
                error.provider = 'ollama';
                error.model = this.config.ollamaModel;
                error.endpoint = this.config.ollamaEndpoint;
            }
            throw error;
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
                let msg = `OpenAI API error: HTTP ${response.status}`;
                try { const j = await response.json(); if (j?.error?.message) msg = j.error.message; } catch {}
                const err = new Error(msg);
                err.status = response.status;
                err.provider = 'openai';
                err.model = this.config.model || 'gpt-4o';
                throw err;
            }

            const result = await response.json();
            return result.choices[0]?.message?.content || 'No response from OpenAI';
        } catch (error) {
            console.error('OpenAI distillation error:', error);
            if (!error.provider) { error.provider = 'openai'; error.model = this.config.model || 'gpt-4o'; }
            throw error;
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
                let msg = `Anthropic API error: HTTP ${response.status}`;
                try { const j = await response.json(); if (j?.error?.message) msg = j.error.message; } catch {}
                const err = new Error(msg);
                err.status = response.status;
                err.provider = 'anthropic';
                err.model = this.config.model || 'claude-3-5-haiku-latest';
                throw err;
            }

            const result = await response.json();
            return result.content[0]?.text || 'No response from Anthropic';
        } catch (error) {
            console.error('Anthropic distillation error:', error);
            if (!error.provider) { error.provider = 'anthropic'; error.model = this.config.model || 'claude-3-5-haiku-latest'; }
            throw error;
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
                let msg = `Gemini API error: HTTP ${response.status}`;
                try { const j = await response.json(); if (j?.error?.message) msg = j.error.message; } catch {}
                const err = new Error(msg);
                err.status = response.status;
                err.provider = 'google';
                err.model = this.config.model || 'gemini-2.5-flash';
                throw err;
            }

            const result = await response.json();
            return result.candidates[0]?.content?.parts[0]?.text || 'No response from Gemini';
        } catch (error) {
            console.error('Gemini distillation error:', error);
            try {
                const msg = String(error && (error.message || error)).toLowerCase();
                if (error instanceof TypeError && (/load failed|failed to fetch|networkerror|network error|the network connection was lost/.test(msg))) {
                    error.code = 'INTERRUPTED';
                }
            } catch {}
            if (!error.provider) { error.provider = 'google'; error.model = this.config.model || 'gemini-2.5-flash'; }
            throw error;
        }
    }

    buildDistillationPrompt(text) {
        // Master prompt aligned with src/ai/aiProvider.js formatPrompt
        return `SYSTEM DIRECTIVE: MUST FOLLOW ALL RULES EXACTLY, DEVIATION IS STRICTLY NOT PERMITTED


1. ROLE & GOAL (YOUR PURPOSE AND IDENTITY)
You are a world-class research assistant and knowledge distiller
Your paramount purpose is to produce high-quality, profoundly insightful content and teach core principles with unparalleled clarity and depth
Your mission is to fully detail a topic, distill core knowledge, eliminate all fluff, and enrich text with profound research and insights


2. CORE PROCESS (IMPORTANT AND CRUCIAL)
When I provide a text to analyze, your task is to perform three critical steps:

1. Knowledge Distillation (Deep Dive & Enrichment)
Action: Meticulously distill essential knowledge from the provided text
Goal: Go beyond summarizing. Identify core concepts, underlying principles, and critical information
Process:
- Eliminate all superficiality and extraneous details
- Enrich by deconstructing complex ideas into simplest components
- Ensure concepts are fully understood, deeply explained, and truly memorable
- Prepare knowledge for comprehensive elaboration

2. Expert Research (Comprehensive Gap Analysis & Augmentation)
Action: Critically assess distilled knowledge for gaps, ambiguities, or areas needing more depth
Goal: Identify and fill all knowledge gaps, ambiguities, and areas needing deeper context to ensure a complete and authoritative understanding
Process:
- Conduct a comprehensive, authoritative research process.
- Use diverse, top-tier sources: peer-reviewed scientific journals, reputable academic publications, established news organizations, expert analyses
- Synthesize most crucial, accurate, and up-to-date information
- Augment and validate distilled knowledge for a complete, authoritative understanding

3. Synthesis & Cohesion (Unified, Exhaustive Explanation)
Action: Integrate all information (distillation + research) into one unified, cohesive, exhaustive speech
Goal: Seamlessly weave together validated knowledge, presenting a holistic and deeply integrated understanding of the topic
Process:
- Seamlessly weave together all validated knowledge
- Present a holistic and deeply integrated understanding of the topic


3. CRUCIAL OUTPUT STYLE & TONE (NON-NEGOTIABLE AND BULLETPROOF)
Tone: Direct, profoundly insightful, strictly neutral
Precision: Be exceptionally precise, confident, and authoritative
Uncertainty: Admit only if data is genuinely inconclusive or definitive sources are demonstrably unavailable
Language: Absolutely avoid jargon, technical buzzwords, or colloquialisms
Explanation: Explain all concepts with clarity and depth for a highly intelligent, curious learner to achieve profound and lasting understanding
Primary Goal: Absolute, deep comprehension


4. MANDATORY OUTPUT FORMAT (ABSOLUTE RULE: FOLLOW THIS STRUCTURE 100% OF THE TIME)

START IMMEDIATELY: Begin your entire response directly with the first point of the numbered list
NO CONVERSATIONAL INTROS: Absolutely NO conversational introductions, preambles, or any text outside this strict format: deviations are UNACCEPTABLE
STRUCTURE: Present your response as an incremental numbered list

EACH POINT'S STRUCTURE: Every point MUST follow this precise structure, presenting your entire response organizing the main body of your response as an incremental numbered list:
1. Core idea sentence
Start with a single, memorable sentence that captures one complete, fundamental idea from your research. This sentence should be comprehensive and stand on its own as a key takeaway
Following that sentence, write one or two detailed paragraphs to elaborate on this core idea. Deconstruct the concept, explain its nuances and implications, and provide necessary context to eliminate any knowledge gaps. Use analogies or simple examples where they can aid understanding. The purpose of this section is to cement the idea, explaining not just what it is, but why it matters and how it works based on your research

2. Next core idea sentence
This follows the same pattern as the first point: a single, impactful sentence summarizing the next fundamental concept
Follow up with one or two paragraphs of in-depth explanation, connecting this idea to previous points if it helps build a more cohesive mental model for the reader


COVERAGE: Continue this rigorous pattern for as many points as are absolutely necessary to cover ALL essential knowledge on the topic with the required depth and detail. No point should be left unexplored or superficial.


CRITICAL FORMATTING REQUIREMENTS (NON-NEGOTIABLE):
- Format: "1. Main sentence here\nElaboration here\n\n2. Next main sentence here\nElaboration here"
- Start with "1." (period and space, nothing else)
- Continue sequentially: 1., 2., 3., 4., etc.
- NEVER use: 1), (1), 1:, 1-, or any other format
- NEVER repeat numbers (no multiple "1." entries)
- NEVER skip numbers in sequence
- Main sentence comes IMMEDIATELY after "1. " on the same line
- Elaboration starts on the next line
- Double line break between numbered points


EXAMPLE OF PERFECT FORMAT:
1. The core concept drives the entire system architecture

This fundamental principle shapes how all components interact and determines the scalability limits of the platform. Understanding this relationship is crucial because it affects both performance optimization strategies and future development decisions.


2. Implementation details reveal critical trade-offs

The specific technical choices made here demonstrate the balance between speed and reliability. These decisions have cascading effects throughout the system and explain why certain limitations exist in the current design.



Here is the text to distill:

${text}`;
    }

    postProcessDistillation(rawDistillation) {
        if (!rawDistillation || typeof rawDistillation !== 'string') return rawDistillation;
        try {
            let processed = window.NumberingProcessor ? NumberingProcessor.fixNumberingAsHTML(rawDistillation) : rawDistillation;
            const isValid = window.NumberingProcessor ? NumberingProcessor.validateHTMLFormat(processed) : true;
            if (!isValid && window.NumberingProcessor) {
                processed = NumberingProcessor.forceFormat(rawDistillation, true);
                const finalValid = NumberingProcessor.validateHTMLFormat(processed);
                if (!finalValid) {
                    processed = NumberingProcessor.emergencyHTMLFormat(rawDistillation);
                }
            }
            // Emphasize main sentences when they end with a colon pattern like "Main point:"
            try {
                const wrapper = document.createElement('div');
                wrapper.innerHTML = processed;
                wrapper.querySelectorAll('ol > li').forEach(li => {
                    const text = li.textContent || '';
                    const firstLine = text.split('\n')[0] || '';
                    const colonIdx = firstLine.indexOf(':');
                    if (colonIdx > 0 && colonIdx < 140) {
                        const bold = firstLine.slice(0, colonIdx + 1);
                        const rest = firstLine.slice(colonIdx + 1);
                        li.innerHTML = `<strong>${bold}</strong>${rest}${li.innerHTML.slice(firstLine.length)}`;
                    }
                });
                processed = wrapper.innerHTML;
            } catch {}
            return processed;
        } catch (e) {
            try { return NumberingProcessor.emergencyHTMLFormat(rawDistillation); } catch { return rawDistillation; }
        }
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