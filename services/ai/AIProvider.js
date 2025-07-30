/**
 * Abstract base class for AI providers
 * Defines the common interface that all AI providers must implement
 */
const NumberingProcessor = require('./NumberingProcessor');

class AIProvider {
    constructor(config = {}) {
        this.config = config;
        this.name = this.constructor.name;
    }

    /**
     * Generate a distilled analysis from the given text
     * @param {string} text - The text to distill
     * @param {Object} options - Additional options for distillation
     * @returns {Promise<string>} - The generated distillation
     */
    async generateSummary(text, options = {}) {
        // This method should be overridden by subclasses to call the AI provider
        // and then call this.postProcessDistillation() on the result
        throw new Error(`generateSummary must be implemented by ${this.name}`);
    }

    /**
     * Post-process the AI-generated distillation to fix common issues - BULLETPROOF VERSION
     * @param {string} rawDistillation - The raw distillation from the AI provider
     * @returns {string} - The processed distillation with perfect numbering format
     */
    postProcessDistillation(rawDistillation) {
        if (!rawDistillation || typeof rawDistillation !== 'string') {
            return rawDistillation;
        }

        try {
            console.log(`[${this.name}] Starting bulletproof numbering processing...`);
            
            // Step 1: Apply the bulletproof numbering processor
            let processedDistillation = NumberingProcessor.fixNumbering(rawDistillation);
            
            // Step 2: Validate the result
            const isProperlyFormatted = NumberingProcessor.isProperlyFormatted(processedDistillation);
            
            if (!isProperlyFormatted) {
                console.warn(`[${this.name}] First pass failed, applying force format...`);
                // Nuclear option: force perfect format
                processedDistillation = NumberingProcessor.forceFormat(rawDistillation);
            }
            
            // Step 3: Final validation
            const finalValidation = NumberingProcessor.isProperlyFormatted(processedDistillation);
            
            if (!finalValidation) {
                console.error(`[${this.name}] CRITICAL: Numbering processor failed completely, using emergency format`);
                // Absolute last resort
                processedDistillation = `1. ${rawDistillation.trim()}`;
            }
            
            // Step 4: Log the results
            const originalStats = NumberingProcessor.getNumberingStats(rawDistillation);
            const finalStats = NumberingProcessor.getNumberingStats(processedDistillation);
            
            if (processedDistillation !== rawDistillation) {
                console.log(`[${this.name}] Numbering processing completed:`, {
                    originalHadNumbering: originalStats.hasNumbering,
                    originalPoints: originalStats.totalPoints,
                    originalSequential: originalStats.isSequential,
                    finalPoints: finalStats.totalPoints,
                    finalSequential: finalStats.isSequential,
                    processingSuccess: finalValidation
                });
            }
            
            return processedDistillation;
            
        } catch (error) {
            console.error(`[${this.name}] CRITICAL ERROR in numbering processor:`, error.message);
            // Emergency fallback
            return `1. ${rawDistillation.trim()}`;
        }
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
     * Prepare the text for distillation (common preprocessing)
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
     * Create a standardized prompt for distillation
     * @param {string} text - The text to distill
     * @param {Object} options - Distillation options
     * @returns {string} - The formatted prompt
     */
    createDistillationPrompt(text, options = {}) {
        return this.formatPrompt(text);
    }



    /**
     * Format the prompt for knowledge distillation
     * @param {string} text - The text to analyze
     * @returns {string} - The formatted prompt
     */
    formatPrompt(text) {
        return `SYSTEM DIRECTIVE: FOLLOW ALL RULES EXACTLY. DEVIATION IS NOT PERMITTED.

1. ROLE & GOAL
You are a world-class research assistant and knowledge distiller. Your only goal is to analyze a provided text, analyze it with external expert research, and output a structured lesson that teaches the topic's core principles with absolute clarity.

2. CORE PROCESS
When I provide a text, you will execute these three steps:

Distill: Analyze the provided text and distill all of its core concepts into a lesson. Eliminate fluff and simplify complex ideas.

Research: Identify any knowledge gaps in the distilled concepts. Conduct expert-level research using top-tier scientific journals, reputable media, and expert analyses to fill these gaps with the most crucial and accurate information.

Merge: Combine the distilled information and your research findings into a complete, single, cohesive, and structured analysis.

3. OUTPUT STYLE & TONE (NON-NEGOTIABLE)

Tone: Direct, insightful, and neutral. Be precise and confident. If data is inconclusive, state it directly.

Clarity: Avoid all jargon and buzzwords. Explain concepts as if to a smart, curious learner. The goal is deep understanding, not just listing facts.

Directness: Your response MUST begin directly with the first key insight. Do not use conversational introductions, preambles, or distillations like "Here are the findings...". Your response MUST end after the final point's elaboration. Do not add a concluding paragraph.

4. MANDATORY OUTPUT FORMAT (ABSOLUTE RULE: FOLLOW THIS STRUCTURE 100% OF THE TIME)

Your entire response MUST follow this EXACT format with NO EXCEPTIONS:

1. First sentence of the key insight goes here immediately after the number and period
This is where you elaborate on the first sentence. You can have multiple paragraphs here to explain the concept fully. The key is that the first sentence comes RIGHT AFTER the number, and then elaboration follows on the next line.

2. Second key insight sentence goes here immediately after the number and period
Again, elaboration follows on the next line. This creates a clean, consistent format where each numbered point starts with the main idea sentence, then provides detailed explanation.

3. Continue this exact pattern for all subsequent points
Each point follows the same structure: number, period, space, then the main sentence, then a line break, then elaboration.

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
1. VMware's licensing changes are driving enterprise migration decisions

Following Broadcom's acquisition, VMware shifted from perpetual licenses to subscription models. This fundamental change in pricing structure has prompted many organizations to evaluate alternatives, as the new model significantly increases long-term costs for existing deployments.

2. Container orchestration platforms offer compelling migration paths

Kubernetes and similar technologies provide infrastructure abstraction that reduces vendor lock-in. Organizations can maintain application portability while gaining access to cloud-native features that weren't available in traditional virtualization platforms.


Here is the text to distill:

${text}`;
    }
}

module.exports = AIProvider;