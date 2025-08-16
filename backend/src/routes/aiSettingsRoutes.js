const express = require('express');
const router = express.Router();
const aiSettingsController = require('../controllers/aiSettingsController');

// Test AI provider connection
router.post('/test-ai-provider', aiSettingsController.testAiProvider);

// Get available providers
router.get('/ai-providers', aiSettingsController.getAvailableProviders);

// Get provider information
router.get('/ai-providers/:type', aiSettingsController.getProviderInfo);

// Validate AI provider configuration
router.post('/validate-ai-config', aiSettingsController.validateAiConfig);

// Save AI provider settings
router.post('/ai-settings', aiSettingsController.saveAiSettings);

// Get AI provider settings
router.get('/ai-settings', aiSettingsController.getAiSettings);

// Update processing queue settings
router.post('/processing-queue/settings', aiSettingsController.updateProcessingQueueSettings);

// Get processing queue status
router.get('/processing-queue/status', aiSettingsController.getProcessingQueueStatus);

// Get general settings (combined AI and processing queue settings)
router.get('/settings', aiSettingsController.getGeneralSettings);

module.exports = router;