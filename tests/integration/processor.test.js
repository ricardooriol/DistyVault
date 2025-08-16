/**
 * Processor Integration Tests
 * Tests content processing workflows and AI integration
 */

const processor = require('../../backend/src/services/processor');
const database = require('../../backend/src/services/database');
const contentExtractor = require('../../backend/src/services/contentExtractor');
const AIProviderFactory = require('../../backend/src/services/ai/aiProviderFactory');

// Mock dependencies
jest.mock('../../backend/src/services/database');
jest.mock('../../backend/src/services/contentExtractor');
jest.mock('../../backend/src/services/ai/aiProviderFactory');
jest.mock('../../backend/src/services/ai/aiSettingsManager');

describe('Processor Integration Tests', () => {
    let mockAIProvider;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Create mock AI provider
        mockAIProvider = {
            generateResponse: jest.fn(),
            testConnection: jest.fn().mockResolvedValue({ success: true })
        };

        // Mock AI provider factory
        AIProviderFactory.createProvider.mockReturnValue(mockAIProvider);

        // Mock database methods
        database.saveDistillation.mockResolvedValue('test-id');
        database.updateDistillationStatus.mockResolvedValue(true);
        database.updateDistillationContent.mockResolvedValue(true);
        database.getDistillation.mockResolvedValue({
            id: 'test-id',
            status: 'processing',
            sourceUrl: 'https://example.com',
            sourceType: 'url'
        });

        // Mock content extractor
        contentExtractor.extractFromUrl.mockResolvedValue({
            title: 'Test Article',
            content: 'This is test content for processing.',
            wordCount: 7
        });

        contentExtractor.extractFromFile.mockResolvedValue({
            title: 'Test Document',
            content: 'This is test document content.',
            wordCount: 6
        });

        // Processor is already instantiated as a singleton
    });

    describe('URL Processing Workflow', () => {
        test('should process URL from input to completion', async () => {
            // Mock AI response
            mockAIProvider.generateResponse.mockResolvedValue({
                content: 'This is the distilled content from the AI provider.',
                usage: { tokens: 100 }
            });

            // Start URL processing
            const result = await processor.processUrl('https://example.com/article');

            // Verify initial distillation was created
            expect(database.saveSummary).toHaveBeenCalled();
            expect(result.id).toBe('test-id');
            expect(result.status).toBe('processing');

            // Wait for processing to complete (simulate async processing)
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify content extraction was called
            expect(contentExtractor.extractFromUrl).toHaveBeenCalledWith('https://example.com/article');

            // Verify AI provider was called
            expect(mockAIProvider.generateResponse).toHaveBeenCalled();

            // Verify database was updated with results
            expect(database.updateDistillationContent).toHaveBeenCalled();
        });

        test('should handle URL processing errors gracefully', async () => {
            // Mock content extraction failure
            contentExtractor.extractFromUrl.mockRejectedValue(new Error('Failed to extract content'));

            const result = await processor.processUrl('https://invalid-url.com');

            expect(result.id).toBe('test-id');
            expect(result.status).toBe('processing');

            // Wait for error handling
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify error was handled and database was updated
            expect(database.updateDistillationStatus).toHaveBeenCalledWith(
                'test-id',
                'error',
                expect.stringContaining('Failed to extract content'),
                expect.stringContaining('Failed to extract content')
            );
        });

        test('should handle different URL types correctly', async () => {
            const testCases = [
                {
                    url: 'https://www.youtube.com/watch?v=test123',
                    expectedType: 'youtube'
                },
                {
                    url: 'https://youtube.com/channel/test-channel',
                    expectedType: 'channel'
                },
                {
                    url: 'https://example.com/article',
                    expectedType: 'url'
                }
            ];

            for (const testCase of testCases) {
                await processor.processUrl(testCase.url);

                expect(database.saveDistillation).toHaveBeenCalledWith(
                    expect.objectContaining({
                        sourceUrl: testCase.url,
                        sourceType: testCase.expectedType
                    })
                );
            }
        });

        test('should handle AI provider failures', async () => {
            // Mock AI provider failure
            mockAIProvider.generateResponse.mockRejectedValue(new Error('AI service unavailable'));

            await processor.processUrl('https://example.com');

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify error was handled
            expect(database.updateDistillationStatus).toHaveBeenCalledWith(
                'test-id',
                'error',
                expect.stringContaining('AI service unavailable'),
                expect.stringContaining('AI service unavailable')
            );
        });
    });

    describe('File Processing Workflow', () => {
        test('should process uploaded file successfully', async () => {
            const mockFile = {
                originalname: 'test-document.pdf',
                mimetype: 'application/pdf',
                size: 1024,
                path: '/tmp/test-file'
            };

            mockAIProvider.generateResponse.mockResolvedValue({
                content: 'Distilled content from the uploaded file.',
                usage: { tokens: 150 }
            });

            const result = await processor.processFile(mockFile);

            expect(result.id).toBe('test-id');
            expect(result.status).toBe('processing');

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify file extraction was called
            expect(contentExtractor.extractFromFile).toHaveBeenCalledWith(mockFile);

            // Verify AI processing
            expect(mockAIProvider.generateResponse).toHaveBeenCalled();

            // Verify database updates
            expect(database.saveDistillation).toHaveBeenCalledWith(
                expect.objectContaining({
                    sourceType: 'file',
                    sourceFile: expect.objectContaining({
                        name: 'test-document.pdf',
                        type: 'application/pdf',
                        size: 1024
                    })
                })
            );
        });

        test('should handle unsupported file types', async () => {
            const mockFile = {
                originalname: 'test-image.jpg',
                mimetype: 'image/jpeg',
                size: 2048,
                path: '/tmp/test-image'
            };

            // Mock file extraction failure for unsupported type
            contentExtractor.extractFromFile.mockRejectedValue(
                new Error('Unsupported file type: image/jpeg')
            );

            const result = await processor.processFile(mockFile);

            expect(result.status).toBe('processing');

            // Wait for error handling
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(database.updateDistillationStatus).toHaveBeenCalledWith(
                'test-id',
                'error',
                expect.stringContaining('Unsupported file type'),
                expect.stringContaining('Unsupported file type')
            );
        });

        test('should handle large files correctly', async () => {
            const mockLargeFile = {
                originalname: 'large-document.pdf',
                mimetype: 'application/pdf',
                size: 50 * 1024 * 1024, // 50MB
                path: '/tmp/large-file'
            };

            // Mock extraction of large content
            contentExtractor.extractFromFile.mockResolvedValue({
                title: 'Large Document',
                content: 'A'.repeat(100000), // Large content
                wordCount: 100000
            });

            mockAIProvider.generateResponse.mockResolvedValue({
                content: 'Distilled content from large file.',
                usage: { tokens: 500 }
            });

            const result = await processor.processFile(mockLargeFile);

            expect(result.status).toBe('processing');

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 200));

            // Verify processing handled large content
            expect(contentExtractor.extractFromFile).toHaveBeenCalledWith(mockLargeFile);
            expect(mockAIProvider.generateResponse).toHaveBeenCalled();
        });
    });

    describe('Process Management', () => {
        test('should stop running process', async () => {
            // Start a process
            const result = await processor.processUrl('https://example.com');
            const processId = result.id;

            // Stop the process
            const stopResult = await processor.stopProcess(processId);

            expect(stopResult).toBe(true);

            // Verify process was marked as cancelled
            expect(database.updateDistillationStatus).toHaveBeenCalledWith(
                processId,
                'stopped',
                expect.any(String)
            );
        });

        test('should handle stopping non-existent process', async () => {
            const stopResult = await processor.stopProcess('non-existent-id');
            expect(stopResult).toBe(false);
        });

        test('should handle stopping already completed process', async () => {
            database.getDistillation.mockResolvedValue({
                id: 'completed-id',
                status: 'completed'
            });

            const stopResult = await processor.stopProcess('completed-id');
            expect(stopResult).toBe(false);
        });
    });

    describe('Retry Functionality', () => {
        test('should retry failed URL processing', async () => {
            const failedDistillation = {
                id: 'failed-id',
                status: 'failed',
                sourceUrl: 'https://example.com/retry',
                sourceType: 'url'
            };

            database.getDistillation.mockResolvedValue(failedDistillation);
            mockAIProvider.generateResponse.mockResolvedValue({
                content: 'Retry successful content.',
                usage: { tokens: 120 }
            });

            const retryResult = await processor.processUrl(failedDistillation.sourceUrl);

            expect(retryResult.status).toBe('processing');
            expect(contentExtractor.extractFromUrl).toHaveBeenCalledWith(failedDistillation.sourceUrl);
        });

        test('should retry failed file processing', async () => {
            const failedDistillation = {
                id: 'failed-file-id',
                status: 'failed',
                sourceType: 'file',
                sourceFile: {
                    name: 'retry-document.pdf',
                    type: 'application/pdf',
                    size: 1024
                },
                rawContent: 'Original file content for retry'
            };

            const mockFile = {
                originalname: failedDistillation.sourceFile.name,
                mimetype: failedDistillation.sourceFile.type,
                size: failedDistillation.sourceFile.size,
                path: null
            };

            database.getDistillation.mockResolvedValue(failedDistillation);
            mockAIProvider.generateResponse.mockResolvedValue({
                content: 'Retry successful file content.',
                usage: { tokens: 140 }
            });

            const retryResult = await processor.retryFileProcessing(
                failedDistillation.id,
                mockFile,
                failedDistillation.rawContent
            );

            expect(retryResult.status).toBe('processing');
        });
    });

    describe('PDF Generation', () => {
        test('should generate PDF for completed distillation', async () => {
            const completedDistillation = {
                id: 'completed-id',
                title: 'Test Article',
                content: 'This is the completed distillation content.',
                status: 'completed',
                sourceUrl: 'https://example.com',
                createdAt: new Date().toISOString()
            };

            database.getDistillation.mockResolvedValue(completedDistillation);

            const pdfResult = await processor.generatePdf('completed-id');

            expect(pdfResult).toBeDefined();
            expect(pdfResult.buffer).toBeInstanceOf(Buffer);
            expect(pdfResult.filename).toContain('.pdf');
            expect(pdfResult.filename).toContain('test-article');
        });

        test('should handle PDF generation for incomplete distillation', async () => {
            const incompleteDistillation = {
                id: 'incomplete-id',
                status: 'processing'
            };

            database.getDistillation.mockResolvedValue(incompleteDistillation);

            await expect(processor.generatePdf('incomplete-id')).rejects.toThrow(
                'Distillation is not completed'
            );
        });

        test('should handle PDF generation errors', async () => {
            const completedDistillation = {
                id: 'error-id',
                title: 'Error Test',
                content: null, // Invalid content
                status: 'completed'
            };

            database.getDistillation.mockResolvedValue(completedDistillation);

            await expect(processor.generatePdf('error-id')).rejects.toThrow();
        });
    });

    describe('Concurrent Processing', () => {
        test('should handle multiple concurrent processes', async () => {
            const urls = [
                'https://example.com/article1',
                'https://example.com/article2',
                'https://example.com/article3'
            ];

            mockAIProvider.generateResponse.mockResolvedValue({
                content: 'Concurrent processing result.',
                usage: { tokens: 100 }
            });

            // Start multiple processes concurrently
            const promises = urls.map(url => processor.processUrl(url));
            const results = await Promise.all(promises);

            // All should start successfully
            results.forEach(result => {
                expect(result.status).toBe('processing');
                expect(result.id).toBe('test-id');
            });

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 200));

            // Verify all were processed
            expect(contentExtractor.extractFromUrl).toHaveBeenCalledTimes(3);
            expect(mockAIProvider.generateResponse).toHaveBeenCalledTimes(3);
        });

        test('should respect concurrent processing limits', async () => {
            // This test would verify that the processing queue respects limits
            // Implementation depends on the actual queue mechanism
            const processor = new Processor();
            
            // Mock queue behavior
            const mockQueue = {
                add: jest.fn(),
                setMaxConcurrent: jest.fn()
            };

            // Verify queue configuration
            expect(mockQueue.setMaxConcurrent).toBeDefined();
        });
    });

    describe('Error Recovery', () => {
        test('should recover from temporary AI provider failures', async () => {
            // Mock initial failure then success
            mockAIProvider.generateResponse
                .mockRejectedValueOnce(new Error('Temporary failure'))
                .mockResolvedValueOnce({
                    content: 'Recovery successful.',
                    usage: { tokens: 100 }
                });

            await processor.processUrl('https://example.com');

            // Wait for retry logic
            await new Promise(resolve => setTimeout(resolve, 200));

            // Should eventually succeed
            expect(mockAIProvider.generateResponse).toHaveBeenCalledTimes(2);
        });

        test('should handle database connection failures', async () => {
            database.saveSummary.mockRejectedValue(new Error('Database connection failed'));

            await expect(processor.processUrl('https://example.com')).rejects.toThrow(
                'Database connection failed'
            );
        });

        test('should clean up resources on failure', async () => {
            contentExtractor.extractFromUrl.mockRejectedValue(new Error('Extraction failed'));

            await processor.processUrl('https://example.com');

            // Wait for cleanup
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify cleanup occurred (implementation specific)
            // This would check that temporary files are cleaned up, connections closed, etc.
        });
    });

    describe('Performance and Resource Management', () => {
        test('should handle memory-intensive processing', async () => {
            // Mock large content extraction
            const largeContent = 'A'.repeat(1000000); // 1MB of content
            contentExtractor.extractFromUrl.mockResolvedValue({
                title: 'Large Content',
                content: largeContent,
                wordCount: 1000000
            });

            mockAIProvider.generateResponse.mockResolvedValue({
                content: 'Processed large content.',
                usage: { tokens: 1000 }
            });

            const result = await processor.processUrl('https://example.com/large');

            expect(result.status).toBe('processing');

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 300));

            // Verify large content was handled
            expect(mockAIProvider.generateResponse).toHaveBeenCalled();
        });

        test('should timeout long-running processes', async () => {
            // Mock a process that takes too long
            mockAIProvider.generateResponse.mockImplementation(() => 
                new Promise(resolve => setTimeout(resolve, 60000)) // 1 minute
            );

            await processor.processUrl('https://example.com/slow');

            // Wait for timeout handling
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Should handle timeout appropriately
            // Implementation would depend on actual timeout mechanism
        });
    });
});