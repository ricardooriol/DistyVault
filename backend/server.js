const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Note: Services are now imported directly in controllers where needed

const app = express();
const PORT = 3000;

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '..', 'uploads');
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

// CORS middleware - simplified and working configuration
app.use(cors({
    origin: true, // Allow all origins for local development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Remove the old CORS setup since we're handling it manually above

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from frontend directory with proper MIME types
app.use(express.static(path.join(__dirname, '..', 'frontend'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Import route modules
const distillationRoutes = require('./src/routes/distillationRoutes');
const processingRoutes = require('./src/routes/processingRoutes');
const aiSettingsRoutes = require('./src/routes/aiSettingsRoutes');
const healthRoutes = require('./src/routes/healthRoutes');

// Use route modules
app.use('/api', distillationRoutes);
app.use('/api', processingRoutes);
app.use('/api', aiSettingsRoutes);
app.use('/api', healthRoutes);

// Special handling for file upload route (needs multer middleware)
const processingController = require('./src/controllers/processingController');
app.post('/api/process/file', upload.single('file'), processingController.processFile);

// Main route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
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