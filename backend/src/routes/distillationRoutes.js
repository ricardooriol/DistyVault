const express = require('express');
const router = express.Router();
const distillationController = require('../controllers/distillationController');

// Get all distillations
router.get('/summaries', distillationController.getAllDistillations);

// Get a specific distillation
router.get('/summaries/:id', distillationController.getDistillation);

// Delete a distillation
router.delete('/summaries/:id', distillationController.deleteDistillation);

// Retry a failed distillation
router.post('/summaries/:id/retry', distillationController.retryDistillation);

// Download distillation as PDF
router.get('/summaries/:id/pdf', distillationController.downloadPdf);

// Bulk download distillations as ZIP
router.post('/summaries/bulk-download', distillationController.bulkDownload);

// Bulk delete distillations
router.post('/summaries/bulk-delete', distillationController.bulkDelete);

// Cancel individual download
router.post('/summaries/:id/cancel-download', distillationController.cancelDownload);

// Cancel bulk download
router.post('/summaries/cancel-bulk-download', distillationController.cancelBulkDownload);

// Search distillations
router.get('/search', distillationController.searchDistillations);

module.exports = router;