/**
 * DistyVault Application Entry Point
 * 
 * This is the main entry point for the DistyVault knowledge distillation platform.
 * It initializes the application and sets up the global interface for HTML event handlers.
 * 
 * The application follows a modular architecture with:
 * - Core services (EventBus, ApiClient)
 * - Utility modules (ViewportUtils, DateUtils, ValidationUtils, etc.)
 * - Manager classes (DownloadStateManager, TooltipManager, etc.)
 * - UI components (KnowledgeBaseTable, InputSection, etc.)
 * - Main application controller (DistyVaultApp)
 */

// Global error handling for unhandled promise rejections
window.addEventListener('unhandledrejection', function(event) {
    // Check if this is an AbortError that we want to ignore
    if (event.reason && (event.reason.name === 'AbortError' || event.reason.message === 'Request cancelled by user')) {
        // Prevent the unhandled rejection from being logged
        event.preventDefault();
        return;
    }
    // Ignore Safari/iOS transient network aborts seen as TypeError: Load failed
    try {
        const msg = String(event?.reason?.message || event?.reason || '').toLowerCase();
        if (/load failed|failed to fetch|networkerror|network error|the network connection was lost/.test(msg)) {
            event.preventDefault();
            return;
        }
    } catch {}
    
    // Log other unhandled rejections for debugging
    console.error('Unhandled promise rejection:', event.reason);
});

// Ensure all required modules are loaded before initialization
document.addEventListener('DOMContentLoaded', function() {
    try {
        if (window && window.DV_DISABLE_LEGACY_UI) {
            // Skip initializing legacy UI when React UI is active
            return;
        }
    } catch {}
    // Verify critical dependencies are available
    const requiredClasses = [
        'EventBus', 'ApiClient', 'DistyVaultApp',
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
        const app = new DistyVaultApp();
        
        // Make app globally accessible for debugging and HTML event handlers
        window.app = app;
        window.DistyVaultApp = app; // Backward compatibility
        
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
        window.exportKnowledgeBase = async () => {
            try {
                await app.apiClient.exportKnowledgeBase();
                app.showTemporaryMessage('Export started', 'success');
            } catch (e) {
                console.error('Export failed', e);
                app.showTemporaryMessage('Export failed', 'error');
            }
        };
        window.triggerImportKnowledgeBase = () => {
            const input = document.getElementById('import-kb-input');
            if (!input) return;
            input.value = '';
            input.onchange = async (ev) => {
                const file = ev.target.files && ev.target.files[0];
                if (!file) return;
                try {
                    // Import clears existing only if user confirms
                    const doClear = confirm('Importing a knowledge base. Clear existing items first?');
                    await app.apiClient.importKnowledgeBase(file, { clearExisting: doClear });
                    app.showTemporaryMessage('Import completed', 'success');
                    await app.loadKnowledgeBase();
                } catch (e) {
                    console.error('Import failed', e);
                    app.showTemporaryMessage('Import failed', 'error');
                }
            };
            input.click();
        };
        
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
        
        // Modal content functions
        window.showDistillationModal = (id) => app.showDistillationModal(id);
        window.showLogs = (id) => app.showLogs(id);
        window.showRawContent = (id) => app.showRawContent(id);
        
    } catch (error) {
        console.error('Failed to initialize DistyVault application:', error);
        
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
            <p>Failed to initialize DistyVault. Please refresh the page.</p>
            <small>Check the console for technical details.</small>
        `;
        document.body.appendChild(errorMessage);
    }
});