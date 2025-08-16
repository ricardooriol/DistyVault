const ollamaService = require('../../services/ollama');

class HealthController {
    /**
     * Get system health status
     */
    async getHealth(req, res) {
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
    }

    /**
     * Get detailed system status
     */
    async getSystemStatus(req, res) {
        try {
            const ollamaAvailable = await ollamaService.checkAvailability();
            
            // Get processing queue status
            const processingQueue = require('../../services/processingQueue');
            const queueStatus = processingQueue.getStatus();

            // Get database status
            const database = require('../../services/database');
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
                    ollama: {
                        status: ollamaAvailable ? 'available' : 'unavailable'
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