/**
 * NumberingProcessor - Utility class for fixing numbering issues in AI-generated text
 * Handles detection and correction of inconsistent numbering patterns
 */

class NumberingProcessor {
    /**
     * Fix numbering issues in AI-generated text
     * @param {string} text - The text to process
     * @returns {string} - Text with corrected numbering
     */
    static fixNumbering(text) {
        if (!text || typeof text !== 'string') {
            return text;
        }

        try {
            // First, try to extract numbered points
            let numberedPoints = this.extractNumberedPoints(text);

            // If no numbered points found, try to add numbering to content that should be numbered
            if (numberedPoints.length === 0) {
                const addedNumbering = this.addMissingNumbering(text);
                if (addedNumbering !== text) {
                    return addedNumbering;
                }
                return text;
            }

            // If only one point, ensure it starts with "1."
            if (numberedPoints.length === 1) {
                if (parseInt(numberedPoints[0].originalNumber) !== 1) {
                    return this.applySequentialNumbering(text, numberedPoints);
                }
                return text;
            }

            // Check if text has numbering issues
            if (!this.hasNumberingIssues(text)) {
                return text;
            }

            // Apply sequential numbering
            const fixedText = this.applySequentialNumbering(text, numberedPoints);

            // Validate the fix
            if (this.validateFix(text, fixedText)) {
                return fixedText;
            } else {
                console.warn('NumberingProcessor: Fix validation failed, returning original text');
                return text;
            }
        } catch (error) {
            console.warn('NumberingProcessor: Error fixing numbering, returning original text:', error.message);
            return text;
        }
    }

    /**
     * Detect if text has numbering issues
     * @param {string} text - The text to analyze
     * @returns {boolean} - True if numbering issues are detected
     */
    static hasNumberingIssues(text) {
        if (!text || typeof text !== 'string') {
            return false;
        }

        const numberedPoints = this.extractNumberedPoints(text);

        if (numberedPoints.length < 2) {
            return false; // Need at least 2 points to have numbering issues
        }

        // Check for repeated numbers (like multiple "1.")
        const numbers = numberedPoints.map(point => parseInt(point.originalNumber));
        const uniqueNumbers = new Set(numbers);

        // If we have repeated numbers, there's an issue
        if (uniqueNumbers.size < numbers.length) {
            return true;
        }

        // Check if numbering is not sequential (1, 2, 3, ...)
        const expectedSequence = Array.from({ length: numbers.length }, (_, i) => i + 1);
        const isSequential = numbers.every((num, index) => num === expectedSequence[index]);

        return !isSequential;
    }

    /**
     * Extract numbered points from text
     * @param {string} text - The text to analyze
     * @returns {Array} - Array of numbered points with their content
     */
    static extractNumberedPoints(text) {
        // Multiple patterns to catch different numbering formats
        const patterns = [
            /(^|\n)\s*(\d+)\.\s+/g,           // Standard: "1. "
            /(^|\n)\s*(\d+)\)\s+/g,           // Parenthesis: "1) "
            /(^|\n)\s*\((\d+)\)\s+/g,         // Enclosed: "(1) "
            /(^|\n)\s*(\d+):\s+/g,            // Colon: "1: "
            /(^|\n)\s*(\d+)\s*[-–—]\s+/g      // Dash: "1 - " or "1 – " or "1 — "
        ];

        const points = [];
        const allMatches = [];

        // Try each pattern
        for (const pattern of patterns) {
            let match;
            const currentPattern = new RegExp(pattern.source, pattern.flags);

            while ((match = currentPattern.exec(text)) !== null) {
                allMatches.push({
                    fullMatch: match[0],
                    number: match[2],
                    startIndex: match.index,
                    matchLength: match[0].length,
                    pattern: pattern.source
                });
            }
        }

        // Sort matches by position and remove duplicates
        allMatches.sort((a, b) => a.startIndex - b.startIndex);
        const uniqueMatches = [];
        let lastEndIndex = -1;

        for (const match of allMatches) {
            if (match.startIndex >= lastEndIndex) {
                uniqueMatches.push(match);
                lastEndIndex = match.startIndex + match.matchLength;
            }
        }

        // Process each match to extract content
        for (let i = 0; i < uniqueMatches.length; i++) {
            const currentMatch = uniqueMatches[i];
            const nextMatch = uniqueMatches[i + 1];

            // Calculate content boundaries
            const contentStart = currentMatch.startIndex + currentMatch.matchLength;
            const contentEnd = nextMatch ? nextMatch.startIndex : text.length;

            // Extract the content of this point
            const content = text.substring(contentStart, contentEnd).trim();

            // Skip if content is too short (likely not a real point)
            if (content.length < 5) {
                continue;
            }

            points.push({
                originalNumber: currentMatch.number,
                correctedNumber: null, // Will be set later
                content: content,
                startIndex: currentMatch.startIndex,
                endIndex: contentEnd,
                fullMatch: currentMatch.fullMatch
            });
        }

        return points;
    }

    /**
     * Apply sequential numbering to the text
     * @param {string} text - The original text
     * @param {Array} numberedPoints - Array of numbered points
     * @returns {string} - Text with corrected numbering
     */
    static applySequentialNumbering(text, numberedPoints) {
        let result = text;
        let offset = 0; // Track changes in text length due to replacements

        // Process points in reverse order to maintain correct indices
        for (let i = numberedPoints.length - 1; i >= 0; i--) {
            const point = numberedPoints[i];
            const correctNumber = i + 1;

            // Only replace if the number is different
            if (parseInt(point.originalNumber) !== correctNumber) {
                const oldPattern = point.fullMatch;
                const newPattern = oldPattern.replace(/\d+/, correctNumber.toString());

                const startPos = point.startIndex + offset;
                const endPos = startPos + oldPattern.length;

                result = result.substring(0, startPos) + newPattern + result.substring(endPos);

                // Update offset for next replacements
                offset += newPattern.length - oldPattern.length;
            }
        }

        return result;
    }

    /**
     * Validate that the numbering fix was successful
     * @param {string} originalText - The original text
     * @param {string} fixedText - The text after numbering fix
     * @returns {boolean} - True if the fix was successful
     */
    static validateFix(originalText, fixedText) {
        try {
            const originalPoints = this.extractNumberedPoints(originalText);
            const fixedPoints = this.extractNumberedPoints(fixedText);

            // Should have the same number of points
            if (originalPoints.length !== fixedPoints.length) {
                return false;
            }

            // Fixed text should not have numbering issues
            if (this.hasNumberingIssues(fixedText)) {
                return false;
            }

            // Content should be preserved (ignoring numbering changes)
            for (let i = 0; i < originalPoints.length; i++) {
                if (originalPoints[i].content !== fixedPoints[i].content) {
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.warn('NumberingProcessor: Error validating fix:', error.message);
            return false;
        }
    }

    /**
     * Get statistics about numbering issues in text
     * @param {string} text - The text to analyze
     * @returns {Object} - Statistics about numbering
     */
    static getNumberingStats(text) {
        if (!text || typeof text !== 'string') {
            return {
                hasNumbering: false,
                totalPoints: 0,
                hasIssues: false,
                issueTypes: []
            };
        }

        const points = this.extractNumberedPoints(text);
        const hasNumbering = points.length > 0;
        const hasIssues = this.hasNumberingIssues(text);
        const issueTypes = [];

        if (hasIssues && points.length > 1) {
            const numbers = points.map(point => parseInt(point.originalNumber));
            const uniqueNumbers = new Set(numbers);

            // Check for repeated numbers
            if (uniqueNumbers.size < numbers.length) {
                issueTypes.push('repeated_numbers');
            }

            // Check for non-sequential numbering
            const expectedSequence = Array.from({ length: numbers.length }, (_, i) => i + 1);
            const isSequential = numbers.every((num, index) => num === expectedSequence[index]);

            if (!isSequential) {
                issueTypes.push('non_sequential');
            }
        }

        return {
            hasNumbering,
            totalPoints: points.length,
            hasIssues,
            issueTypes,
            numbers: points.map(p => parseInt(p.originalNumber))
        };
    }

    /**
     * Add numbering to content that appears to be a list but lacks numbers
     * @param {string} text - The text to analyze
     * @returns {string} - Text with added numbering if appropriate
     */
    static addMissingNumbering(text) {
        if (!text || typeof text !== 'string') {
            return text;
        }

        // Look for patterns that suggest this should be a numbered list
        const listPatterns = [
            /^(.+?)(?:\n\n|\n)(.+?)(?:\n\n|\n)(.+)/s,  // Multiple paragraphs
            /^(.{50,}?)\.(?:\s|\n)(.{50,}?)\.(?:\s|\n)(.{50,})/s,  // Sentences that could be points
        ];

        // Check if text looks like it should be numbered but isn't
        const lines = text.split('\n').filter(line => line.trim().length > 20);

        // If we have 2-10 substantial lines, they might need numbering
        if (lines.length >= 2 && lines.length <= 10) {
            // Check if lines don't already start with numbers
            const hasNumbers = lines.some(line => /^\s*\d+[\.\)\:\-]/.test(line));

            if (!hasNumbers) {
                // Check if lines seem like separate points (start with capital letter, etc.)
                const seemsLikePoints = lines.filter(line => {
                    const trimmed = line.trim();
                    return trimmed.length > 20 && /^[A-Z]/.test(trimmed);
                }).length >= 2;

                if (seemsLikePoints) {
                    // Add numbering to each line
                    const numberedLines = lines.map((line, index) => {
                        const trimmed = line.trim();
                        return `${index + 1}. ${trimmed}`;
                    });

                    return numberedLines.join('\n\n');
                }
            }
        }

        return text; // Return original if no numbering should be added
    }
}

module.exports = NumberingProcessor;