const AIProviderFactory = require('../services/ai/aiProviderFactory');
const AISettingsManager = require('../services/ai/aiSettingsManager');

class HealthController {
    /**
     * Get system health status
     */
    async getHealth(req, res) {
        try {
            // Check current AI provider availability
            let aiProviderStatus = 'unavailable';
            try {
                const aiSettingsManager = AISettingsManager.getInstance();
                const config = aiSettingsManager.getCurrentProviderConfig();
                const aiProvider = AIProviderFactory.createProvider(config);
                const validation = await aiProvider.validateConfiguration();
                aiProviderStatus = validation.valid ? 'available' : 'unavailable';
            } catch (error) {
                aiProviderStatus = 'unavailable';
            }

            res.json({
                status: 'ok',
                aiProvider: aiProviderStatus
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    }

    /**
     * Get detailed system status
     */
    async getSystemStatus(req, res) {
        try {
            // Check current AI provider availability
            let aiProviderStatus = 'unavailable';
            let aiProviderName = 'unknown';
            try {
                const aiSettingsManager = AISettingsManager.getInstance();
                const config = aiSettingsManager.getCurrentProviderConfig();
                const aiProvider = AIProviderFactory.createProvider(config);
                const validation = await aiProvider.validateConfiguration();
                aiProviderStatus = validation.valid ? 'available' : 'unavailable';
                aiProviderName = aiProvider.getDisplayName();
            } catch (error) {
                aiProviderStatus = 'unavailable';
            }
            
            // Get processing queue status
            const processingQueue = require('../services/processing/processingQueue');
            const queueStatus = processingQueue.getStatus();

            // Get database status
            const database = require('../services/processing/database');
            let dbStatus = 'ok';
            try {
                await database.getAllSummaries();
            } catch (error) {
                dbStatus = 'error';
            }

            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                services: {
                    aiProvider: {
                        name: aiProviderName,
                        status: aiProviderStatus
                    },
                    database: {
                        status: dbStatus
                    },
                    processingQueue: {
                        status: 'ok',
                        ...queueStatus
                    }
                }
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Simple ping endpoint
     */
    ping(req, res) {
        res.json({
            status: 'ok',
            message: 'pong',
            timestamp: new Date().toISOString()
        });
    }
}

module.exports = new HealthController();