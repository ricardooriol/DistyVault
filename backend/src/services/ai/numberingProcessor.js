/**
 * NumberingProcessor - Bulletproof utility for enforcing perfect numbering format
 * Ensures ALL AI outputs follow the exact format: "1. Sentence\nParagraph\n\n2. Sentence\nParagraph"
 * 
 * NEW: Now supports HTML formatting with proper bold main sentences and safe HTML output
 * 
 * Key Features:
 * - Converts numbered text to HTML with <strong> tags for main sentences
 * - Comprehensive XSS protection and HTML sanitization
 * - Validates HTML structure and numbering sequence
 * - Handles malformed input with multiple fallback strategies
 * - Performance optimized for large content processing
 */

class NumberingProcessor {
    /**
     * Fix numbering issues and format as HTML - BULLETPROOF VERSION
     * @param {string} text - The text to process
     * @returns {string} - HTML formatted text with perfect numbering
     */
    static fixNumberingAsHTML(text) {
        if (!text || typeof text !== 'string') {
            return text;
        }

        try {
            // Step 1: Fix numbering using existing logic
            let processedText = this.fixNumbering(text);

            // Step 2: Convert to HTML format
            let htmlContent = this.formatAsHTML(processedText);

            // Step 3: Validate HTML format
            if (!this.validateHTMLFormat(htmlContent)) {
                console.warn('NumberingProcessor: HTML validation failed, applying force format with HTML');
                // Try force format with HTML output
                htmlContent = this.forceFormat(text, true);
                
                // Final validation
                if (!this.validateHTMLFormat(htmlContent)) {
                    console.warn('NumberingProcessor: Force format HTML also failed, using emergency HTML format');
                    htmlContent = this.emergencyHTMLFormat(text);
                }
            }

            return htmlContent;

        } catch (error) {
            console.warn('NumberingProcessor: Error in fixNumberingAsHTML, applying emergency format:', error.message);
            return this.emergencyHTMLFormat(text);
        }
    }

    /**
     * Emergency HTML format for when all else fails
     * @param {string} text - Original text
     * @returns {string} - Emergency HTML formatted text
     */
    static emergencyHTMLFormat(text) {
        if (!text || typeof text !== 'string') {
            return text;
        }

        const escapedText = this.escapeHTML(text.trim());
        
        // Check if text already has some numbering
        if (/^\d+[\.\)\:\-]/.test(text.trim())) {
            return `<p><strong>${escapedText}</strong></p>`;
        } else {
            return `<p><strong>1. ${escapedText}</strong></p>`;
        }
    }

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

        // Check for inline numbering (numbers appearing in the middle of text after periods)
        // This catches cases like "sentence. 2. next sentence" or "sentence.2. next sentence"
        const inlineNumbers = (text.match(/\.\s*\d+\./g) || []);
        if (inlineNumbers.length > 0) {
            console.log('Detected inline numbering:', inlineNumbers);
            return true; // Inline numbering detected
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
            const lines = content.split('\n');
            const firstLine = lines[0].trim();

            // Try to find a sentence ending in the first line
            const sentenceMatch = firstLine.match(/^([^.!?]*[.!?])/);

            if (sentenceMatch) {
                // First line has a sentence ending, use that as the main sentence
                const firstSentence = sentenceMatch[1].trim();
                const remainingFirstLine = firstLine.substring(sentenceMatch[0].length).trim();
                const restOfLines = lines.slice(1).join('\n').trim();

                let restOfContent = '';
                if (remainingFirstLine.length > 0) {
                    restOfContent = remainingFirstLine;
                }
                if (restOfLines.length > 0) {
                    restOfContent = restOfContent.length > 0 ? restOfContent + '\n' + restOfLines : restOfLines;
                }

                if (restOfContent.length > 0) {
                    return `${number}. ${firstSentence}\n${restOfContent}`;
                } else {
                    return `${number}. ${firstSentence}`;
                }
            } else {
                // No sentence ending in first line, use entire first line as main sentence
                if (lines.length > 1) {
                    const restOfLines = lines.slice(1).join('\n').trim();
                    if (restOfLines.length > 0) {
                        return `${number}. ${firstLine}\n${restOfLines}`;
                    } else {
                        return `${number}. ${firstLine}`;
                    }
                } else {
                    // Single line
                    return `${number}. ${content}`;
                }
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
     * Format processed text as HTML with proper bold formatting
     * @param {string} text - Processed text with proper numbering
     * @returns {string} - HTML formatted text
     */
    static formatAsHTML(text) {
        if (!text || typeof text !== 'string') {
            return text;
        }

        try {
            // Split text into numbered points
            const points = text.split(/\n\n+/).filter(point => point.trim().length > 0);
            
            const htmlPoints = points.map(point => {
                const lines = point.trim().split('\n');
                const firstLine = lines[0].trim();
                
                // Extract number and main sentence from first line
                const numberMatch = firstLine.match(/^(\d+)\.\s*(.+)$/);
                
                if (numberMatch) {
                    const number = numberMatch[1];
                    const mainSentence = numberMatch[2];
                    const explanation = lines.slice(1).join(' ').trim(); // Join with spaces, not newlines
                    
                    return this.createHTMLNumberedPoint(number, mainSentence, explanation);
                } else {
                    // Fallback for malformed points
                    return `<p>${this.escapeHTML(point)}</p>`;
                }
            });
            
            // Join with proper HTML spacing to create double line break between numbered points
            return htmlPoints.join('\n\n<br>\n\n');
            
        } catch (error) {
            console.warn('NumberingProcessor: Error in formatAsHTML, returning escaped text:', error.message);
            return `<p>${this.escapeHTML(text)}</p>`;
        }
    }

    /**
     * Create HTML structure for a numbered point
     * @param {string} number - The point number
     * @param {string} mainSentence - The main sentence
     * @param {string} explanation - The explanation text
     * @returns {string} - HTML formatted numbered point
     */
    static createHTMLNumberedPoint(number, mainSentence, explanation) {
        const escapedMainSentence = this.escapeHTML(mainSentence);
        const boldMainSentence = `<strong>${number}. ${escapedMainSentence}</strong>`;
        
        if (explanation && explanation.length > 0) {
            const escapedExplanation = this.escapeHTML(explanation);
            // Create separate paragraphs: bold main sentence, then explanation
            // This creates the format: "1. Bold sentence\nExplanation\n\n2. Next bold sentence"
            return `<p>${boldMainSentence}</p>\n<p>${escapedExplanation}</p>`;
        } else {
            return `<p>${boldMainSentence}</p>`;
        }
    }

    /**
     * Validate HTML format for safety and structure
     * @param {string} html - HTML to validate
     * @returns {boolean} - True if HTML is valid and safe
     */
    static validateHTMLFormat(html) {
        if (!html || typeof html !== 'string') {
            return false;
        }

        try {
            // Check for basic HTML structure
            if (!html.includes('<p>') && !html.includes('<strong>')) {
                return false;
            }

            // Check for proper strong tag pairing
            const strongOpenTags = (html.match(/<strong>/g) || []).length;
            const strongCloseTags = (html.match(/<\/strong>/g) || []).length;
            
            if (strongOpenTags !== strongCloseTags) {
                console.warn('NumberingProcessor: Unmatched strong tags detected');
                return false;
            }

            // Check for proper p tag pairing
            const pOpenTags = (html.match(/<p>/g) || []).length;
            const pCloseTags = (html.match(/<\/p>/g) || []).length;
            
            if (pOpenTags !== pCloseTags) {
                console.warn('NumberingProcessor: Unmatched p tags detected');
                return false;
            }

            // Enhanced security validation - check for dangerous content
            if (!this.isHTMLSafe(html)) {
                console.warn('NumberingProcessor: Unsafe HTML content detected');
                return false;
            }

            // Check for proper numbering structure
            if (!this.hasValidNumberingStructure(html)) {
                console.warn('NumberingProcessor: Invalid numbering structure in HTML');
                return false;
            }

            return true;
            
        } catch (error) {
            console.warn('NumberingProcessor: Error validating HTML format:', error.message);
            return false;
        }
    }

    /**
     * Check if HTML content is safe from XSS and other security threats
     * @param {string} html - HTML to check
     * @returns {boolean} - True if HTML is safe
     */
    static isHTMLSafe(html) {
        // Comprehensive list of dangerous patterns
        const dangerousPatterns = [
            // Script tags and JavaScript
            /<script[\s\S]*?<\/script>/gi,
            /<script[^>]*>/gi,
            /javascript:/gi,
            /vbscript:/gi,
            /data:text\/html/gi,
            
            // Event handlers
            /on\w+\s*=/gi,
            /onclick/gi,
            /onload/gi,
            /onerror/gi,
            /onmouseover/gi,
            
            // Dangerous tags
            /<iframe[\s\S]*?<\/iframe>/gi,
            /<iframe[^>]*>/gi,
            /<object[\s\S]*?<\/object>/gi,
            /<object[^>]*>/gi,
            /<embed[\s\S]*?<\/embed>/gi,
            /<embed[^>]*>/gi,
            /<form[\s\S]*?<\/form>/gi,
            /<form[^>]*>/gi,
            /<input[^>]*>/gi,
            /<textarea[\s\S]*?<\/textarea>/gi,
            /<select[\s\S]*?<\/select>/gi,
            /<button[\s\S]*?<\/button>/gi,
            
            // Meta and link tags that could be dangerous
            /<meta[^>]*>/gi,
            /<link[^>]*>/gi,
            /<style[\s\S]*?<\/style>/gi,
            
            // Base64 encoded content that might be malicious
            /data:image\/svg\+xml/gi,
            
            // Expression and behavior (IE specific)
            /expression\s*\(/gi,
            /behavior\s*:/gi,
            
            // Import statements
            /@import/gi
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(html)) {
                return false;
            }
        }

        // Check for only allowed tags
        const allowedTags = ['p', 'strong', 'br'];
        const tagMatches = html.match(/<\/?(\w+)[^>]*>/g) || [];
        
        for (const tagMatch of tagMatches) {
            const tagName = tagMatch.match(/<\/?(\w+)/)[1].toLowerCase();
            if (!allowedTags.includes(tagName)) {
                console.warn(`NumberingProcessor: Disallowed tag detected: ${tagName}`);
                return false;
            }
        }

        return true;
    }

    /**
     * Check if HTML has valid numbering structure
     * @param {string} html - HTML to check
     * @returns {boolean} - True if numbering structure is valid
     */
    static hasValidNumberingStructure(html) {
        // Extract numbered points from HTML
        const numberedMatches = html.match(/<strong>(\d+)\./g);
        
        if (!numberedMatches || numberedMatches.length === 0) {
            return false;
        }

        // Extract numbers and check sequence
        const numbers = numberedMatches.map(match => {
            const numberMatch = match.match(/(\d+)/);
            return numberMatch ? parseInt(numberMatch[1]) : 0;
        });

        // Should start with 1 and be sequential
        for (let i = 0; i < numbers.length; i++) {
            if (numbers[i] !== i + 1) {
                return false;
            }
        }

        return true;
    }

    /**
     * Sanitize HTML content by removing dangerous elements
     * @param {string} html - HTML to sanitize
     * @returns {string} - Sanitized HTML
     */
    static sanitizeHTML(html) {
        if (!html || typeof html !== 'string') {
            return html;
        }

        let sanitized = html;

        // Remove dangerous patterns
        const dangerousPatterns = [
            /<script[\s\S]*?<\/script>/gi,
            /<script[^>]*>/gi,
            /javascript:/gi,
            /vbscript:/gi,
            /<iframe[\s\S]*?<\/iframe>/gi,
            /<iframe[^>]*>/gi,
            /<object[\s\S]*?<\/object>/gi,
            /<embed[\s\S]*?<\/embed>/gi,
            /<form[\s\S]*?<\/form>/gi,
            /<input[^>]*>/gi,
            /<meta[^>]*>/gi,
            /<link[^>]*>/gi,
            /<style[\s\S]*?<\/style>/gi
        ];

        for (const pattern of dangerousPatterns) {
            sanitized = sanitized.replace(pattern, '');
        }

        // Remove event handlers from allowed tags
        sanitized = sanitized.replace(/\s+on\w+\s*=[^>]*/gi, '');

        // Remove any remaining disallowed tags, keeping only p, strong, and br
        sanitized = sanitized.replace(/<(?!\/?(?:p|strong|br)\b)[^>]*>/gi, '');

        return sanitized;
    }

    /**
     * Escape HTML special characters for safety
     * @param {string} text - Text to escape
     * @returns {string} - HTML escaped text
     */
    static escapeHTML(text) {
        if (!text || typeof text !== 'string') {
            return text;
        }

        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    /**
     * Force perfect format - nuclear option
     * @param {string} text - Text to force format
     * @param {boolean} htmlOutput - Whether to return HTML formatted output
     * @returns {string} - Force formatted text (plain text or HTML)
     */
    static forceFormat(text, htmlOutput = false) {
        if (!text || typeof text !== 'string') {
            return text;
        }

        // BULLETPROOF APPROACH: Handle both line-based and inline numbered patterns
        let sections = [];
        
        // First, check if we have inline numbering (numbers in continuous text)
        const hasInlineNumbers = /\.\s*\d+\./g.test(text);
        
        if (hasInlineNumbers) {
            console.log('Detected inline numbering, using inline splitting approach');
            
            // For inline numbering, split by number patterns that appear after sentence endings
            const parts = text.split(/(\d+\.\s+)/);
            
            let currentSection = '';
            
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                
                // If this part is a number pattern (like "2. ")
                if (/^\d+\.\s+$/.test(part)) {
                    // Save the previous section if it has content
                    if (currentSection.trim().length > 5) {
                        sections.push(currentSection.trim());
                    }
                    currentSection = ''; // Start new section
                } else {
                    // This is content, add it to current section
                    currentSection += part;
                }
            }
            
            // Don't forget the last section
            if (currentSection.trim().length > 5) {
                sections.push(currentSection.trim());
            }
        } else {
            // Use the original approach for line-based numbering
            const numberedSections = text.split(/(?=(?:^|\n)\s*\d+[\.\)\:\-])/);
            
            for (let i = 0; i < numberedSections.length; i++) {
                const section = numberedSections[i].trim();

                if (section.length === 0) continue;

                // Remove the number from the beginning if it exists
                const cleanedSection = section.replace(/^\s*\d+[\.\)\:\-]\s*/, '').trim();

                // Only include sections with substantial content
                if (cleanedSection.length > 5) {
                    sections.push(cleanedSection);
                }
            }
        }

        // If no numbered sections found, try splitting by double line breaks
        if (sections.length === 0) {
            const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 10);

            if (paragraphs.length === 0) {
                const singlePoint = `1. ${text.trim()}`;
                return htmlOutput ? this.formatAsHTML(singlePoint) : singlePoint;
            }

            const result = paragraphs.map((paragraph, index) => {
                const cleaned = paragraph.trim().replace(/^\s*\d+[\.\)\:\-]\s*/, '');
                return `${index + 1}. ${cleaned}`;
            }).join('\n\n');
            
            return htmlOutput ? this.formatAsHTML(result) : result;
        }

        // Apply sequential numbering to all sections
        const result = sections.map((section, index) => {
            const number = index + 1;

            // Split into first sentence and rest for proper formatting
            const lines = section.split('\n');
            const firstLine = lines[0].trim();

            // Try to find a sentence ending in the first line
            const sentenceMatch = firstLine.match(/^([^.!?]*[.!?])/);

            if (sentenceMatch) {
                // First line has a sentence ending, use that as the main sentence
                const firstSentence = sentenceMatch[1].trim();
                const remainingFirstLine = firstLine.substring(sentenceMatch[0].length).trim();
                const restOfLines = lines.slice(1).join('\n').trim();

                let restOfContent = '';
                if (remainingFirstLine.length > 0) {
                    restOfContent = remainingFirstLine;
                }
                if (restOfLines.length > 0) {
                    restOfContent = restOfContent.length > 0 ? restOfContent + '\n' + restOfLines : restOfLines;
                }

                if (restOfContent.length > 0) {
                    return `${number}. ${firstSentence}\n${restOfContent}`;
                } else {
                    return `${number}. ${firstSentence}`;
                }
            } else {
                // No sentence ending in first line, use entire first line as main sentence
                if (lines.length > 1) {
                    const restOfLines = lines.slice(1).join('\n').trim();
                    if (restOfLines.length > 0) {
                        return `${number}. ${firstLine}\n${restOfLines}`;
                    } else {
                        return `${number}. ${firstLine}`;
                    }
                } else {
                    // Single line - need to split into main sentence and explanation
                    // Find the first sentence ending
                    const sentenceEndMatch = section.match(/^([^.!?]*[.!?])/);
                    if (sentenceEndMatch) {
                        const mainSentence = sentenceEndMatch[1].trim();
                        const explanation = section.substring(sentenceEndMatch[0].length).trim();
                        
                        if (explanation.length > 0) {
                            return `${number}. ${mainSentence}\n${explanation}`;
                        } else {
                            return `${number}. ${mainSentence}`;
                        }
                    } else {
                        // No sentence ending found, use the whole section as main sentence
                        return `${number}. ${section}`;
                    }
                }
            }
        }).join('\n\n');

        // Return HTML formatted result if requested
        return htmlOutput ? this.formatAsHTML(result) : result;
    }
}

module.exports = NumberingProcessor;