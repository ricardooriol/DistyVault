/**
 * End-to-End Test Suite for DistyVault Application
 * Tests all major functionality from user perspective
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Import the app components
const express = require('express');
const cors = require('cors');
const multer = require('multer');

// Mock services for testing
jest.mock('../../backend/src/services/database');
jest.mock('../../backend/src/services/processor');
jest.mock('../../backend/services/ollama');

const database = require('../../backend/src/services/database');
const processor = require('../../backend/src/services/processor');
const ollamaService = require('../../backend/services/ollama');

describe('DistyVault End-to-End Tests', () => {
    let app;
    let server;

    beforeAll(async () => {
        // Create test app instance
        app = express();
        
        // Configure CORS
        app.use(cors({
            origin: true,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        }));

        app.use(express.json({ limit: '50mb' }));
        app.use(express.urlencoded({ extended: true, limit: '50mb' }));

        // Configure multer for file uploads
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                cb(null, uploadDir);
            },
            filename: (req, file, cb) => {
                cb(null, `${Date.now()}-${file.originalname}`);
            }
        });

        const upload = multer({
            storage,
            limits: { fileSize: 50 * 1024 * 1024 },
            fileFilter: (req, file, cb) => {
                const allowedTypes = ['.pdf', '.docx', '.txt'];
                const ext = path.extname(file.originalname).toLowerCase();
                if (allowedTypes.includes(ext)) {
                    cb(null, true);
                } else {
                    cb(new Error(`Unsupported file type: ${ext}`));
                }
            }
        });

        // Add all routes from server.js
        const aiSettingsRoutes = require('../../backend/routes/ai-settings');
        app.use('/api', aiSettingsRoutes);

        // Health check endpoint
        app.get('/api/health', async (req, res) => {
            try {
                const ollamaAvailable = await ollamaService.checkAvailability();
                res.json({
                    status: 'ok',
                    ollama: ollamaAvailable ? 'available' : 'unavailable'
                });
            } catch (error) {
                res.status(500).json({
                    status: 'error',
                    message: error.message
                });
            }
        });

        // Distillations endpoints
        app.get('/api/summaries', async (req, res) => {
            try {
                const distillations = await database.getAllSummaries();
                res.json(distillations);
            } catch (error) {
                res.status(500).json({
                    status: 'error',
                    message: error.message
                });
            }
        });

        app.get('/api/summaries/:id', async (req, res) => {
            try {
                const distillation = await database.getDistillation(req.params.id);
                if (!distillation) {
                    return res.status(404).json({
                        status: 'error',
                        message: 'Distillation not found'
                    });
                }
                res.json(distillation);
            } catch (error) {
                res.status(500).json({
                    status: 'error',
                    message: error.message
                });
            }
        });

        app.post('/api/process/url', async (req, res) => {
            try {
                const { url } = req.body;
                if (!url) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'URL is required'
                    });
                }
                const distillation = await processor.processUrl(url);
                res.status(202).json(distillation);
            } catch (error) {
                res.status(500).json({
                    status: 'error',
                    message: error.message
                });
            }
        });

        app.post('/api/process/file', upload.single('file'), async (req, res) => {
            try {
                if (!req.file) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'No file uploaded'
                    });
                }
                const distillation = await processor.processFile(req.file);
                res.status(202).json(distillation);
            } catch (error) {
                res.status(500).json({
                    status: 'error',
                    message: error.message
                });
            }
        });

        app.delete('/api/summaries/:id', async (req, res) => {
            try {
                const success = await database.deleteDistillation(req.params.id);
                if (!success) {
                    return res.status(404).json({
                        status: 'error',
                        message: 'Distillation not found'
                    });
                }
                res.json({ status: 'ok' });
            } catch (error) {
                res.status(500).json({
                    status: 'error',
                    message: error.message
                });
            }
        });

        app.post('/api/summaries/:id/stop', async (req, res) => {
            try {
                const success = await processor.stopProcessing(req.params.id);
                if (!success) {
                    return res.status(404).json({
                        status: 'error',
                        message: 'Process not found or already completed'
                    });
                }
                res.json({ status: 'ok' });
            } catch (error) {
                res.status(500).json({
                    status: 'error',
                    message: error.message
                });
            }
        });

        app.post('/api/summaries/:id/retry', async (req, res) => {
            try {
                const distillation = await database.getDistillation(req.params.id);
                if (!distillation) {
                    return res.status(404).json({
                        status: 'error',
                        message: 'Distillation not found'
                    });
                }

                let retryResult;
                if (distillation.sourceType === 'url' && distillation.sourceUrl) {
                    retryResult = await processor.processUrl(distillation.sourceUrl);
                } else if (distillation.sourceType === 'file' && distillation.rawContent) {
                    const mockFile = {
                        originalname: distillation.sourceFile.name,
                        mimetype: distillation.sourceFile.type,
                        size: distillation.sourceFile.size,
                        path: null
                    };
                    retryResult = await processor.retryFileProcessing(req.params.id, mockFile, distillation.rawContent);
                } else {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Cannot determine how to retry this distillation'
                    });
                }

                await database.deleteDistillation(req.params.id);
                res.json({
                    status: 'ok',
                    message: 'Distillation retry initiated successfully',
                    newId: retryResult.id
                });
            } catch (error) {
                res.status(500).json({
                    status: 'error',
                    message: error.message
                });
            }
        });

        app.get('/api/summaries/:id/pdf', async (req, res) => {
            try {
                const distillation = await database.getDistillation(req.params.id);
                if (!distillation) {
                    return res.status(404).json({
                        status: 'error',
                        message: 'Distillation not found'
                    });
                }

                if (distillation.status !== 'completed') {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Distillation is not yet completed'
                    });
                }

                const { buffer, filename } = await processor.generatePdf(req.params.id);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                res.setHeader('Content-Length', buffer.length);
                res.end(buffer, 'binary');
            } catch (error) {
                res.status(500).json({
                    status: 'error',
                    message: error.message
                });
            }
        });

        app.post('/api/summaries/bulk-delete', async (req, res) => {
            try {
                const { ids } = req.body;
                if (!ids || !Array.isArray(ids) || ids.length === 0) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'IDs array is required'
                    });
                }

                let deletedCount = 0;
                const errors = [];

                for (const id of ids) {
                    try {
                        const success = await database.deleteDistillation(id);
                        if (success) {
                            deletedCount++;
                        } else {
                            errors.push({ id, error: 'Distillation not found' });
                        }
                    } catch (error) {
                        errors.push({ id, error: error.message });
                    }
                }

                res.json({ deletedCount, errors });
            } catch (error) {
                res.status(500).json({
                    status: 'error',
                    message: error.message
                });
            }
        });

        app.get('/api/search', async (req, res) => {
            try {
                const { query } = req.query;
                if (!query) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Search query is required'
                    });
                }
                const results = await database.searchSummaries(query);
                res.json(results);
            } catch (error) {
                res.status(500).json({
                    status: 'error',
                    message: error.message
                });
            }
        });

        // Error handler
        app.use((err, req, res, next) => {
            res.status(500).json({
                status: 'error',
                message: err.message
            });
        });
    });

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();
        
        // Setup default mock implementations
        ollamaService.checkAvailability.mockResolvedValue(true);
        database.getAllSummaries.mockResolvedValue([]);
        database.getDistillation.mockResolvedValue(null);
        database.deleteDistillation.mockResolvedValue(true);
        database.searchSummaries.mockResolvedValue([]);
        processor.processUrl = jest.fn().mockResolvedValue({ id: 'test-id', status: 'processing' });
        processor.processFile = jest.fn().mockResolvedValue({ id: 'test-file-id', status: 'processing' });
        processor.stopProcessing = jest.fn().mockResolvedValue(true);
        processor.generatePdf = jest.fn().mockResolvedValue({ buffer: Buffer.from('test pdf'), filename: 'test.pdf' });
        processor.retryFileProcessing = jest.fn().mockResolvedValue({ id: 'retry-id', status: 'processing' });
    });

    describe('Health Check and System Status', () => {
        test('should return system health status', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect(200);

            expect(response.body).toEqual({
                status: 'ok',
                ollama: 'available'
            });
            expect(ollamaService.checkAvailability).toHaveBeenCalled();
        });

        test('should handle health check errors', async () => {
            ollamaService.checkAvailability.mockRejectedValue(new Error('Service unavailable'));

            const response = await request(app)
                .get('/api/health')
                .expect(500);

            expect(response.body).toEqual({
                status: 'error',
                message: 'Service unavailable'
            });
        });
    });

    describe('URL Processing Workflow', () => {
        test('should process URL successfully', async () => {
            const testUrl = 'https://example.com/article';
            const mockDistillation = {
                id: 'url-test-id',
                status: 'processing',
                sourceUrl: testUrl,
                sourceType: 'url'
            };

            processor.processUrl.mockResolvedValue(mockDistillation);

            const response = await request(app)
                .post('/api/process/url')
                .send({ url: testUrl })
                .expect(202);

            expect(response.body).toEqual(mockDistillation);
            expect(processor.processUrl).toHaveBeenCalledWith(testUrl);
        });

        test('should reject URL processing without URL', async () => {
            const response = await request(app)
                .post('/api/process/url')
                .send({})
                .expect(400);

            expect(response.body).toEqual({
                status: 'error',
                message: 'URL is required'
            });
            expect(processor.processUrl).not.toHaveBeenCalled();
        });

        test('should handle URL processing errors', async () => {
            processor.processUrl.mockRejectedValue(new Error('Processing failed'));

            const response = await request(app)
                .post('/api/process/url')
                .send({ url: 'https://example.com' })
                .expect(500);

            expect(response.body).toEqual({
                status: 'error',
                message: 'Processing failed'
            });
        });
    });

    describe('File Upload and Processing', () => {
        test('should process uploaded file successfully', async () => {
            const mockDistillation = {
                id: 'file-test-id',
                status: 'processing',
                sourceType: 'file'
            };

            processor.processFile.mockResolvedValue(mockDistillation);

            // Create a test file buffer
            const testFileContent = 'This is a test document content';
            const testBuffer = Buffer.from(testFileContent);

            const response = await request(app)
                .post('/api/process/file')
                .attach('file', testBuffer, 'test-document.txt')
                .expect(202);

            expect(response.body).toEqual(mockDistillation);
            expect(processor.processFile).toHaveBeenCalled();
        });

        test('should reject file processing without file', async () => {
            const response = await request(app)
                .post('/api/process/file')
                .expect(400);

            expect(response.body).toEqual({
                status: 'error',
                message: 'No file uploaded'
            });
            expect(processor.processFile).not.toHaveBeenCalled();
        });

        test('should handle file processing errors', async () => {
            processor.processFile.mockRejectedValue(new Error('File processing failed'));

            const testBuffer = Buffer.from('test content');
            const response = await request(app)
                .post('/api/process/file')
                .attach('file', testBuffer, 'test.txt')
                .expect(500);

            expect(response.body).toEqual({
                status: 'error',
                message: 'File processing failed'
            });
        });
    });

    describe('Database Operations and Data Persistence', () => {
        test('should retrieve all distillations', async () => {
            const mockDistillations = [
                { id: '1', title: 'Test 1', status: 'completed' },
                { id: '2', title: 'Test 2', status: 'processing' }
            ];

            database.getAllSummaries.mockResolvedValue(mockDistillations);

            const response = await request(app)
                .get('/api/summaries')
                .expect(200);

            expect(response.body).toEqual(mockDistillations);
            expect(database.getAllSummaries).toHaveBeenCalled();
        });

        test('should retrieve specific distillation', async () => {
            const mockDistillation = {
                id: 'test-id',
                title: 'Test Distillation',
                status: 'completed',
                content: 'Test content'
            };

            database.getDistillation.mockResolvedValue(mockDistillation);

            const response = await request(app)
                .get('/api/summaries/test-id')
                .expect(200);

            expect(response.body).toEqual(mockDistillation);
            expect(database.getDistillation).toHaveBeenCalledWith('test-id');
        });

        test('should return 404 for non-existent distillation', async () => {
            database.getDistillation.mockResolvedValue(null);

            const response = await request(app)
                .get('/api/summaries/non-existent')
                .expect(404);

            expect(response.body).toEqual({
                status: 'error',
                message: 'Distillation not found'
            });
        });

        test('should delete distillation successfully', async () => {
            database.deleteDistillation.mockResolvedValue(true);

            const response = await request(app)
                .delete('/api/summaries/test-id')
                .expect(200);

            expect(response.body).toEqual({ status: 'ok' });
            expect(database.deleteDistillation).toHaveBeenCalledWith('test-id');
        });

        test('should handle deletion of non-existent distillation', async () => {
            database.deleteDistillation.mockResolvedValue(false);

            const response = await request(app)
                .delete('/api/summaries/non-existent')
                .expect(404);

            expect(response.body).toEqual({
                status: 'error',
                message: 'Distillation not found'
            });
        });

        test('should perform bulk delete operations', async () => {
            database.deleteDistillation
                .mockResolvedValueOnce(true)  // First ID succeeds
                .mockResolvedValueOnce(false) // Second ID fails (not found)
                .mockResolvedValueOnce(true); // Third ID succeeds

            const response = await request(app)
                .post('/api/summaries/bulk-delete')
                .send({ ids: ['id1', 'id2', 'id3'] })
                .expect(200);

            expect(response.body).toEqual({
                deletedCount: 2,
                errors: [{ id: 'id2', error: 'Distillation not found' }]
            });
        });

        test('should search distillations', async () => {
            const mockResults = [
                { id: '1', title: 'Matching Result', content: 'Contains search term' }
            ];

            database.searchSummaries.mockResolvedValue(mockResults);

            const response = await request(app)
                .get('/api/search?query=test')
                .expect(200);

            expect(response.body).toEqual(mockResults);
            expect(database.searchSummaries).toHaveBeenCalledWith('test');
        });

        test('should require search query', async () => {
            const response = await request(app)
                .get('/api/search')
                .expect(400);

            expect(response.body).toEqual({
                status: 'error',
                message: 'Search query is required'
            });
        });
    });

    describe('Process Management', () => {
        test('should stop running process', async () => {
            processor.stopProcessing.mockResolvedValue(true);

            const response = await request(app)
                .post('/api/summaries/test-id/stop')
                .expect(200);

            expect(response.body).toEqual({ status: 'ok' });
            expect(processor.stopProcessing).toHaveBeenCalledWith('test-id');
        });

        test('should handle stopping non-existent process', async () => {
            processor.stopProcessing.mockResolvedValue(false);

            const response = await request(app)
                .post('/api/summaries/non-existent/stop')
                .expect(404);

            expect(response.body).toEqual({
                status: 'error',
                message: 'Process not found or already completed'
            });
        });

        test('should retry failed distillation', async () => {
            const mockDistillation = {
                id: 'test-id',
                status: 'failed',
                sourceType: 'url',
                sourceUrl: 'https://example.com'
            };

            const mockRetryResult = {
                id: 'new-test-id',
                status: 'processing'
            };

            database.getDistillation.mockResolvedValue(mockDistillation);
            processor.processUrl.mockResolvedValue(mockRetryResult);
            database.deleteDistillation.mockResolvedValue(true);

            const response = await request(app)
                .post('/api/summaries/test-id/retry')
                .expect(200);

            expect(response.body).toEqual({
                status: 'ok',
                message: 'Distillation retry initiated successfully',
                newId: 'new-test-id'
            });

            expect(database.getDistillation).toHaveBeenCalledWith('test-id');
            expect(processor.processUrl).toHaveBeenCalledWith('https://example.com');
            expect(database.deleteDistillation).toHaveBeenCalledWith('test-id');
        });
    });

    describe('PDF Generation and Download', () => {
        test('should generate PDF for completed distillation', async () => {
            const mockDistillation = {
                id: 'test-id',
                status: 'completed',
                title: 'Test Document'
            };

            const mockPdfBuffer = Buffer.from('PDF content');
            const mockFilename = 'test-document.pdf';

            database.getDistillation.mockResolvedValue(mockDistillation);
            processor.generatePdf.mockResolvedValue({
                buffer: mockPdfBuffer,
                filename: mockFilename
            });

            const response = await request(app)
                .get('/api/summaries/test-id/pdf')
                .expect(200);

            expect(response.headers['content-type']).toBe('application/pdf');
            expect(response.headers['content-disposition']).toBe(`attachment; filename="${mockFilename}"`);
            expect(processor.generatePdf).toHaveBeenCalledWith('test-id');
        });

        test('should reject PDF generation for incomplete distillation', async () => {
            const mockDistillation = {
                id: 'test-id',
                status: 'processing',
                title: 'Test Document'
            };

            database.getDistillation.mockResolvedValue(mockDistillation);

            const response = await request(app)
                .get('/api/summaries/test-id/pdf')
                .expect(400);

            expect(response.body).toEqual({
                status: 'error',
                message: 'Distillation is not yet completed'
            });
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors gracefully', async () => {
            database.getAllSummaries.mockRejectedValue(new Error('Database connection failed'));

            const response = await request(app)
                .get('/api/summaries')
                .expect(500);

            expect(response.body).toEqual({
                status: 'error',
                message: 'Database connection failed'
            });
        });

        test('should handle processor errors gracefully', async () => {
            processor.processUrl.mockRejectedValue(new Error('AI service unavailable'));

            const response = await request(app)
                .post('/api/process/url')
                .send({ url: 'https://example.com' })
                .expect(500);

            expect(response.body).toEqual({
                status: 'error',
                message: 'AI service unavailable'
            });
        });
    });
});