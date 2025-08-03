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
1. VMware's licensing changes are driving enterprise migration decisions

Following Broadcom's acquisition, VMware shifted from perpetual licenses to subscription models. This fundamental change in pricing structure has prompted many organizations to evaluate alternatives, as the new model significantly increases long-term costs for existing deployments.


2. Container orchestration platforms offer compelling migration paths

Kubernetes and similar technologies provide infrastructure abstraction that reduces vendor lock-in. Organizations can maintain application portability while gaining access to cloud-native features that weren't available in traditional virtualization platforms.



Here is the text to distill:

${text}`;
    }
}

module.exports = AIProvider;