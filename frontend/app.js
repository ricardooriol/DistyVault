/**
 * SAWRON Application Entry Point
 * 
 * This is the main entry point for the SAWRON knowledge distillation platform.
 * It initializes the application and sets up the global interface for HTML event handlers.
 * 
 * The application follows a modular architecture with:
 * - Core services (EventBus, ApiClient)
 * - Utility modules (ViewportUtils, DateUtils, ValidationUtils, etc.)
 * - Manager classes (DownloadStateManager, TooltipManager, etc.)
 * - UI components (KnowledgeBaseTable, InputSection, etc.)
 * - Main application controller (SawronApp)
 */

// Ensure all required modules are loaded before initialization
document.addEventListener('DOMContentLoaded', function() {
    // Verify critical dependencies are available
    const requiredClasses = [
        'EventBus', 'ApiClient', 'SawronApp',
        'DownloadStateManager', 'TooltipManager', 'ModalManager', 'BulkActionsManager',
        'KnowledgeBaseTable', 'InputSection', 'StatusSection', 'SettingsModal'
    ];
    
    const missingClasses = requiredClasses.filter(className => typeof window[className] === 'undefined');
    
    if (missingClasses.length > 0) {
        console.error('Missing required classes:', missingClasses);
        console.error('Please ensure all module scripts are loaded before app.js');
        return;
    }
    
    try {
        // Initialize the main application
        const app = new SawronApp();
        
        // Make app globally accessible for debugging and HTML event handlers
        window.app = app;
        window.SawronApp = app; // Backward compatibility
        
        // Expose functions for HTML onclick handlers
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
        
        console.log('SAWRON application initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize SAWRON application:', error);
        
        // Show user-friendly error message
        const errorMessage = document.createElement('div');
        errorMessage.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #f44336;
            color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            text-align: center;
            max-width: 400px;
        `;
        errorMessage.innerHTML = `
            <h3>Application Error</h3>
            <p>Failed to initialize SAWRON. Please refresh the page.</p>
            <small>Check the console for technical details.</small>
        `;
        document.body.appendChild(errorMessage);
    }
});