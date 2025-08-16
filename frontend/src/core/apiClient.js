/**
 * ApiClient - Centralized API communication with error handling and retry logic
 */
class ApiClient {
    constructor() {
        this.baseUrl = '';
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1 second
    }

    /**
     * Generic request method with error handling and retry logic
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: { ...this.defaultHeaders, ...options.headers },
            ...options
        };

        // Remove Content-Type for FormData requests
        if (options.body instanceof FormData) {
            delete config.headers['Content-Type'];
        }

        let lastError;
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                const response = await fetch(url, config);
                
                if (!response.ok) {
                    const error = await this.handleErrorResponse(response);
                    throw error;
                }

                return response;
            } catch (error) {
                lastError = error;
                
                // Don't retry on client errors (4xx) or abort signals
                if (error.name === 'AbortError' || 
                    (error.status && error.status >= 400 && error.status < 500)) {
                    throw error;
                }

                // Only retry on network errors or server errors (5xx)
                if (attempt < this.retryAttempts) {
                    await this.delay(this.retryDelay * attempt);
                    continue;
                }
            }
        }

        throw lastError;
    }

    /**
     * Handle error responses and extract error messages
     */
    async handleErrorResponse(response) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
            const errorData = await response.json();
            if (errorData.message) {
                errorMessage = errorData.message;
            } else if (errorData.error) {
                errorMessage = errorData.error;
            }
        } catch (e) {
            // If we can't parse JSON, use the default message
        }

        const error = new Error(errorMessage);
        error.status = response.status;
        error.response = response;
        return error;
    }

    /**
     * Delay utility for retry logic
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * GET request
     */
    async get(endpoint, options = {}) {
        const response = await this.request(endpoint, {
            method: 'GET',
            ...options
        });
        return response.json();
    }

    /**
     * POST request
     */
    async post(endpoint, data = null, options = {}) {
        const config = {
            method: 'POST',
            ...options
        };

        if (data) {
            if (data instanceof FormData) {
                config.body = data;
            } else {
                config.body = JSON.stringify(data);
            }
        }

        const response = await this.request(endpoint, config);
        return response.json();
    }

    /**
     * PUT request
     */
    async put(endpoint, data = null, options = {}) {
        const config = {
            method: 'PUT',
            ...options
        };

        if (data) {
            config.body = JSON.stringify(data);
        }

        const response = await this.request(endpoint, config);
        return response.json();
    }

    /**
     * DELETE request
     */
    async delete(endpoint, options = {}) {
        const response = await this.request(endpoint, {
            method: 'DELETE',
            ...options
        });
        return response.json();
    }

    /**
     * Download file with progress support
     */
    async downloadFile(endpoint, options = {}) {
        const response = await this.request(endpoint, {
            method: 'GET',
            ...options
        });

        return {
            blob: await response.blob(),
            headers: response.headers,
            status: response.status
        };
    }

    /**
     * Upload file with FormData
     */
    async uploadFile(endpoint, file, additionalData = {}) {
        const formData = new FormData();
        formData.append('file', file);
        
        // Add any additional data to the form
        Object.keys(additionalData).forEach(key => {
            formData.append(key, additionalData[key]);
        });

        return this.post(endpoint, formData);
    }

    // Specific API methods for SAWRON application

    /**
     * Get all summaries/distillations
     */
    async getSummaries() {
        return this.get('/api/summaries');
    }

    /**
     * Get single summary by ID
     */
    async getSummary(id) {
        return this.get(`/api/summaries/${id}`);
    }

    /**
     * Delete summary by ID
     */
    async deleteSummary(id) {
        return this.delete(`/api/summaries/${id}`);
    }

    /**
     * Retry distillation by ID
     */
    async retryDistillation(id) {
        return this.post(`/api/summaries/${id}/retry`);
    }

    /**
     * Stop processing by ID
     */
    async stopProcessing(id) {
        return this.post(`/api/summaries/${id}/stop`);
    }

    /**
     * Download PDF by ID
     */
    async downloadPdf(id, options = {}) {
        return this.downloadFile(`/api/summaries/${id}/pdf`, options);
    }

    /**
     * Bulk download PDFs
     */
    async bulkDownload(ids) {
        return this.downloadFile('/api/summaries/bulk-download', {
            method: 'POST',
            body: JSON.stringify({ ids })
        });
    }

    /**
     * Bulk delete summaries
     */
    async bulkDelete(ids) {
        return this.post('/api/summaries/bulk-delete', { ids });
    }

    /**
     * Process URL
     */
    async processUrl(url) {
        return this.post('/api/process/url', { url });
    }

    /**
     * Process uploaded file
     */
    async processFile(file) {
        return this.uploadFile('/api/process/file', file);
    }

    /**
     * Get AI settings
     */
    async getAiSettings() {
        return this.get('/api/ai-settings');
    }

    /**
     * Save AI settings
     */
    async saveAiSettings(settings) {
        return this.post('/api/ai-settings', settings);
    }

    /**
     * Test AI provider
     */
    async testAiProvider(config) {
        return this.post('/api/test-ai-provider', config);
    }

    /**
     * Validate AI configuration
     */
    async validateAiConfig(config) {
        return this.post('/api/validate-ai-config', config);
    }

    /**
     * Test Ollama connection
     */
    async testOllamaConnection(config) {
        return this.post('/api/ai-settings/test-ollama', config);
    }

    /**
     * Test AI provider connection
     */
    async testProviderConnection(config) {
        return this.post('/api/ai-settings/test-provider', config);
    }

    /**
     * Update processing queue settings
     */
    async updateProcessingQueueSettings(settings) {
        return this.post('/api/processing-queue/settings', settings);
    }

    /**
     * Set authentication token (if needed in future)
     */
    setAuthToken(token) {
        if (token) {
            this.defaultHeaders['Authorization'] = `Bearer ${token}`;
        } else {
            delete this.defaultHeaders['Authorization'];
        }
    }

    /**
     * Set custom headers
     */
    setHeaders(headers) {
        this.defaultHeaders = { ...this.defaultHeaders, ...headers };
    }

    /**
     * Configure retry settings
     */
    configureRetry(attempts, delay) {
        this.retryAttempts = attempts;
        this.retryDelay = delay;
    }
}