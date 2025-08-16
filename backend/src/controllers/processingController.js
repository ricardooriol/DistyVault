const processor = require('../../services/processor');

class ProcessingController {
    /**
     * Process a URL
     */
    async processUrl(req, res) {
        try {
            const { url } = req.body;

            if (!url) {
                return res.status(400).json({
                    status: 'error',
                    message: 'URL is required'
                });
            }

            const distillation = await processor.processUrl(url);
            res.status(202).json(distillation);
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    }

    /**
     * Process a file
     */
    async processFile(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    status: 'error',
                    message: 'No file uploaded'
                });
            }

            const distillation = await processor.processFile(req.file);
            res.status(202).json(distillation);
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    }

    /**
     * Stop a running process
     */
    async stopProcess(req, res) {
        try {
            const success = await processor.stopProcess(req.params.id);
            if (!success) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Process not found or already completed'
                });
            }
            res.json({ status: 'ok' });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    }

    /**
     * Get processing status for a specific distillation
     */
    async getProcessingStatus(req, res) {
        try {
            // This would typically get the current processing status
            // For now, we'll delegate to the database to get the distillation status
            const database = require('../../services/database');
            const distillation = await database.getDistillation(req.params.id);
            
            if (!distillation) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Distillation not found'
                });
            }

            res.json({
                id: distillation.id,
                status: distillation.status,
                progress: distillation.progress || 0,
                currentStep: distillation.currentStep || 'unknown',
                message: distillation.statusMessage || ''
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    }
}

module.exports = new ProcessingController();