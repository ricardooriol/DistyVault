const { LlamaModel, LlamaContext, LlamaChatSession } = require('node-llama-cpp');

class LLMService {
    constructor() {
        this.model = null;
        this.context = null;
        this.initialized = false;
    }

    /**
     * Initialize the LLM model
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // Initialize llama.cpp with a local model
            // You'll need to download a compatible model like Llama 2
            this.model = new LlamaModel({
                modelPath: process.env.MODEL_PATH || './models/llama-2-13b-chat.gguf',
                contextSize: 4096,
                threads: 4
            });

            this.context = new LlamaContext({ model: this.model });
            this.initialized = true;
        } catch (error) {
            console.error('Error initializing LLM:', error);
            throw error;
        }
    }

    /**
     * Generate a detailed summary of the content
     * @param {string} content - The content to summarize
     * @returns {Promise<string>} The generated summary
     */
    async generateSummary(content) {
        await this.initialize();

        try {
            const session = new LlamaChatSession({ context: this.context });

            // Create a prompt that encourages detailed, knowledge-rich summaries
            const prompt = `
            Please provide a comprehensive and detailed summary of the following content. 
            Focus on extracting and preserving all key knowledge, insights, and learnings. 
            The summary should be thorough and dense with information, while removing redundancy 
            and non-essential elements. Organize the information logically and maintain the 
            depth of the original content.

            Content to summarize:
            ${content}
            `;

            const response = await session.prompt(prompt, {
                maxTokens: 2048,
                temperature: 0.3, // Lower temperature for more focused output
                topP: 0.9,
                streamInterval: 0
            });

            return response.trim();
        } catch (error) {
            console.error('Error generating summary:', error);
            throw error;
        }
    }
}

module.exports = new LLMService();
