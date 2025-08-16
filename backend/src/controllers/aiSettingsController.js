const AIProviderFactory = require('../services/ai/aiProviderFactory');
const AISettingsManager = require('../services/ai/aiSettingsManager');

// Use singleton instance of AISettingsManager
const sharedSettingsManager = AISettingsManager.getInstance();

class AISettingsController {
    /**
     * Test AI provider connection
     */
    async testAiProvider(req, res) {
        try {
            const { type, provider: providerName, apiKey, model, endpoint } = req.body;
            
            // Accept either 'type' or 'provider' for backward compatibility
            // If neither is provided but endpoint is provided, assume it's Ollama
            let providerType = type || providerName;
            if (!providerType && endpoint) {
                providerType = 'ollama';
            }

            console.log(`Testing AI provider: ${providerType}`);

            // Validate request
            if (!providerType) {
                return res.status(400).json({
                    success: false,
                    error: 'Provider type is required'
                });
            }

            // Create provider configuration
            const config = {
                type: providerType,
                model: model,
                endpoint: endpoint
            };

            // Add API key for online providers
            if (providerType !== 'ollama' && apiKey) {
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
    }

    /**
     * Get available providers
     */
    getAvailableProviders(req, res) {
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
    }

    /**
     * Get provider information
     */
    getProviderInfo(req, res) {
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
    }

    /**
     * Validate AI provider configuration
     */
    validateAiConfig(req, res) {
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
    }

    /**
     * Save AI provider settings
     */
    saveAiSettings(req, res) {
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
    }

    /**
     * Get AI provider settings
     */
    getAiSettings(req, res) {
        try {
            const settings = sharedSettingsManager.loadSettings();
            // Only log when settings are actually being loaded, not on every request
            if (process.env.NODE_ENV === 'development') {
                console.log('Backend: Loading AI settings');
            }

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
    }

    /**
     * Update processing queue settings
     */
    updateProcessingQueueSettings(req, res) {
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
    }

    /**
     * Get processing queue status
     */
    getProcessingQueueStatus(req, res) {
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
    }

    /**
     * Get general settings (combined AI and processing queue settings)
     */
    getGeneralSettings(req, res) {
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
    }
}

module.exports = new AISettingsController();