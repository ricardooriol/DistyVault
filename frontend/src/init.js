/**
 * Application Initialization
 * Creates global app instance and exposes functions for HTML onclick handlers
 */

// Initialize the main application
const app = new SawronApp();

// Make functions globally accessible for HTML onclick handlers
window.app = app;

// Input section functions
window.startDistillation = () => app.startDistillation();
window.removeFile = () => app.removeFile();

// Modal functions
window.closeDistillationModal = () => app.modalManager?.closeModal('distillation-modal');
window.closeRawContentModal = () => app.modalManager?.closeModal('raw-content-modal');
window.closeLogsModal = () => app.modalManager?.closeModal('logs-modal');
window.openAISettingsModal = () => app.settingsModal?.openModal();
window.closeAISettingsModal = () => app.settingsModal?.closeModal();

// Knowledge base functions
window.refreshKnowledgeBase = () => app.loadKnowledgeBase();

// Bulk actions functions
window.toggleSelectAll = () => app.toggleSelectAll();
window.handleBulkDownloadClick = () => app.handleBulkDownloadClick();
window.bulkDelete = () => app.bulkDelete();
window.bulkRetry = () => app.bulkRetry();
window.bulkRetryAll = () => app.bulkRetryAll();
window.bulkRetryFailed = () => app.bulkRetryFailed();

// Settings modal functions
window.handleModeToggle = () => app.settingsModal?.handleModeToggle();
window.handleProviderChange = () => app.settingsModal?.handleProviderChange();
window.toggleApiKeyVisibility = () => app.settingsModal?.toggleApiKeyVisibility();
window.testOllamaConnection = () => app.settingsModal?.testOllamaConnection();
window.testProviderConnection = () => app.settingsModal?.testProviderConnection();
window.adjustConcurrentProcessing = (delta) => app.settingsModal?.adjustConcurrentProcessing(delta);
window.saveAIConfiguration = () => app.settingsModal?.saveConfiguration();
window.resetAIConfiguration = () => app.settingsModal?.resetConfiguration();

// Make app globally available for debugging
window.SawronApp = app;