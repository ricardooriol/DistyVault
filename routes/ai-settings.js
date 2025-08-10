/**
 * AI Settings API Routes
 * Handles AI provider configuration and testing
 */
const express = require('express');
const router = express.Router();
const AIProviderFactory = require('../services/ai/AIProviderFactory');

/**
 * Test AI provider connection
 * POST /api/test-ai-provider
 */
router.post('/test-ai-provider', async (req, res) => {
    try {
        const { type, apiKey, model, endpoint } = req.body;

        console.log(`Testing AI provider: ${type}`);

        // Validate request
        if (!type) {
            return res.status(400).json({
                success: false,
                error: 'Provider type is required'
            });
        }

        // Create provider configuration
        const config = {
            type: type,
            model: model,
            endpoint: endpoint
        };

        // Add API key for online providers
        if (type !== 'ollama' && apiKey) {
            config.apiKey = apiKey;
        }

        // Validate configuration
        const validation = AIProviderFactory.validateConfig(config);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: validation.errors.join(', ')
            });
        }

        // Create provider instance
        const provider = AIProviderFactory.createProvider(config);

        // Test connection
        const testResult = await provider.testConnection();

        if (testResult.success) {
            res.json({
                success: true,
                latency: testResult.latency,
                response: testResult.response,
                tokensUsed: testResult.tokensUsed,
                inputTokens: testResult.inputTokens,
                outputTokens: testResult.outputTokens
            });
        } else {
            res.status(400).json({
                success: false,
                error: testResult.error,
                latency: testResult.latency
            });
        }

    } catch (error) {
        console.error('Error testing AI provider:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

/**
 * Get available providers
 * GET /api/ai-providers
 */
router.get('/ai-providers', (req, res) => {
    try {
        const providers = AIProviderFactory.getSupportedProviders();
        res.json({
            success: true,
            providers: providers
        });
    } catch (error) {
        console.error('Error getting AI providers:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

/**
 * Get provider information
 * GET /api/ai-providers/:type
 */
router.get('/ai-providers/:type', (req, res) => {
    try {
        const { type } = req.params;
        const providerInfo = AIProviderFactory.getProviderInfo(type);

        if (!providerInfo) {
            return res.status(404).json({
                success: false,
                error: `Provider type '${type}' not found`
            });
        }

        res.json({
            success: true,
            provider: providerInfo
        });
    } catch (error) {
        console.error('Error getting provider info:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

/**
 * Validate AI provider configuration
 * POST /api/validate-ai-config
 */
router.post('/validate-ai-config', (req, res) => {
    try {
        const config = req.body;
        const validation = AIProviderFactory.validateConfig(config);

        res.json({
            success: true,
            valid: validation.valid,
            errors: validation.errors
        });
    } catch (error) {
        console.error('Error validating AI config:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

// Use singleton instance of AISettingsManager
const AISettingsManager = require('../services/ai/AISettingsManager');
const sharedSettingsManager = AISettingsManager.getInstance();

/**
 * Save AI provider settings
 * POST /api/ai-settings
 */
router.post('/ai-settings', (req, res) => {
    try {
        const settings = req.body;

        // Validate settings
        const validation = sharedSettingsManager.validateSettings(settings);
        console.log('Backend: Validation result:', validation);
        if (!validation.valid) {
            console.log('Backend: Validation failed with errors:', validation.errors);
            return res.status(400).json({
                success: false,
                error: validation.errors.join(', ')
            });
        }

        // Save settings
        console.log('Backend: Saving AI settings:', JSON.stringify(settings, null, 2));
        sharedSettingsManager.saveSettings(settings);
        console.log('Backend: Settings saved successfully');

        res.json({
            success: true,
            message: 'Settings saved successfully'
        });
    } catch (error) {
        console.error('Error saving AI settings:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

/**
 * Get AI provider settings
 * GET /api/ai-settings
 */
router.get('/ai-settings', (req, res) => {
    try {
        const settings = sharedSettingsManager.loadSettings();
        console.log('Backend: Loading AI settings:', JSON.stringify(settings, null, 2));

        res.json({
            success: true,
            settings: settings
        });
    } catch (error) {
        console.error('Error loading AI settings:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

/**
 * Update processing queue settings
 * POST /api/processing-queue/settings
 */
router.post('/processing-queue/settings', (req, res) => {
    try {
        const { concurrentProcessing } = req.body;
        
        if (!concurrentProcessing || concurrentProcessing < 1 || concurrentProcessing > 10) {
            return res.status(400).json({
                success: false,
                error: 'Concurrent processing limit must be between 1 and 10'
            });
        }

        // Update the processing queue
        const processingQueue = require('../services/processingQueue');
        processingQueue.setMaxConcurrent(concurrentProcessing);

        res.json({
            success: true,
            message: `Processing queue limit updated to ${concurrentProcessing}`
        });

    } catch (error) {
        console.error('Error updating processing queue settings:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

/**
 * Get processing queue status
 * GET /api/processing-queue/status
 */
router.get('/processing-queue/status', (req, res) => {
    try {
        const processingQueue = require('../services/processingQueue');
        const status = processingQueue.getStatus();

        res.json({
            success: true,
            status: status
        });

    } catch (error) {
        console.error('Error getting processing queue status:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

/**
 * Get general settings (combined AI and processing queue settings)
 * GET /api/settings
 */
router.get('/settings', (req, res) => {
    try {
        const aiSettings = sharedSettingsManager.loadSettings();
        const processingQueue = require('../services/processingQueue');
        const queueStatus = processingQueue.getStatus();

        res.json({
            success: true,
            settings: {
                ai: aiSettings,
                processingQueue: {
                    maxConcurrent: queueStatus.maxConcurrent,
                    currentStatus: queueStatus
                }
            }
        });
    } catch (error) {
        console.error('Error loading general settings:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

module.exports = router;