const processor = require('../services/processing/processor');

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
                console.error('No file received in request:', req.body, req.headers);
                return res.status(400).json({
                    status: 'error',
                    message: 'No file uploaded'
                });
            }
            console.log('File received:', req.file);
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
            const { id } = req.params;
            console.log(`Stop request received for process: ${id}`);
            
            const success = await processor.stopProcessing(id);
            if (!success) {
                console.log(`Failed to stop process ${id} - not found or already completed`);
                return res.status(404).json({
                    status: 'error',
                    message: 'Process not found or already completed'
                });
            }
            
            console.log(`Successfully stopped process: ${id}`);
            res.json({ 
                status: 'ok',
                message: 'Process stopped successfully'
            });
        } catch (error) {
            console.error('Error stopping process:', error);
            res.status(500).json({
                status: 'error',
                message: error.message || 'Failed to stop process'
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
            const database = require('../services/processing/database');
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