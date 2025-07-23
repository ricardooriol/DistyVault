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

/**
 * Save AI provider settings
 * POST /api/ai-settings
 */
router.post('/ai-settings', (req, res) => {
    try {
        const AISettingsManager = require('../services/ai/AISettingsManager');
        const settingsManager = new AISettingsManager();
        
        const settings = req.body;
        
        // Validate settings
        const validation = settingsManager.validateSettings(settings);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: validation.errors.join(', ')
            });
        }
        
        // Save settings
        settingsManager.saveSettings(settings);
        
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
        const AISettingsManager = require('../services/ai/AISettingsManager');
        const settingsManager = new AISettingsManager();
        
        const settings = settingsManager.loadSettings();
        
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

module.exports = router;