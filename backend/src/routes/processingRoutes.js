
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const processingController = require('../controllers/processingController');

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
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
		const allowedTypes = ['.pdf', '.docx', '.doc', '.txt'];
		const ext = path.extname(file.originalname).toLowerCase();
		if (allowedTypes.includes(ext)) {
			cb(null, true);
		} else {
			cb(new Error(`Unsupported file type: ${ext}. Allowed types: ${allowedTypes.join(', ')}`));
		}
	}
});

// Process a URL
router.post('/process/url', processingController.processUrl);

// Process a file (with multer middleware)
router.post('/process/file', upload.single('file'), processingController.processFile);

// Stop a running process
router.post('/summaries/:id/stop', processingController.stopProcess);

// Get processing status
router.get('/summaries/:id/status', processingController.getProcessingStatus);

module.exports = router;