/**
 * Ollama service for SAWRON
 * Handles communication with the local Ollama instance
 */
const axios = require('axios');

class OllamaService {
    constructor() {
        this.baseUrl = 'http://localhost:11434/api';
        this.model = 'phi4-mini';
    }

    /**
     * Generate a distillation using the Ollama API
     * @param {string} text - The text to distill
     * @returns {Promise<string>} - The generated distillation
     */
    async generateSummary(text) {
        const prompt = this.formatPrompt(text);
        
        try {
            console.log(`Sending request to Ollama with ${text.length} characters`);
            console.log(`Using model: ${this.model}`);
            
            // Log the first 100 characters of the text
            console.log(`Text preview: ${text.substring(0, 100)}...`);
            
            const startTime = Date.now();
            console.log(`Ollama request started at: ${new Date().toISOString()}`);
            
            const response = await axios.post(`${this.baseUrl}/generate`, {
                model: this.model,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.1,
                    top_p: 0.9,
                    num_predict: 2048
                }
            });
            
            const duration = (Date.now() - startTime) / 1000;
            console.log(`Ollama request completed in ${duration.toFixed(2)}s`);
            
            // Log the first 100 characters of the response
            const summaryText = response.data.response;
            console.log(`Summary preview: ${summaryText.substring(0, 100)}...`);
            console.log(`Summary length: ${summaryText.length} characters`);
            
            return summaryText;
        } catch (error) {
            console.error('Error calling Ollama API:', error.message);
            if (error.response) {
                console.error('Response data:', error.response.data);
                console.error('Response status:', error.response.status);
            }
            throw new Error(`Failed to generate summary: ${error.message}`);
        }
    }

    /**
     * Format the prompt for the Ollama API using the specified template
     * @param {string} text - The text to summarize
     * @returns {string} - The formatted prompt
     */
    formatPrompt(text) {
        return `Analyze the text I provide below. Your task is to distill its core knowledge, removing all fluff and focusing only on the essential concepts. Your output should be a lesson, not a summary. Present the information with the following strict structure and style:

Style and Tone:
Direct and Insightful: Begin immediately with the first key point. Do not use any introductory phrases like "Here is the summary" or other conversational filler.
Clear and Simple: Explain concepts using plain language. Avoid jargon, buzzwords, and overly complex terminology. The goal is to make complex ideas intuitive and accessible.
Confident and Educational: Write as an expert distilling knowledge for a capable learner. Your goal is to ensure the core ideas are not just listed, but are fully understood and remembered.

Output Format:
Organize your entire response as a numbered list. Each point in the list must follow this two-part structure precisely:

The Core Idea Sentence
Start with a single, memorable sentence that captures one complete, fundamental idea from the text. This sentence should be comprehensive and stand on its own as a key takeaway.
Following that sentence, write one or two detailed paragraphs to elaborate on this core idea. Deconstruct the concept, explain its implications, and provide the necessary context to eliminate any knowledge gaps. Use analogies or simple examples where they can aid understanding. The purpose of this section is to cement the idea, explaining not just what it is, but why it matters and how it works.

The Next Core Idea Sentence
This follows the same pattern as the first point—a single, impactful sentence summarizing the next fundamental concept.
Again, follow up with one or two paragraphs of in-depth explanation. If the original text is missing crucial context, feel free to add it to ensure the concept is fully grasped. Connect this idea to previous points if it helps build a more cohesive mental model for the reader.

Continue this pattern for as many points as are necessary to cover all the essential knowledge in the document. Do not summarize for the sake of brevity; distill for the sake of clarity and understanding.

Text to Analyze:
${text}`;
    }

    /**
     * Check if the Ollama service is available
     * @returns {Promise<boolean>} - True if the service is available
     */
    async checkAvailability() {
        try {
            const response = await axios.get(`${this.baseUrl}/tags`);
            const models = response.data.models || [];
            const hasModel = models.some(model => model.name === this.model);
            
            if (!hasModel) {
                console.warn(`Model ${this.model} not found. Available models:`, models.map(m => m.name));
            }
            
            return hasModel;
        } catch (error) {
            console.error('Ollama service not available:', error.message);
            return false;
        }
    }
}

module.exports = new OllamaService();