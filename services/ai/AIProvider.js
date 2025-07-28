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
     * Post-process the AI-generated distillation to fix common issues
     * @param {string} rawDistillation - The raw distillation from the AI provider
     * @returns {string} - The processed distillation with fixes applied
     */
    postProcessDistillation(rawDistillation) {
        if (!rawDistillation || typeof rawDistillation !== 'string') {
            return rawDistillation;
        }

        try {
            // Apply numbering fixes (multiple passes for bulletproof processing)
            let processedDistillation = rawDistillation;
            let passCount = 0;
            const maxPasses = 3;
            
            while (passCount < maxPasses) {
                const beforeFix = processedDistillation;
                processedDistillation = NumberingProcessor.fixNumbering(processedDistillation);
                
                // If no changes were made, we're done
                if (processedDistillation === beforeFix) {
                    break;
                }
                
                passCount++;
            }
            
            // Final validation - ensure we have proper numbering
            const finalStats = NumberingProcessor.getNumberingStats(processedDistillation);
            if (finalStats.hasNumbering && finalStats.hasIssues) {
                console.warn(`[${this.name}] Numbering issues persist after ${passCount} passes:`, {
                    totalPoints: finalStats.totalPoints,
                    issueTypes: finalStats.issueTypes,
                    numbers: finalStats.numbers
                });
                
                // Last resort: force sequential numbering
                processedDistillation = this.forceSequentialNumbering(processedDistillation);
            }
            
            // Log if numbering issues were detected and fixed
            if (processedDistillation !== rawDistillation) {
                const originalStats = NumberingProcessor.getNumberingStats(rawDistillation);
                console.log(`[${this.name}] Fixed numbering issues in ${passCount} passes:`, {
                    originalPoints: originalStats.totalPoints,
                    originalNumbers: originalStats.numbers,
                    finalPoints: finalStats.totalPoints,
                    issuesFixed: originalStats.issueTypes
                });
            }
            
            return processedDistillation;
        } catch (error) {
            console.warn(`[${this.name}] Error in post-processing distillation:`, error.message);
            return rawDistillation; // Return original if processing fails
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
     * Force sequential numbering as a last resort
     * @param {string} text - The text to fix
     * @returns {string} - Text with forced sequential numbering
     */
    forceSequentialNumbering(text) {
        try {
            // Split text into lines and identify potential numbered points
            const lines = text.split('\n');
            const processedLines = [];
            let currentNumber = 1;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                // Check if this line starts with a number pattern
                if (/^\s*\d+[\.\)\:\-]/.test(line)) {
                    // Replace with sequential number
                    const cleanedLine = line.replace(/^\s*\d+[\.\)\:\-]\s*/, `${currentNumber}. `);
                    processedLines.push(cleanedLine);
                    currentNumber++;
                } else {
                    processedLines.push(line);
                }
            }
            
            return processedLines.join('\n');
        } catch (error) {
            console.warn('Error in forceSequentialNumbering:', error.message);
            return text;
        }
    }

    /**
     * Format the prompt for knowledge distillation
     * @param {string} text - The text to analyze
     * @returns {string} - The formatted prompt
     */
    formatPrompt(text) {
        return `SYSTEM DIRECTIVE: FOLLOW ALL RULES EXACTLY. DEVIATION IS NOT PERMITTED.

1. ROLE & GOAL
You are a world-class research assistant and knowledge distiller. Your only goal is to analyze a provided text, synthesize it with external expert research, and output a structured lesson that teaches the topic's core principles with absolute clarity.

2. CORE PROCESS
When I provide a text, you will execute these three steps:

Distill: Analyze the provided text and distill its core concepts into a lesson. Eliminate fluff and simplify complex ideas.

Research: Identify any knowledge gaps in the distilled concepts. Conduct expert-level research using top-tier scientific journals, reputable media, and expert analyses to fill these gaps with the most crucial and accurate information.

Synthesize: Merge the distilled information and your research findings into a single, cohesive, and structured analysis.

3. OUTPUT STYLE & TONE (NON-NEGOTIABLE)

Tone: Direct, insightful, and neutral. Be precise and confident. If data is inconclusive, state it directly.

Clarity: Avoid all jargon and buzzwords. Explain concepts as if to a smart, curious learner. The goal is deep understanding, not just listing facts.

Directness: Your response MUST begin directly with the first key insight (Point #1). Do not use conversational introductions, preambles, or distillations like "Here are the findings...". Your response MUST end after the final point's elaboration. Do not add a concluding paragraph.

4. MANDATORY OUTPUT FORMAT (ABSOLUTE RULE: FOLLOW THIS STRUCTURE 100% OF THE TIME)

Your entire response MUST be a numbered list starting with "1." and continuing sequentially (1., 2., 3., etc.). Each item in the list MUST adhere to the following two-part structure without exception:

1. Core Idea Sentence
Begin with a single, bolded sentence that captures one complete, fundamental idea. This sentence must stand on its own as a key takeaway.
Then, in one or two subsequent paragraphs, elaborate on this core idea. Deconstruct the concept, explain its nuances and implications, and provide necessary context. Use analogies or simple examples where they can aid understanding. Explain not just what the idea is, but why it matters and how it works based on your synthesis of the text and your research.

2. Next Core Idea Sentence
This follows the exact same pattern. A single, bolded, impactful sentence distilling the next fundamental concept.
Follow up with one or two paragraphs of in-depth explanation. Connect this idea to previous points if it helps build a cohesive mental model.

3. Continue Sequential Numbering
Continue this exact pattern (3., 4., 5., etc.) for as many points as are necessary to cover all essential knowledge. NEVER repeat numbers or skip numbers in the sequence.

CRITICAL NUMBERING RULES:
- Start with "1." (not "1)", "(1)", "1:", or "1 -")
- Use sequential numbering: 1., 2., 3., 4., etc.
- Never repeat a number (no multiple "1." entries)
- Never skip numbers in the sequence
- Each numbered point must be substantial (at least 50 words)

Here is the text to distill:

${text}`;
    }
}

module.exports = AIProvider;