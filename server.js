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
app.use(cors());
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
        
        // Process bulk download request for multiple items
        
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
        const zipFilename = `distillations-${new Date().toISOString().split('T')[0]}.zip`;
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
        
        let successCount = 0;
        let errorCount = 0;
        
        // Process each ID sequentially to avoid overwhelming the system
        for (const id of ids) {
            try {
                // Process individual distillation for bulk download
                
                const distillation = await database.getDistillation(id);
                if (!distillation) {
                    console.warn(`Distillation ${id} not found`);
                    errorCount++;
                    continue;
                }
                
                if (distillation.status !== 'completed') {
                    console.warn(`Distillation ${id} not completed (status: ${distillation.status})`);
                    errorCount++;
                    continue;
                }
                
                // Generate PDF
                const pdfResult = await processor.generatePdf(id);
                
                if (!pdfResult || typeof pdfResult !== 'object') {
                    console.error(`Invalid PDF result for distillation ${id}`);
                    errorCount++;
                    continue;
                }
                
                const { buffer, filename } = pdfResult;
                
                // Convert buffer to Node.js Buffer if needed (Puppeteer returns Uint8Array)
                let finalBuffer;
                if (Buffer.isBuffer(buffer)) {
                    finalBuffer = buffer;
                } else if (buffer instanceof Uint8Array) {
                    finalBuffer = Buffer.from(buffer);
                } else if (buffer && typeof buffer === 'object' && buffer.length !== undefined) {
                    // Handle other array-like objects
                    finalBuffer = Buffer.from(buffer);
                } else {
                    console.error(`Invalid buffer type for distillation ${id}: ${typeof buffer}, isBuffer: ${Buffer.isBuffer(buffer)}`);
                    errorCount++;
                    continue;
                }
                
                if (finalBuffer.length === 0) {
                    console.error(`Empty buffer for distillation ${id}`);
                    errorCount++;
                    continue;
                }
                
                const finalFilename = filename || `distillation-${id}.pdf`;
                
                // Add PDF to ZIP archive
                
                // Add to archive
                archive.append(finalBuffer, { name: finalFilename });
                successCount++;
                
            } catch (error) {
                console.error(`Error processing distillation ${id}:`, error);
                errorCount++;
            }
        }
        
        // Bulk download processing completed
        
        // Finalize the archive (this will trigger the download)
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