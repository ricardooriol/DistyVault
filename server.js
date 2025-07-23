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

// Get all summaries
app.get('/api/summaries', async (req, res) => {
    try {
        const summaries = await database.getAllSummaries();
        res.json(summaries);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Get a specific summary
app.get('/api/summaries/:id', async (req, res) => {
    try {
        const summary = await database.getSummary(req.params.id);
        if (!summary) {
            return res.status(404).json({
                status: 'error',
                message: 'Summary not found'
            });
        }
        res.json(summary);
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
        
        const summary = await processor.processUrl(url);
        res.status(202).json(summary);
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
        
        const summary = await processor.processFile(req.file);
        res.status(202).json(summary);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Delete a summary
app.delete('/api/summaries/:id', async (req, res) => {
    try {
        const success = await database.deleteSummary(req.params.id);
        if (!success) {
            return res.status(404).json({
                status: 'error',
                message: 'Summary not found'
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

// Download summary as PDF
app.get('/api/summaries/:id/pdf', async (req, res) => {
    try {
        const summary = await database.getSummary(req.params.id);
        if (!summary) {
            return res.status(404).json({
                status: 'error',
                message: 'Summary not found'
            });
        }
        
        if (summary.status !== 'completed') {
            return res.status(400).json({
                status: 'error',
                message: 'Summary is not yet completed'
            });
        }
        
        // TODO: Implement PDF generation
        res.status(501).json({
            status: 'error',
            message: 'PDF generation not yet implemented'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Search summaries
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

// Start server
app.listen(PORT, () => {
    console.log(`🚀 SAWRON running at http://localhost:${PORT}`);
    console.log('📚 Ready to process knowledge!');
});