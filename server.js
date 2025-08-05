const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Import services
const database = require('./services/database');
const processor = require('./services/processor');
const ollamaService = require('./services/ollama');

const app = express();
const PORT = 3000;

// Configure multer for file uploads
const uploadDir = path.join(__dirname, 'uploads');
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
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.docx', '.txt'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type: ${ext}. Allowed types: ${allowedTypes.join(', ')}`));
        }
    }
});

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use(express.static('public'));

// Import AI settings routes
const aiSettingsRoutes = require('./routes/ai-settings');
app.use('/api', aiSettingsRoutes);

// API Routes
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

// Get all distillations
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

// Get a specific distillation
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

// Process a URL
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

// Process a file
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

// Delete a distillation
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

// Stop a running process
app.post('/api/summaries/:id/stop', async (req, res) => {
    try {
        const success = await processor.stopProcess(req.params.id);
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

// Retry a failed distillation
app.post('/api/summaries/:id/retry', async (req, res) => {
    console.log(`Retry endpoint hit for distillation ID: ${req.params.id}`);
    try {
        console.log('Attempting to get distillation from database...');
        const distillation = await database.getDistillation(req.params.id);
        console.log('Distillation retrieved:', distillation ? 'Found' : 'Not found');

        if (!distillation) {
            console.log('Distillation not found, returning 404');
            return res.status(404).json({
                status: 'error',
                message: 'Distillation not found'
            });
        }

        console.log(`Distillation status: ${distillation.status}`);
        console.log('Distillation sourceUrl:', distillation.sourceUrl);
        console.log('Distillation sourceFile:', distillation.sourceFile);
        console.log('Distillation sourceType:', distillation.sourceType);

        // Allow retrying any distillation (successful or failed)
        console.log(`Retrying distillation with status: ${distillation.status}`);

        // Retry the distillation based on its source type
        let retryResult;

        if ((distillation.sourceType === 'url' || distillation.sourceType === 'youtube' || distillation.sourceType === 'channel') && distillation.sourceUrl) {
            // Retry URL processing
            console.log('Retrying URL processing for:', distillation.sourceUrl);
            retryResult = await processor.processUrl(distillation.sourceUrl);
        } else if (distillation.sourceType === 'file' && distillation.sourceFile) {
            // For file retries, we need to check if we still have the raw content
            if (!distillation.rawContent) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Cannot retry file processing - original file content not available'
                });
            }

            console.log('Retrying file processing for:', distillation.sourceFile.name);

            // Create a mock file object from the stored data
            const mockFile = {
                originalname: distillation.sourceFile.name,
                mimetype: distillation.sourceFile.type,
                size: distillation.sourceFile.size,
                path: null // We'll use rawContent instead
            };

            retryResult = await processor.retryFileProcessing(req.params.id, mockFile, distillation.rawContent);
        } else {
            console.log('Cannot determine retry method. sourceType:', distillation.sourceType, 'sourceUrl:', !!distillation.sourceUrl, 'sourceFile:', !!distillation.sourceFile, 'rawContent:', !!distillation.rawContent);
            return res.status(400).json({
                status: 'error',
                message: 'Cannot determine how to retry this distillation'
            });
        }

        // Delete the old failed distillation
        await database.deleteDistillation(req.params.id);

        res.json({
            status: 'ok',
            message: 'Distillation retry initiated successfully',
            newId: retryResult.id
        });

    } catch (error) {
        console.error('Error retrying distillation:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Download distillation as PDF
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

        // Generate PDF for the requested distillation

        // Generate PDF
        const { buffer, filename } = await processor.generatePdf(req.params.id);

        // Set headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'no-cache');

        // Send PDF buffer
        res.end(buffer, 'binary');

    } catch (error) {
        console.error('PDF generation error:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Bulk download distillations as ZIP
app.post('/api/summaries/bulk-download', async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'IDs array is required'
            });
        }

        // If only one item, redirect to single PDF download
        if (ids.length === 1) {
            const distillation = await database.getDistillation(ids[0]);
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

            const { buffer, filename } = await processor.generatePdf(ids[0]);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', buffer.length);
            res.setHeader('Cache-Control', 'no-cache');

            return res.end(buffer, 'binary');
        }

        // Multiple items - create ZIP
        const archiver = require('archiver');
        const archive = archiver('zip', { zlib: { level: 9 } });

        // Set headers for ZIP download
        const zipFilename = `sawron-download.zip`;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
        res.setHeader('Cache-Control', 'no-cache');

        // Handle archive errors
        archive.on('error', (err) => {
            console.error('Archive error:', err);
            if (!res.headersSent) {
                res.status(500).json({
                    status: 'error',
                    message: 'Failed to create ZIP archive'
                });
            }
        });

        // Pipe archive to response
        archive.pipe(res);

        const usedFilenames = new Set();

        // Process each ID sequentially
        for (const id of ids) {
            try {
                const distillation = await database.getDistillation(id);
                if (!distillation || distillation.status !== 'completed') {
                    console.log(`Skipping distillation ${id} - not found or not completed`);
                    continue;
                }

                // Generate PDF
                const pdfResult = await processor.generatePdf(id);
                const { buffer, filename } = pdfResult;

                // Convert buffer to Node.js Buffer if needed
                let finalBuffer;
                if (Buffer.isBuffer(buffer)) {
                    finalBuffer = buffer;
                } else if (buffer instanceof Uint8Array) {
                    finalBuffer = Buffer.from(buffer);
                } else {
                    finalBuffer = Buffer.from(buffer);
                }

                if (finalBuffer.length === 0) {
                    console.log(`Empty buffer for distillation ${id}, skipping`);
                    continue;
                }

                let finalFilename = filename || `distillation-${id}.pdf`;

                // Handle duplicate filenames
                let counter = 1;
                let uniqueFilename = finalFilename;
                while (usedFilenames.has(uniqueFilename)) {
                    const nameWithoutExt = finalFilename.replace('.pdf', '');
                    uniqueFilename = `${nameWithoutExt}-(${counter}).pdf`;
                    counter++;
                }
                usedFilenames.add(uniqueFilename);

                // Add PDF to ZIP archive
                archive.append(finalBuffer, { name: uniqueFilename });

            } catch (error) {
                console.error(`Error processing distillation ${id}:`, error);
            }
        }

        // Finalize the archive
        archive.finalize();

    } catch (error) {
        console.error('Bulk download error:', error);
        if (!res.headersSent) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    }
});

// Bulk delete distillations
app.post('/api/summaries/bulk-delete', async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'IDs array is required'
            });
        }

        // Process bulk delete request

        let deletedCount = 0;
        const errors = [];

        // Process each ID
        for (const id of ids) {
            try {
                const success = await database.deleteDistillation(id);
                if (success) {
                    deletedCount++;
                } else {
                    errors.push({
                        id: id,
                        error: 'Distillation not found'
                    });
                }
            } catch (error) {
                console.error(`Error deleting distillation ${id}:`, error);
                errors.push({
                    id: id,
                    error: error.message
                });
            }
        }

        // Bulk delete operation completed

        res.json({
            deletedCount: deletedCount,
            errors: errors
        });

    } catch (error) {
        console.error('Bulk delete error:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Cancel individual download
app.post('/api/summaries/:id/cancel-download', async (req, res) => {
    try {
        // For now, just return success since downloads are client-side
        // In a real implementation, you might track server-side download processes
        res.json({
            status: 'ok',
            message: 'Download cancellation requested'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Cancel bulk download
app.post('/api/summaries/cancel-bulk-download', async (req, res) => {
    try {
        // For now, just return success since downloads are client-side
        // In a real implementation, you might track server-side download processes
        res.json({
            status: 'ok',
            message: 'Bulk download cancellation requested'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Search distillations
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

// Main route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        status: 'error',
        message: err.message
    });
});

// Start the Express server
app.listen(PORT, () => {
    console.log(`SAWRON server up and running on http://localhost:${PORT}`);
});