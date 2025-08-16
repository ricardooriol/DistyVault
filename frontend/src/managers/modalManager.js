// Modal Management System
class ModalManager {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Modal close event listeners
        document.getElementById('distillation-modal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeDistillationModal();
            }
        });

        document.getElementById('raw-content-modal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeRawContentModal();
            }
        });

        document.getElementById('logs-modal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeLogsModal();
            }
        });

        // AI Settings modal close listener
        document.getElementById('ai-settings-modal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAISettingsModal();
            }
        });
    }

    async showDistillationModal(id) {
        try {
            const distillation = await this.app.apiClient.getSummary(id);

            document.getElementById('modal-title').textContent = distillation.title;

            let metaHtml = '';

            if (distillation.sourceUrl) {
                metaHtml += `<strong>Source:</strong> <a href="${distillation.sourceUrl}" target="_blank">${distillation.sourceUrl}</a><br>`;
            } else if (distillation.sourceFile) {
                metaHtml += `<strong>Source:</strong> ${distillation.sourceFile.name}<br>`;
            }

            metaHtml += `<strong>Status:</strong> ${distillation.status.toUpperCase()}<br>`;

            if (distillation.processingStep) {
                metaHtml += `<strong>Processing Step:</strong> ${distillation.processingStep}<br>`;
            }

            metaHtml += `<strong>Created:</strong> ${this.formatDate(new Date(distillation.createdAt))}<br>`;

            if (distillation.completedAt) {
                metaHtml += `<strong>Completed:</strong> ${this.formatDate(new Date(distillation.completedAt))}<br>`;
            }

            if (distillation.processingTime) {
                metaHtml += `<strong>Processing Time:</strong> ${this.formatTimeDisplay(distillation.processingTime)}<br>`;
            } else if (distillation.elapsedTime) {
                const minutes = Math.floor(distillation.elapsedTime / 60);
                const seconds = Math.floor(distillation.elapsedTime % 60);
                metaHtml += `<strong>Processing Time:</strong> ${minutes}m ${seconds}s<br>`;
            }

            if (distillation.wordCount) {
                metaHtml += `<strong>Word Count:</strong> ${distillation.wordCount} words<br>`;
            }

            document.getElementById('distillation-meta').innerHTML = metaHtml;
            document.getElementById('distillation-content').innerHTML = this.formatContent(distillation.content || '');
            
            // Reset scroll position to top
            this.resetModalScroll('distillation-modal');
            
            document.getElementById('distillation-modal').style.display = 'block';

        } catch (error) {
            ErrorUtils.handleApiError('show distillation', error, {
                showAlert: true,
                defaultMessage: 'Error loading distillation'
            });
        }
    }

    async showRawContent(id) {
        try {
            const distillation = await this.app.apiClient.getSummary(id);

            if (!distillation.rawContent) {
                alert('No raw content available for this distillation');
                return;
            }

            document.getElementById('raw-content-title').textContent = `Raw Content: ${distillation.title}`;
            document.getElementById('raw-content-text').textContent = distillation.rawContent;
            
            // Reset scroll position to top
            this.resetModalScroll('raw-content-modal');
            
            document.getElementById('raw-content-modal').style.display = 'block';

        } catch (error) {
            ErrorUtils.handleApiError('show raw content', error, {
                showAlert: true,
                defaultMessage: 'Error loading raw content'
            });
        }
    }

    async showLogs(id) {
        try {
            const distillation = await this.app.apiClient.getSummary(id);

            document.getElementById('logs-title').textContent = `Processing Logs: ${distillation.title}`;

            // Create comprehensive logs including system information
            let logsHtml = '';

            // Add distillation information header
            logsHtml += `
                <div class="log-section">
                    <h4 class="log-section-title">📊 Distillation Information</h4>
                    <div class="log-entry log-info">
                        <span class="log-message"><strong>ID:</strong> ${distillation.id}</span>
                    </div>
                    <div class="log-entry log-info">
                        <span class="log-message"><strong>Source:</strong> ${distillation.sourceUrl || distillation.sourceFile || ''}</span>
                    </div>
                    <div class="log-entry log-info">
                        <span class="log-message"><strong>Type:</strong> ${distillation.sourceType || ''}</span>
                    </div>
                    <div class="log-entry log-info">
                        <span class="log-message"><strong>Status:</strong> ${distillation.status}</span>
                    </div>
                    <div class="log-entry log-info">
                        <span class="log-message"><strong>Processing Step:</strong> ${distillation.processingStep || 'N/A'}</span>
                    </div>
                    <div class="log-entry log-info">
                        <span class="log-message"><strong>Created:</strong> ${new Date(distillation.createdAt).toLocaleString()}</span>
                    </div>
                    ${distillation.completedAt ? `
                        <div class="log-entry log-info">
                            <span class="log-message"><strong>Completed:</strong> ${new Date(distillation.completedAt).toLocaleString()}</span>
                        </div>
                    ` : ''}
                    ${distillation.processingTime ? `
                        <div class="log-entry log-info">
                            <span class="log-message"><strong>Processing Time:</strong> ${this.formatTimeDisplay(distillation.processingTime)}</span>
                        </div>
                    ` : distillation.elapsedTime ? `
                        <div class="log-entry log-info">
                            <span class="log-message"><strong>Processing Time:</strong> ${Math.floor(distillation.elapsedTime / 60)}m ${Math.floor(distillation.elapsedTime % 60)}s</span>
                        </div>
                    ` : ''}
                    ${distillation.wordCount ? `
                        <div class="log-entry log-info">
                            <span class="log-message"><strong>Word Count:</strong> ${distillation.wordCount} words</span>
                        </div>
                    ` : ''}
                    ${distillation.error ? `
                        <div class="log-entry log-error">
                            <span class="log-message"><strong>Error:</strong> ${distillation.error}</span>
                        </div>
                    ` : ''}
                </div>
            `;

            // Add processing logs section
            if (distillation.logs && distillation.logs.length > 0) {
                logsHtml += `
                    <div class="log-section">
                        <h4 class="log-section-title">📋 Processing Logs</h4>
                `;

                distillation.logs.forEach(log => {
                    const timestamp = new Date(log.timestamp);
                    const formattedTime = timestamp.toLocaleTimeString();
                    const levelClass = `log-${log.level}`;

                    logsHtml += `
                        <div class="log-entry ${levelClass}">
                            <span class="log-time">[${formattedTime}]</span>
                            <span class="log-level">[${log.level.toUpperCase()}]</span>
                            <span class="log-message">${log.message}</span>
                        </div>
                    `;
                });

                logsHtml += `</div>`;
            } else {
                logsHtml += `
                    <div class="log-section">
                        <h4 class="log-section-title">📋 Processing Logs</h4>
                        <div class="log-entry log-info">
                            <span class="log-message">No detailed processing logs available for this item.</span>
                        </div>
                    </div>
                `;
            }

            // Add extraction metadata if available
            if (distillation.extractionMetadata) {
                logsHtml += `
                    <div class="log-section">
                        <h4 class="log-section-title">🔍 Extraction Details</h4>
                        <div class="log-entry log-info">
                            <span class="log-message"><strong>Content Type:</strong> ${distillation.extractionMetadata.contentType || ''}</span>
                        </div>
                        <div class="log-entry log-info">
                            <span class="log-message"><strong>Extraction Method:</strong> ${distillation.extractionMetadata.extractionMethod || ''}</span>
                        </div>
                        <div class="log-entry log-info">
                            <span class="log-message"><strong>Fallback Used:</strong> ${distillation.extractionMetadata.fallbackUsed ? 'Yes' : 'No'}</span>
                        </div>
                    </div>
                `;
            }

            document.getElementById('logs-content').innerHTML = logsHtml;
            
            // Reset scroll position to top
            this.resetModalScroll('logs-modal');
            
            document.getElementById('logs-modal').style.display = 'block';

        } catch (error) {
            ErrorUtils.handleApiError('show logs', error, {
                showAlert: true,
                defaultMessage: 'Error loading logs'
            });
        }
    }

    /**
     * Reset scroll position for modal and its content areas
     * @param {string} modalId - The modal element ID
     */
    resetModalScroll(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            // Immediate reset
            modal.scrollTop = 0;
            
            // Reset scroll for common scrollable elements within the modal
            const scrollableElements = modal.querySelectorAll('.modal-body, .modal-content, .distillation-content, .logs-content, .raw-content-text, #distillation-content, #logs-content, #raw-content-text');
            scrollableElements.forEach(element => {
                if (element && element.scrollTop !== undefined) {
                    element.scrollTop = 0;
                }
            });
            
            // Additional reset after a short delay to ensure DOM is fully rendered
            setTimeout(() => {
                modal.scrollTop = 0;
                scrollableElements.forEach(element => {
                    if (element && element.scrollTop !== undefined) {
                        element.scrollTop = 0;
                    }
                });
            }, 10);
        }
    }

    // AI Settings modal is handled by SettingsModal component

    closeDistillationModal() {
        document.getElementById('distillation-modal').style.display = 'none';
    }

    closeRawContentModal() {
        document.getElementById('raw-content-modal').style.display = 'none';
    }

    closeLogsModal() {
        document.getElementById('logs-modal').style.display = 'none';
    }

    closeAISettingsModal() {
        const modal = document.getElementById('ai-settings-modal');
        modal.style.display = 'none';
    }

    // Helper methods that need to be available to modal manager
    formatDate(date) {
        return DateUtils.formatDate(date);
    }

    formatTimeDisplay(timeInSeconds) {
        return DateUtils.formatTimeDisplay(timeInSeconds);
    }

    formatContent(content) {
        // Use the app's formatContent method if available, otherwise return as-is
        if (window.app && typeof window.app.formatContent === 'function') {
            return window.app.formatContent(content);
        }
        return content;
    }
}

// Export for use in other modules
window.ModalManager = ModalManager;