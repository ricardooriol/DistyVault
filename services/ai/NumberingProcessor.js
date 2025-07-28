/**
 * NumberingProcessor - Bulletproof utility for enforcing perfect numbering format
 * Ensures ALL AI outputs follow the exact format: "1. Sentence\nParagraph\n\n2. Sentence\nParagraph"
 */

class NumberingProcessor {
    /**
     * Fix numbering issues in AI-generated text - BULLETPROOF VERSION
     * @param {string} text - The text to process
     * @returns {string} - Text with perfect numbering format
     */
    static fixNumbering(text) {
        if (!text || typeof text !== 'string') {
            return text;
        }

        try {
            // Step 1: Clean and normalize the text
            let cleanedText = this.cleanText(text);

            // Step 2: Check if text has mixed or problematic numbering
            if (this.hasMixedOrProblematicNumbering(cleanedText)) {
                console.log('Detected mixed/problematic numbering, applying force format');
                return this.forceFormat(cleanedText);
            }

            // Step 3: Extract content blocks (potential numbered points)
            const contentBlocks = this.extractContentBlocks(cleanedText);

            // Step 4: If no meaningful content blocks found, try to create them
            if (contentBlocks.length === 0) {
                return this.createNumberedFormat(cleanedText);
            }

            // Step 5: Apply perfect numbering format
            const perfectFormat = this.applyPerfectFormat(contentBlocks);

            // Step 6: Final validation and cleanup
            return this.finalValidation(perfectFormat);

        } catch (error) {
            console.warn('NumberingProcessor: Error in fixNumbering, applying emergency format:', error.message);
            return this.emergencyFormat(text);
        }
    }

    /**
     * Clean and normalize text for processing
     * @param {string} text - Raw text
     * @returns {string} - Cleaned text
     */
    static cleanText(text) {
        // Remove excessive whitespace and normalize line breaks
        let cleaned = text
            .replace(/\r\n/g, '\n')           // Normalize line breaks
            .replace(/\r/g, '\n')             // Handle old Mac line breaks
            .replace(/\n{3,}/g, '\n\n')       // Max 2 consecutive line breaks
            .replace(/[ \t]+/g, ' ')          // Normalize spaces and tabs
            .replace(/^\s+|\s+$/g, '');       // Trim start and end

        return cleaned;
    }

    /**
     * Check if text has mixed or problematic numbering that needs force formatting
     * @param {string} text - Text to check
     * @returns {boolean} - True if problematic numbering detected
     */
    static hasMixedOrProblematicNumbering(text) {
        // Check for repeated numbers (like multiple 1.)
        const standardNumbers = (text.match(/(?:^|\n)\s*(\d+)\./g) || []);
        const parenthesisNumbers = (text.match(/(?:^|\n)\s*\((\d+)\)/g) || []);
        const colonNumbers = (text.match(/(?:^|\n)\s*(\d+):/g) || []);
        const dashNumbers = (text.match(/(?:^|\n)\s*(\d+)\s*[-–—]/g) || []);
        const parenNumbers = (text.match(/(?:^|\n)\s*(\d+)\)/g) || []);

        const totalNumberedItems = standardNumbers.length + parenthesisNumbers.length +
            colonNumbers.length + dashNumbers.length + parenNumbers.length;

        // If we have multiple different formats, it's mixed
        const formatCount = [standardNumbers, parenthesisNumbers, colonNumbers, dashNumbers, parenNumbers]
            .filter(arr => arr.length > 0).length;

        if (formatCount > 1) {
            return true; // Mixed formats
        }

        // Check for repeated numbers in any format
        if (standardNumbers.length > 0) {
            const numbers = standardNumbers.map(match => parseInt(match.match(/\d+/)[0]));
            const uniqueNumbers = new Set(numbers);
            if (uniqueNumbers.size < numbers.length) {
                return true; // Repeated numbers
            }

            // Check if not sequential starting from 1
            const sortedNumbers = [...numbers].sort((a, b) => a - b);
            if (sortedNumbers[0] !== 1 || !sortedNumbers.every((num, idx) => num === idx + 1)) {
                return true; // Not sequential
            }
        }

        // Check for numbers with line breaks immediately after (like "1.\nText")
        if (/(?:^|\n)\s*\d+\.\s*\n/.test(text)) {
            return true; // Number with immediate line break
        }

        return false;
    }

    /**
     * Extract content blocks that should be numbered points
     * @param {string} text - Cleaned text
     * @returns {Array} - Array of content blocks
     */
    static extractContentBlocks(text) {
        // Strategy 1: Look for existing numbered patterns (any format)
        const numberedBlocks = this.extractExistingNumberedBlocks(text);
        if (numberedBlocks.length > 0) {
            return numberedBlocks;
        }

        // Strategy 2: Look for mixed numbering patterns in a single pass
        const mixedBlocks = this.extractMixedNumberingBlocks(text);
        if (mixedBlocks.length > 0) {
            return mixedBlocks;
        }

        // Strategy 3: Look for paragraph-based structure
        const paragraphBlocks = this.extractParagraphBlocks(text);
        if (paragraphBlocks.length > 0) {
            return paragraphBlocks;
        }

        // Strategy 4: Look for sentence-based structure
        const sentenceBlocks = this.extractSentenceBlocks(text);
        if (sentenceBlocks.length > 0) {
            return sentenceBlocks;
        }

        return [];
    }

    /**
     * Extract existing numbered blocks
     * @param {string} text - Text to analyze
     * @returns {Array} - Array of numbered blocks
     */
    static extractExistingNumberedBlocks(text) {
        const allBlocks = [];

        // Comprehensive regex patterns for different numbering formats
        const patterns = [
            {
                regex: /(?:^|\n)\s*(\d+)\.\s*([^\n]*(?:\n(?!\s*\d+[\.\)\:\-])[^\n]*)*)/g,
                name: '1. format'
            },
            {
                regex: /(?:^|\n)\s*(\d+)\)\s*([^\n]*(?:\n(?!\s*\d+[\.\)\:\-])[^\n]*)*)/g,
                name: '1) format'
            },
            {
                regex: /(?:^|\n)\s*\((\d+)\)\s*([^\n]*(?:\n(?!\s*[\(\d])[^\n]*)*)/g,
                name: '(1) format'
            },
            {
                regex: /(?:^|\n)\s*(\d+):\s*([^\n]*(?:\n(?!\s*\d+[\.\)\:\-])[^\n]*)*)/g,
                name: '1: format'
            },
            {
                regex: /(?:^|\n)\s*(\d+)\s*[-–—]\s*([^\n]*(?:\n(?!\s*\d+\s*[-–—])[^\n]*)*)/g,
                name: '1 - format'
            }
        ];

        // Try each pattern and collect all matches
        for (const pattern of patterns) {
            let match;
            const patternRegex = new RegExp(pattern.regex.source, pattern.regex.flags);

            while ((match = patternRegex.exec(text)) !== null) {
                const number = parseInt(match[1]);
                const content = match[2].trim();

                if (content.length > 5) { // Minimum content length
                    allBlocks.push({
                        originalNumber: number,
                        content: content,
                        startIndex: match.index,
                        endIndex: match.index + match[0].length,
                        fullMatch: match[0],
                        pattern: pattern.name
                    });
                }
            }
        }

        if (allBlocks.length === 0) {
            return [];
        }

        // Sort by position and remove overlaps
        allBlocks.sort((a, b) => a.startIndex - b.startIndex);

        const nonOverlappingBlocks = [];
        let lastEndIndex = -1;

        for (const block of allBlocks) {
            if (block.startIndex >= lastEndIndex) {
                nonOverlappingBlocks.push(block);
                lastEndIndex = block.endIndex;
            }
        }

        return nonOverlappingBlocks;
    }

    /**
     * Extract blocks with mixed numbering formats in a single pass
     * @param {string} text - Text to analyze
     * @returns {Array} - Array of mixed numbered blocks
     */
    static extractMixedNumberingBlocks(text) {
        // Single comprehensive regex that captures any numbering format
        const mixedPattern = /(?:^|\n)\s*(?:(\d+)[\.\)\:\-]|\((\d+)\))\s*([^\n]*(?:\n(?!\s*(?:\d+[\.\)\:\-]|\(\d+\)))[^\n]*)*)/g;

        const blocks = [];
        let match;

        while ((match = mixedPattern.exec(text)) !== null) {
            const number = parseInt(match[1] || match[2]);
            const content = match[3].trim();

            if (content.length > 5) {
                blocks.push({
                    originalNumber: number,
                    content: content,
                    startIndex: match.index,
                    endIndex: match.index + match[0].length,
                    fullMatch: match[0]
                });
            }
        }

        return blocks.sort((a, b) => a.startIndex - b.startIndex);
    }

    /**
     * Extract paragraph-based blocks
     * @param {string} text - Text to analyze
     * @returns {Array} - Array of paragraph blocks
     */
    static extractParagraphBlocks(text) {
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 20);

        if (paragraphs.length < 2 || paragraphs.length > 15) {
            return []; // Not suitable for paragraph-based numbering
        }

        return paragraphs.map((paragraph, index) => ({
            originalNumber: index + 1,
            content: paragraph.trim(),
            startIndex: 0,
            fullMatch: paragraph
        }));
    }

    /**
     * Extract sentence-based blocks for long continuous text
     * @param {string} text - Text to analyze
     * @returns {Array} - Array of sentence blocks
     */
    static extractSentenceBlocks(text) {
        // Look for sentences that could be main points
        const sentences = text.match(/[^.!?]+[.!?]+/g);

        if (!sentences || sentences.length < 2) {
            return [];
        }

        // Group sentences into logical blocks
        const blocks = [];
        let currentBlock = '';
        let sentenceCount = 0;

        for (const sentence of sentences) {
            const trimmed = sentence.trim();
            if (trimmed.length < 10) continue;

            currentBlock += (currentBlock ? ' ' : '') + trimmed;
            sentenceCount++;

            // Create a block every 2-4 sentences or when we hit a natural break
            if (sentenceCount >= 2 && (sentenceCount >= 4 || this.isNaturalBreak(trimmed))) {
                blocks.push({
                    originalNumber: blocks.length + 1,
                    content: currentBlock.trim(),
                    startIndex: 0,
                    fullMatch: currentBlock
                });

                currentBlock = '';
                sentenceCount = 0;
            }
        }

        // Add remaining content as final block
        if (currentBlock.trim().length > 20) {
            blocks.push({
                originalNumber: blocks.length + 1,
                content: currentBlock.trim(),
                startIndex: 0,
                fullMatch: currentBlock
            });
        }

        return blocks.length >= 2 && blocks.length <= 10 ? blocks : [];
    }

    /**
     * Check if a sentence represents a natural break point
     * @param {string} sentence - Sentence to check
     * @returns {boolean} - True if natural break
     */
    static isNaturalBreak(sentence) {
        const breakIndicators = [
            'however', 'furthermore', 'additionally', 'moreover', 'consequently',
            'therefore', 'meanwhile', 'subsequently', 'nevertheless', 'nonetheless'
        ];

        const lowerSentence = sentence.toLowerCase();
        return breakIndicators.some(indicator => lowerSentence.includes(indicator));
    }

    /**
     * Create numbered format from unstructured text
     * @param {string} text - Text to format
     * @returns {string} - Formatted text
     */
    static createNumberedFormat(text) {
        // Split text into logical chunks
        const chunks = text.split(/\n\s*\n/).filter(chunk => chunk.trim().length > 20);

        if (chunks.length === 0) {
            // Single block of text - create one numbered point
            return `1. ${text.trim()}`;
        }

        if (chunks.length === 1) {
            // Single paragraph - try to split by sentences
            const sentences = chunks[0].match(/[^.!?]+[.!?]+/g);
            if (sentences && sentences.length >= 2) {
                return sentences.map((sentence, index) =>
                    `${index + 1}. ${sentence.trim()}`
                ).join('\n\n');
            } else {
                return `1. ${chunks[0].trim()}`;
            }
        }

        // Multiple chunks - number them
        return chunks.map((chunk, index) =>
            `${index + 1}. ${chunk.trim()}`
        ).join('\n\n');
    }

    /**
     * Apply perfect numbering format to content blocks
     * @param {Array} blocks - Content blocks
     * @returns {string} - Perfectly formatted text
     */
    static applyPerfectFormat(blocks) {
        if (blocks.length === 0) {
            return '';
        }

        const formattedBlocks = blocks.map((block, index) => {
            const number = index + 1;
            let content = block.content.trim();

            // Ensure content doesn't start with old numbering
            content = content.replace(/^\d+[\.\)\:\-\s]+/, '');
            content = content.replace(/^\(\d+\)\s*/, '');

            // Split content into first sentence and rest
            const sentences = content.match(/^([^.!?]*[.!?])\s*(.*)/s);

            if (sentences && sentences[1] && sentences[2]) {
                const firstSentence = sentences[1].trim();
                const restOfContent = sentences[2].trim();

                if (restOfContent.length > 0) {
                    return `${number}. ${firstSentence}\n${restOfContent}`;
                } else {
                    return `${number}. ${firstSentence}`;
                }
            } else {
                // No clear sentence structure, use as is
                return `${number}. ${content}`;
            }
        });

        return formattedBlocks.join('\n\n');
    }

    /**
     * Final validation and cleanup
     * @param {string} text - Formatted text
     * @returns {string} - Final validated text
     */
    static finalValidation(text) {
        // Ensure proper spacing between numbered points
        let validated = text.replace(/(\d+\.\s[^\n]+)\n+(\d+\.)/g, '$1\n\n$2');

        // Ensure no triple line breaks
        validated = validated.replace(/\n{3,}/g, '\n\n');

        // Ensure each numbered point starts on a new line
        validated = validated.replace(/([^\n])\n(\d+\.)/g, '$1\n\n$2');

        // Final trim
        validated = validated.trim();

        return validated;
    }

    /**
     * Emergency format for when all else fails
     * @param {string} text - Original text
     * @returns {string} - Emergency formatted text
     */
    static emergencyFormat(text) {
        // Last resort: just add "1. " to the beginning if it doesn't have numbering
        const trimmed = text.trim();

        if (!/^\d+[\.\)\:\-]/.test(trimmed)) {
            return `1. ${trimmed}`;
        }

        return trimmed;
    }

    /**
     * Validate that text has proper numbering format
     * @param {string} text - Text to validate
     * @returns {boolean} - True if properly formatted
     */
    static isProperlyFormatted(text) {
        if (!text || typeof text !== 'string') {
            return false;
        }

        // Check for sequential numbering starting with 1
        const numberMatches = text.match(/(?:^|\n)(\d+)\./g);

        if (!numberMatches || numberMatches.length === 0) {
            return false;
        }

        // Extract numbers and check sequence
        const numbers = numberMatches.map(match =>
            parseInt(match.replace(/(?:^|\n)(\d+)\./, '$1'))
        );

        // Should start with 1 and be sequential
        for (let i = 0; i < numbers.length; i++) {
            if (numbers[i] !== i + 1) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get statistics about the numbering in text
     * @param {string} text - Text to analyze
     * @returns {Object} - Statistics
     */
    static getNumberingStats(text) {
        if (!text || typeof text !== 'string') {
            return {
                hasNumbering: false,
                totalPoints: 0,
                isSequential: false,
                numbers: []
            };
        }

        const numberMatches = text.match(/(?:^|\n)(\d+)\./g);

        if (!numberMatches) {
            return {
                hasNumbering: false,
                totalPoints: 0,
                isSequential: false,
                numbers: []
            };
        }

        const numbers = numberMatches.map(match =>
            parseInt(match.replace(/(?:^|\n)(\d+)\./, '$1'))
        );

        const isSequential = numbers.every((num, index) => num === index + 1);

        return {
            hasNumbering: true,
            totalPoints: numbers.length,
            isSequential: isSequential,
            numbers: numbers
        };
    }

    /**
     * Force perfect format - nuclear option
     * @param {string} text - Text to force format
     * @returns {string} - Force formatted text
     */
    static forceFormat(text) {
        if (!text || typeof text !== 'string') {
            return text;
        }

        // Step 1: Split text into logical sections based on numbered patterns
        // This improved approach handles mixed content better
        const sections = [];
        const lines = text.split('\n');
        let currentSection = '';
        let inNumberedContent = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Check if this line starts with a number pattern
            const isNumberedLine = /^\s*(?:\d+[\.\)\:\-]|\(\d+\))\s*/.test(line);

            if (isNumberedLine) {
                // If we have accumulated content, save it as a section
                if (currentSection.trim().length > 5) {
                    sections.push(currentSection.trim());
                }

                // Start new section with this numbered line (remove the number)
                currentSection = line.replace(/^\s*(?:\d+[\.\)\:\-]|\(\d+\))\s*/, '');
                inNumberedContent = true;
            } else if (line.length > 0) {
                // Add non-empty lines to current section
                if (currentSection.length > 0) {
                    currentSection += '\n' + line;
                } else {
                    currentSection = line;
                }
            } else if (inNumberedContent && currentSection.trim().length > 0) {
                // Empty line - if we have content, it might be end of section
                // But continue accumulating in case there's more content
                currentSection += '\n';
            }
        }

        // Don't forget the last section
        if (currentSection.trim().length > 5) {
            sections.push(currentSection.trim());
        }

        // Step 2: If no sections found, try paragraph-based approach
        if (sections.length === 0) {
            // Remove any stray numbering and split by paragraphs
            let cleaned = text.replace(/(?:^|\n)\s*(?:\d+[\.\)\:\-]|\(\d+\))\s*/g, ' ');
            const paragraphs = cleaned.split(/\n\s*\n/).filter(p => p.trim().length > 10);

            if (paragraphs.length === 0) {
                return `1. ${text.trim()}`;
            }

            return paragraphs.map((paragraph, index) => {
                const trimmed = paragraph.trim().replace(/\s+/g, ' ');
                return `${index + 1}. ${trimmed}`;
            }).join('\n\n');
        }

        // Step 3: Apply perfect numbering to extracted sections
        return sections.map((section, index) => {
            // Clean up the content while preserving internal structure
            const cleaned = section.replace(/\s+/g, ' ').trim();

            // Split into first sentence and rest for proper formatting
            const sentences = cleaned.match(/^([^.!?]*[.!?])\s*(.*)/s);

            if (sentences && sentences[1] && sentences[2]) {
                const firstSentence = sentences[1].trim();
                const restOfContent = sentences[2].trim();

                if (restOfContent.length > 0) {
                    return `${index + 1}. ${firstSentence}\n${restOfContent}`;
                } else {
                    return `${index + 1}. ${firstSentence}`;
                }
            } else {
                return `${index + 1}. ${cleaned}`;
            }
        }).join('\n\n');
    }
}

module.exports = NumberingProcessor;