const database = require('../services/database');
const processor = require('../services/processor');

class DistillationController {
    /**
     * Get all distillations
     */
    async getAllDistillations(req, res) {
        try {
            const distillations = await database.getAllSummaries();
            res.json(distillations);
        } catch (error) {
            console.error('Error in getAllDistillations:', error);
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    }

    /**
     * Get a specific distillation by ID
     */
    async getDistillation(req, res) {
        try {
            const distillation = await database.getDistillation(req.params.id);
            if (!distillation) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Distillation not found'
                });
            }
            res.json(distillation);
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    }

    /**
     * Delete a distillation by ID
     */
    async deleteDistillation(req, res) {
        try {
            const success = await database.deleteDistillation(req.params.id);
            if (!success) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Distillation not found'
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
     * Retry a failed distillation
     */
    async retryDistillation(req, res) {
        console.log(`Retry endpoint hit for distillation ID: ${req.params.id}`);
        try {
            console.log('Attempting to get distillation from database...');
            const distillation = await database.getDistillation(req.params.id);
            console.log('Distillation retrieved:', distillation ? 'Found' : 'Not found');

            if (!distillation) {
                console.log('Distillation not found, returning 404');
                return res.status(404).json({
                    status: 'error',
                    message: 'Distillation not found'
                });
            }

            console.log(`Distillation status: ${distillation.status}`);
            console.log('Distillation sourceUrl:', distillation.sourceUrl);
            console.log('Distillation sourceFile:', distillation.sourceFile);
            console.log('Distillation sourceType:', distillation.sourceType);

            // Allow retrying any distillation (successful or failed)
            console.log(`Retrying distillation with status: ${distillation.status}`);

            // Retry the distillation based on its source type
            let retryResult;

            if ((distillation.sourceType === 'url' || distillation.sourceType === 'youtube' || distillation.sourceType === 'channel') && distillation.sourceUrl) {
                // Retry URL processing
                console.log('Retrying URL processing for:', distillation.sourceUrl);
                retryResult = await processor.processUrl(distillation.sourceUrl);
            } else if (distillation.sourceType === 'file' && distillation.sourceFile) {
                // For file retries, we need to check if we still have the raw content
                if (!distillation.rawContent) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Cannot retry file processing - original file content not available'
                    });
                }

                console.log('Retrying file processing for:', distillation.sourceFile.name);

                // Create a mock file object from the stored data
                const mockFile = {
                    originalname: distillation.sourceFile.name,
                    mimetype: distillation.sourceFile.type,
                    size: distillation.sourceFile.size,
                    path: null // We'll use rawContent instead
                };

                retryResult = await processor.retryFileProcessing(req.params.id, mockFile, distillation.rawContent);
            } else {
                console.log('Cannot determine retry method. sourceType:', distillation.sourceType, 'sourceUrl:', !!distillation.sourceUrl, 'sourceFile:', !!distillation.sourceFile, 'rawContent:', !!distillation.rawContent);
                return res.status(400).json({
                    status: 'error',
                    message: 'Cannot determine how to retry this distillation'
                });
            }

            // Delete the old failed distillation
            await database.deleteDistillation(req.params.id);

            res.json({
                status: 'ok',
                message: 'Distillation retry initiated successfully',
                newId: retryResult.id
            });

        } catch (error) {
            console.error('Error retrying distillation:', error);
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    }

    /**
     * Bulk delete distillations
     */
    async bulkDelete(req, res) {
        try {
            const { ids } = req.body;

            if (!ids || !Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'IDs array is required'
                });
            }

            let deletedCount = 0;
            const errors = [];

            // Process each ID
            for (const id of ids) {
                try {
                    const success = await database.deleteDistillation(id);
                    if (success) {
                        deletedCount++;
                    } else {
                        errors.push({
                            id: id,
                            error: 'Distillation not found'
                        });
                    }
                } catch (error) {
                    console.error(`Error deleting distillation ${id}:`, error);
                    errors.push({
                        id: id,
                        error: error.message
                    });
                }
            }

            res.json({
                deletedCount: deletedCount,
                errors: errors
            });

        } catch (error) {
            console.error('Bulk delete error:', error);
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    }

    /**
     * Download distillation as PDF
     */
    async downloadPdf(req, res) {
        try {
            const distillation = await database.getDistillation(req.params.id);
            if (!distillation) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Distillation not found'
                });
            }

            if (distillation.status !== 'completed') {
                return res.status(400).json({
                    status: 'error',
                    message: 'Distillation is not yet completed'
                });
            }

            // Generate PDF for the requested distillation
            const { buffer, filename } = await processor.generatePdf(req.params.id);

            // Set headers for PDF download
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', buffer.length);
            res.setHeader('Cache-Control', 'no-cache');

            // Send PDF buffer
            res.end(buffer, 'binary');

        } catch (error) {
            console.error('PDF generation error:', error);
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    }

    /**
     * Bulk download distillations as ZIP
     */
    async bulkDownload(req, res) {
        try {
            const { ids } = req.body;

            if (!ids || !Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'IDs array is required'
                });
            }

            // If only one item, redirect to single PDF download
            if (ids.length === 1) {
                const distillation = await database.getDistillation(ids[0]);
                if (!distillation) {
                    return res.status(404).json({
                        status: 'error',
                        message: 'Distillation not found'
                    });
                }

                if (distillation.status !== 'completed') {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Distillation is not yet completed'
                    });
                }

                const { buffer, filename } = await processor.generatePdf(ids[0]);

                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                res.setHeader('Content-Length', buffer.length);
                res.setHeader('Cache-Control', 'no-cache');

                return res.end(buffer, 'binary');
            }

            // Multiple items - create ZIP
            const archiver = require('archiver');
            const archive = archiver('zip', { zlib: { level: 9 } });

            // Set headers for ZIP download
            const zipFilename = `distyvault-download.zip`;
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
            res.setHeader('Cache-Control', 'no-cache');

            // Handle archive errors
            archive.on('error', (err) => {
                console.error('Archive error:', err);
                if (!res.headersSent) {
                    res.status(500).json({
                        status: 'error',
                        message: 'Failed to create ZIP archive'
                    });
                }
            });

            // Pipe archive to response
            archive.pipe(res);

            const usedFilenames = new Set();

            // Process each ID sequentially
            for (const id of ids) {
                try {
                    const distillation = await database.getDistillation(id);
                    if (!distillation || distillation.status !== 'completed') {
                        console.log(`Skipping distillation ${id} - not found or not completed`);
                        continue;
                    }

                    // Generate PDF
                    const pdfResult = await processor.generatePdf(id);
                    const { buffer, filename } = pdfResult;

                    // Convert buffer to Node.js Buffer if needed
                    let finalBuffer;
                    if (Buffer.isBuffer(buffer)) {
                        finalBuffer = buffer;
                    } else if (buffer instanceof Uint8Array) {
                        finalBuffer = Buffer.from(buffer);
                    } else {
                        finalBuffer = Buffer.from(buffer);
                    }

                    if (finalBuffer.length === 0) {
                        console.log(`Empty buffer for distillation ${id}, skipping`);
                        continue;
                    }

                    let finalFilename = filename || `distillation-${id}.pdf`;

                    // Handle duplicate filenames
                    let counter = 1;
                    let uniqueFilename = finalFilename;
                    while (usedFilenames.has(uniqueFilename)) {
                        const nameWithoutExt = finalFilename.replace('.pdf', '');
                        uniqueFilename = `${nameWithoutExt}-(${counter}).pdf`;
                        counter++;
                    }
                    usedFilenames.add(uniqueFilename);

                    // Add PDF to ZIP archive
                    archive.append(finalBuffer, { name: uniqueFilename });

                } catch (error) {
                    console.error(`Error processing distillation ${id}:`, error);
                }
            }

            // Finalize the archive
            archive.finalize();

        } catch (error) {
            console.error('Bulk download error:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    status: 'error',
                    message: error.message
                });
            }
        }
    }

    /**
     * Cancel individual download
     */
    async cancelDownload(req, res) {
        try {
            // For now, just return success since downloads are client-side
            // In a real implementation, you might track server-side download processes
            res.json({
                status: 'ok',
                message: 'Download cancellation requested'
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    }

    /**
     * Cancel bulk download
     */
    async cancelBulkDownload(req, res) {
        try {
            // For now, just return success since downloads are client-side
            // In a real implementation, you might track server-side download processes
            res.json({
                status: 'ok',
                message: 'Bulk download cancellation requested'
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    }

    /**
     * Search distillations
     */
    async searchDistillations(req, res) {
        try {
            const { query } = req.query;
            if (!query) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Search query is required'
                });
            }

            const results = await database.searchSummaries(query);
            res.json(results);
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    }
}

module.exports = new DistillationController();