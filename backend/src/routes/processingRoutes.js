const express = require('express');
const router = express.Router();
const processingController = require('../controllers/processingController');

// Process a URL
router.post('/process/url', processingController.processUrl);

// Process a file
router.post('/process/file', processingController.processFile);

// Stop a running process
router.post('/summaries/:id/stop', processingController.stopProcess);

// Get processing status
router.get('/summaries/:id/status', processingController.getProcessingStatus);

module.exports = router;