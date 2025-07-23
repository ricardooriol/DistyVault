/**
 * Abstract base class for AI providers
 * Defines the common interface that all AI providers must implement
 */
class AIProvider {
    constructor(config = {}) {
        this.config = config;
        this.name = this.constructor.name;
    }

    /**
     * Generate a summary from the given text
     * @param {string} text - The text to summarize
     * @param {Object} options - Additional options for summarization
     * @returns {Promise<string>} - The generated summary
     */
    async generateSummary(text, options = {}) {
        throw new Error(`generateSummary must be implemented by ${this.name}`);
    }

    /**
     * Validate the provider configuration
     * @returns {Promise<{valid: boolean, error?: string}>} - Validation result
     */
    async validateConfiguration() {
        throw new Error(`validateConfiguration must be implemented by ${this.name}`);
    }

    /**
     * Get the required configuration fields for this provider
     * @returns {Object} - Configuration schema
     */
    getRequiredConfig() {
        throw new Error(`getRequiredConfig must be implemented by ${this.name}`);
    }

    /**
     * Get the display name for this provider
     * @returns {string} - Human-readable provider name
     */
    getDisplayName() {
        return this.name.replace('Provider', '');
    }

    /**
     * Get available models for this provider
     * @returns {Array<string>} - List of available model names
     */
    getAvailableModels() {
        return [];
    }

    /**
     * Test the connection to the AI provider
     * @returns {Promise<{success: boolean, error?: string, latency?: number}>} - Connection test result
     */
    async testConnection() {
        const startTime = Date.now();
        try {
            const validation = await this.validateConfiguration();
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.error
                };
            }

            // Test with a simple prompt
            const testText = "This is a test message to verify the AI provider connection.";
            await this.generateSummary(testText, { maxLength: 50 });

            const latency = Date.now() - startTime;
            return {
                success: true,
                latency: latency
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                latency: Date.now() - startTime
            };
        }
    }

    /**
     * Format error messages in a user-friendly way
     * @param {Error} error - The error to format
     * @returns {string} - Formatted error message
     */
    formatError(error) {
        if (error.message.includes('API key')) {
            return 'Invalid or missing API key. Please check your configuration.';
        }
        if (error.message.includes('rate limit')) {
            return 'API rate limit exceeded. Please wait before making more requests.';
        }
        if (error.message.includes('network') || error.message.includes('timeout')) {
            return 'Network connection failed. Please check your internet connection.';
        }
        return error.message || 'An unexpected error occurred.';
    }

    /**
     * Prepare the text for summarization (common preprocessing)
     * @param {string} text - The input text
     * @returns {string} - Preprocessed text
     */
    preprocessText(text) {
        if (!text || typeof text !== 'string') {
            throw new Error('Invalid input text provided');
        }

        // Basic text cleaning
        let cleaned = text
            .replace(/\s+/g, ' ')           // Replace multiple spaces with single space
            .replace(/\n+/g, '\n')          // Replace multiple newlines with single newline
            .trim();                        // Remove leading/trailing whitespace

        // Truncate if too long (most APIs have limits)
        const maxLength = this.getMaxInputLength();
        if (cleaned.length > maxLength) {
            console.warn(`Text truncated from ${cleaned.length} to ${maxLength} characters`);
            cleaned = cleaned.substring(0, maxLength) + '...';
        }

        return cleaned;
    }

    /**
     * Get the maximum input length supported by this provider
     * @returns {number} - Maximum input length in characters
     */
    getMaxInputLength() {
        return 100000; // Default 100k characters, override in specific providers
    }

    /**
     * Create a standardized prompt for summarization
     * @param {string} text - The text to summarize
     * @param {Object} options - Summarization options
     * @returns {string} - The formatted prompt
     */
    createSummarizationPrompt(text, options = {}) {
        return this.formatPrompt(text);
    }

    /**
     * Format the prompt for knowledge distillation
     * @param {string} text - The text to analyze
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
}

module.exports = AIProvider;