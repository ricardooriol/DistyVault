const fs = require('fs');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

class DocumentService {
    /**
     * Process different types of documents
     * @param {Buffer} fileBuffer - The file buffer
     * @param {string} fileType - The type of file (pdf, docx, txt)
     * @returns {Promise<Object>} The extracted text and metadata
     */
    async processDocument(fileBuffer, fileType) {
        try {
            let content = '';
            let metadata = {};

            switch (fileType.toLowerCase()) {
                case 'pdf':
                    const pdfData = await pdf(fileBuffer);
                    content = pdfData.text;
                    metadata = {
                        pages: pdfData.numpages,
                        info: pdfData.info
                    };
                    break;

                case 'docx':
                    const docxResult = await mammoth.extractRawText({ buffer: fileBuffer });
                    content = docxResult.value;
                    metadata = {
                        messages: docxResult.messages
                    };
                    break;

                case 'txt':
                    content = fileBuffer.toString('utf-8');
                    break;

                default:
                    throw new Error('Unsupported file type');
            }

            return {
                content: content.trim(),
                metadata: {
                    ...metadata,
                    fileType,
                    date: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error('Error processing document:', error);
            throw error;
        }
    }
}

module.exports = new DocumentService();
