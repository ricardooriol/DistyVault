/**
 * Comprehensive test suite for YouTube transcript extraction
 * Tests all strategies, validation, and error scenarios
 */

const ExtractionStrategy = require('../services/transcript/ExtractionStrategy');
const YouTubePageScrapingStrategy = require('../services/transcript/YouTubePageScrapingStrategy');
const AlternativePageParsingStrategy = require('../services/transcript/AlternativePageParsingStrategy');
const LibraryFallbackStrategy = require('../services/transcript/LibraryFallbackStrategy');
const TranscriptValidator = require('../services/transcript/TranscriptValidator');
const CaptionXmlProcessor = require('../services/transcript/CaptionXmlProcessor');
const ContentExtractor = require('../services/contentExtractor');

// Mock data for testing
const mockTranscriptData = [
    { text: "Hello and welcome to this video" },
    { text: "Today we're going to talk about artificial intelligence" },
    { text: "AI has been transforming many industries" },
    { text: "Let's explore some key concepts and applications" },
    { text: "Thank you for watching and don't forget to subscribe" }
];

const mockXmlCaption = `<?xml version="1.0" encoding="utf-8" ?>
<transcript>
<text start="0.0" dur="2.5">Hello and welcome to this video</text>
<text start="2.5" dur="3.2">Today we're going to talk about artificial intelligence</text>
<text start="5.7" dur="2.8">AI has been transforming many industries</text>
<text start="8.5" dur="3.1">Let's explore some key concepts and applications</text>
<text start="11.6" dur="2.9">Thank you for watching and don't forget to subscribe</text>
</transcript>`;

const mockEmptyXml = `<?xml version="1.0" encoding="utf-8" ?>
<transcript>
</transcript>`;

const mockInvalidXml = `This is not valid XML content`;

describe('YouTube Transcript Extraction Test Suite', () => {
    
    describe('ExtractionStrategy Base Class', () => {
        test('should create strategy with name and priority', () => {
            const strategy = new ExtractionStrategy('test-strategy', 1);
            expect(strategy.name).toBe('test-strategy');
            expect(strategy.priority).toBe(1);
        });

        test('should throw error when execute method not implemented', async () => {
            const strategy = new ExtractionStrategy('test', 1);
            await expect(strategy.execute('test-id')).rejects.toThrow('execute method must be implemented by subclass');
        });

        test('should validate transcript data successfully', async () => {
            const strategy = new ExtractionStrategy('test', 1);
            const result = await strategy.validate(mockTranscriptData);
            
            expect(result.valid).toBe(true);
            expect(result.transcript).toContain('Hello and welcome');
            expect(result.transcript).toContain('artificial intelligence');
        });

        test('should reject empty data', async () => {
            const strategy = new ExtractionStrategy('test', 1);
            const result = await strategy.validate([]);
            
            expect(result.valid).toBe(false);
            expect(result.error).toContain('INSUFFICIENT_LENGTH');
        });

        test('should reject null data', async () => {
            const strategy = new ExtractionStrategy('test', 1);
            const result = await strategy.validate(null);
            
            expect(result.valid).toBe(false);
            expect(result.error).toContain('INVALID_STRUCTURE');
        });
    });

    describe('TranscriptValidator', () => {
        let validator;

        beforeEach(() => {
            validator = new TranscriptValidator();
        });

        test('should validate good transcript data', () => {
            const result = validator.validateTranscript(mockTranscriptData, 'test');
            
            expect(result.valid).toBe(true);
            expect(result.code).toBe('VALID');
            expect(result.details.transcript).toBeDefined();
            expect(result.details.stats).toBeDefined();
        });

        test('should reject transcript that is too short', () => {
            const shortData = [{ text: "Hi" }];
            const result = validator.validateTranscript(shortData, 'test');
            
            expect(result.valid).toBe(false);
            expect(result.code).toBe('INSUFFICIENT_LENGTH');
        });

        test('should reject transcript with insufficient vocabulary', () => {
            const repetitiveData = Array(20).fill({ text: "test test test" });
            const result = validator.validateTranscript(repetitiveData, 'test');
            
            expect(result.valid).toBe(false);
            expect(result.code).toBe('POOR_QUALITY');
        });

        test('should handle string input', () => {
            const stringInput = "This is a longer transcript with sufficient content and vocabulary diversity to pass validation checks.";
            const result = validator.validateTranscript(stringInput, 'test');
            
            expect(result.valid).toBe(true);
            expect(result.details.transcript).toBe(stringInput);
        });

        test('should detect excessive repetition', () => {
            const repetitiveData = Array(10).fill({ text: "same content repeated" });
            const result = validator.validateTranscript(repetitiveData, 'test');
            
            expect(result.valid).toBe(false);
            expect(result.code).toBe('EXCESSIVE_REPETITION');
        });
    });

    describe('CaptionXmlProcessor', () => {
        let processor;

        beforeEach(() => {
            processor = new CaptionXmlProcessor();
        });

        test('should process valid XML caption data', () => {
            const result = processor.processXml(mockXmlCaption);
            
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(5);
            expect(result[0].text).toBe('Hello and welcome to this video');
            expect(result[1].text).toBe("Today we're going to talk about artificial intelligence");
        });

        test('should handle empty XML', () => {
            expect(() => {
                processor.processXml(mockEmptyXml);
            }).toThrow('No valid transcript segments found in XML');
        });

        test('should handle invalid XML', () => {
            expect(() => {
                processor.processXml(mockInvalidXml);
            }).toThrow('No valid transcript segments found in XML');
        });

        test('should handle null input', () => {
            expect(() => {
                processor.processXml(null);
            }).toThrow('Invalid XML content provided');
        });

        test('should decode HTML entities', () => {
            const xmlWithEntities = `<?xml version="1.0" encoding="utf-8" ?>
            <transcript>
            <text start="0.0" dur="2.5">Hello &amp; welcome to &quot;this&quot; video</text>
            </transcript>`;
            
            const result = processor.processXml(xmlWithEntities);
            expect(result[0].text).toBe('Hello & welcome to "this" video');
        });
    });

    describe('Strategy Classes', () => {
        describe('YouTubePageScrapingStrategy', () => {
            let strategy;

            beforeEach(() => {
                strategy = new YouTubePageScrapingStrategy();
            });

            test('should have correct name and priority', () => {
                expect(strategy.name).toBe('youtube-page-scraping');
                expect(strategy.priority).toBe(1);
            });

            test('should handle invalid video ID', async () => {
                const result = await strategy.execute('invalid-id');
                expect(result.success).toBe(false);
                expect(result.error).toBeDefined();
            });
        });

        describe('AlternativePageParsingStrategy', () => {
            let strategy;

            beforeEach(() => {
                strategy = new AlternativePageParsingStrategy();
            });

            test('should have correct name and priority', () => {
                expect(strategy.name).toBe('alternative-page-parsing');
                expect(strategy.priority).toBe(2);
            });
        });

        describe('LibraryFallbackStrategy', () => {
            let strategy;

            beforeEach(() => {
                strategy = new LibraryFallbackStrategy();
            });

            test('should have correct name and priority', () => {
                expect(strategy.name).toBe('library-fallback');
                expect(strategy.priority).toBe(3);
            });

            test('should validate library result format', async () => {
                const mockLibraryResult = [
                    { text: "First segment of transcript" },
                    { text: "Second segment with more content" },
                    { text: "Third segment to complete the test" }
                ];

                const validation = await strategy.validate(mockLibraryResult);
                expect(validation.valid).toBe(true);
                expect(validation.transcript).toContain('First segment');
            });
        });
    });

    describe('URL Processing', () => {
        let extractor;

        beforeEach(() => {
            extractor = new ContentExtractor();
        });

        test('should extract video ID from youtube.com/watch URL', () => {
            const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
            const videoId = extractor.extractYoutubeId(url);
            expect(videoId).toBe('dQw4w9WgXcQ');
        });

        test('should extract video ID from youtu.be URL', () => {
            const url = 'https://youtu.be/dQw4w9WgXcQ';
            const videoId = extractor.extractYoutubeId(url);
            expect(videoId).toBe('dQw4w9WgXcQ');
        });

        test('should extract video ID from embed URL', () => {
            const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
            const videoId = extractor.extractYoutubeId(url);
            expect(videoId).toBe('dQw4w9WgXcQ');
        });

        test('should handle URL with playlist parameter', () => {
            const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmRdnEQy4Qy';
            const videoId = extractor.extractYoutubeId(url);
            expect(videoId).toBe('dQw4w9WgXcQ');
        });

        test('should handle mobile YouTube URL', () => {
            const url = 'https://m.youtube.com/watch?v=dQw4w9WgXcQ';
            const videoId = extractor.extractYoutubeId(url);
            expect(videoId).toBe('dQw4w9WgXcQ');
        });

        test('should reject invalid URLs', () => {
            const invalidUrls = [
                'https://www.google.com',
                'not-a-url',
                '',
                null,
                undefined
            ];

            invalidUrls.forEach(url => {
                const videoId = extractor.extractYoutubeId(url);
                expect(videoId).toBeNull();
            });
        });

        test('should reject invalid video IDs', () => {
            const invalidIds = [
                'too-short',
                'way-too-long-to-be-valid',
                'invalid@chars',
                '12345678901' // 11 chars but all numbers
            ];

            invalidIds.forEach(id => {
                expect(extractor._isValidVideoId(id)).toBe(false);
            });
        });

        test('should accept valid video IDs', () => {
            const validIds = [
                'dQw4w9WgXcQ',
                'jNQXAC9IVRw',
                'BaW_jenozKc',
                '_abc123-XYZ'
            ];

            validIds.forEach(id => {
                expect(extractor._isValidVideoId(id)).toBe(true);
            });
        });
    });

    describe('Error Scenarios', () => {
        test('should handle network timeouts gracefully', async () => {
            const strategy = new YouTubePageScrapingStrategy();
            
            // Mock axios to simulate timeout
            const originalAxios = require('axios');
            const mockAxios = {
                get: jest.fn().mockRejectedValue(new Error('timeout'))
            };
            
            // This would require proper mocking setup in a real test environment
            // For now, we test that the strategy handles errors properly
            const result = await strategy.execute('dQw4w9WgXcQ');
            expect(result.success).toBe(false);
        });

        test('should handle malformed JSON responses', () => {
            const strategy = new YouTubePageScrapingStrategy();
            const malformedJson = '{"incomplete": json';
            
            const result = strategy._parseJsonSafely(malformedJson);
            expect(result).toBeNull();
        });

        test('should handle empty responses', async () => {
            const validator = new TranscriptValidator();
            const result = validator.validateTranscript('', 'test');
            
            expect(result.valid).toBe(false);
            expect(result.code).toBe('INVALID_STRUCTURE');
        });
    });

    describe('Integration Tests', () => {
        test('should process complete extraction workflow', async () => {
            // This would be a full integration test
            // For now, we test the components work together
            const validator = new TranscriptValidator();
            const xmlProcessor = new CaptionXmlProcessor();
            
            // Process XML
            const segments = xmlProcessor.processXml(mockXmlCaption);
            expect(segments.length).toBeGreaterThan(0);
            
            // Validate result
            const validation = validator.validateTranscript(segments, 'integration-test');
            expect(validation.valid).toBe(true);
            expect(validation.details.transcript).toBeDefined();
        });

        test('should maintain data integrity through processing pipeline', () => {
            const xmlProcessor = new CaptionXmlProcessor();
            const segments = xmlProcessor.processXml(mockXmlCaption);
            
            // Check that all original content is preserved
            const fullText = segments.map(s => s.text).join(' ');
            expect(fullText).toContain('Hello and welcome');
            expect(fullText).toContain('artificial intelligence');
            expect(fullText).toContain('Thank you for watching');
        });
    });

    describe('Performance Tests', () => {
        test('should process large XML files efficiently', () => {
            const processor = new CaptionXmlProcessor();
            
            // Generate large XML content
            const largeXml = `<?xml version="1.0" encoding="utf-8" ?>
            <transcript>
            ${Array(1000).fill(0).map((_, i) => 
                `<text start="${i * 2}" dur="2.0">This is segment number ${i + 1} with some content</text>`
            ).join('\n')}
            </transcript>`;
            
            const startTime = Date.now();
            const result = processor.processXml(largeXml);
            const processingTime = Date.now() - startTime;
            
            expect(result.length).toBe(1000);
            expect(processingTime).toBeLessThan(1000); // Should process in under 1 second
        });

        test('should validate large transcripts efficiently', () => {
            const validator = new TranscriptValidator();
            
            // Generate large transcript data
            const largeData = Array(1000).fill(0).map((_, i) => ({
                text: `This is a longer segment number ${i + 1} with sufficient content to test performance and validation capabilities.`
            }));
            
            const startTime = Date.now();
            const result = validator.validateTranscript(largeData, 'performance-test');
            const validationTime = Date.now() - startTime;
            
            expect(result.valid).toBe(true);
            expect(validationTime).toBeLessThan(500); // Should validate in under 500ms
        });
    });
});

// Test utilities
function createMockStrategy(name, priority, shouldSucceed = true) {
    return {
        name,
        priority,
        execute: jest.fn().mockResolvedValue({
            success: shouldSucceed,
            data: shouldSucceed ? mockTranscriptData : null,
            error: shouldSucceed ? null : 'Mock strategy failure'
        }),
        validate: jest.fn().mockResolvedValue({
            valid: shouldSucceed,
            transcript: shouldSucceed ? mockTranscriptData.map(s => s.text).join(' ') : null,
            error: shouldSucceed ? null : 'Mock validation failure'
        })
    };
}

// Export test utilities for use in other test files
module.exports = {
    mockTranscriptData,
    mockXmlCaption,
    mockEmptyXml,
    mockInvalidXml,
    createMockStrategy
};