// Download State Management System
class DownloadStateManager {
    constructor() {
        this.downloadStates = new Map(); // buttonId -> DownloadState
    }

    createDownloadState(buttonId) {
        const state = {
            buttonId: buttonId,
            state: 'idle', // 'idle', 'loading', 'cancellable', 'error'
            downloadId: null,
            abortController: null,
            errorMessage: null,
            startTime: null,
            originalContent: null
        };
        this.downloadStates.set(buttonId, state);
        return state;
    }

    getDownloadState(buttonId) {
        return this.downloadStates.get(buttonId) || this.createDownloadState(buttonId);
    }

    setDownloadState(buttonId, newState, options = {}) {
        const state = this.getDownloadState(buttonId);

        // Map legacy state names to current ones
        const stateMapping = {
            'downloading': 'loading',
            'completed': 'idle'
        };
        
        const mappedState = stateMapping[newState] || newState;

        // Validate state transition
        if (!this.isValidStateTransition(state.state, mappedState)) {
            console.warn(`Invalid state transition from ${state.state} to ${mappedState} for button ${buttonId}`);
            // Allow the transition anyway for backward compatibility, but log it
        }

        state.state = mappedState;

        if (options.downloadId) state.downloadId = options.downloadId;
        if (options.abortController) state.abortController = options.abortController;
        if (options.errorMessage) state.errorMessage = options.errorMessage;
        if (options.startTime) state.startTime = options.startTime;
        if (options.originalContent) state.originalContent = options.originalContent;

        // Set timeout for stuck states
        if (mappedState === 'loading') {
            this.setDownloadTimeout(buttonId);
        } else {
            this.clearDownloadTimeout(buttonId);
        }

        this.updateButtonUI(buttonId, state);
        return state;
    }

    isValidStateTransition(currentState, newState) {
        const validTransitions = {
            'idle': ['loading', 'error'],
            'loading': ['cancellable', 'idle', 'error'],
            'cancellable': ['loading', 'idle', 'error'],
            'error': ['idle', 'loading']
        };

        // Allow any transition for backward compatibility, but warn about invalid ones
        return validTransitions[currentState]?.includes(newState) || true;
    }

    setDownloadTimeout(buttonId) {
        this.clearDownloadTimeout(buttonId);
        const state = this.getDownloadState(buttonId);

        // Set 5 minute timeout for downloads
        state.timeoutId = setTimeout(() => {
            console.warn(`Download timeout for button ${buttonId}`);
            this.setDownloadState(buttonId, 'error', {
                errorMessage: 'Download timed out. Please try again.'
            });
        }, 5 * 60 * 1000);
    }

    clearDownloadTimeout(buttonId) {
        const state = this.getDownloadState(buttonId);
        if (state.timeoutId) {
            clearTimeout(state.timeoutId);
            state.timeoutId = null;
        }
    }

    updateButtonUI(buttonId, state) {
        const button = DomUtils.getElementById(buttonId);
        if (!button) return;

        // Store original content if not already stored
        if (!state.originalContent) {
            state.originalContent = button.innerHTML;
        }

        // Remove existing listeners to prevent duplicates
        button.onmouseenter = null;
        button.onmouseleave = null;

        switch (state.state) {
            case 'idle':
                button.disabled = false;
                button.classList.remove('downloading', 'download-error', 'cancellable');
                if (state.originalContent) {
                    button.innerHTML = state.originalContent;
                }
                button.title = '';
                break;

            case 'loading':
                button.disabled = true;
                button.classList.add('downloading');
                button.classList.remove('download-error', 'cancellable');
                const iconSpan = button.querySelector('.btn-icon');
                const textSpan = button.querySelector('.btn-text');
                if (iconSpan && textSpan) {
                    iconSpan.innerHTML = '⏳';
                    textSpan.innerHTML = 'Downloading...';
                } else {
                    button.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Downloading...</span>';
                }
                button.title = 'Hover to cancel';

                // Add mouse enter listener to switch to cancellable state
                button.onmouseenter = () => {
                    this.setDownloadState(buttonId, 'cancellable');
                };
                break;

            case 'cancellable':
                button.disabled = false;
                button.classList.add('downloading', 'cancellable');
                const cancelIconSpan = button.querySelector('.btn-icon');
                const cancelTextSpan = button.querySelector('.btn-text');
                if (cancelIconSpan && cancelTextSpan) {
                    cancelIconSpan.innerHTML = '❌';
                    cancelTextSpan.innerHTML = 'Cancel';
                } else {
                    button.innerHTML = '<span class="btn-icon">❌</span><span class="btn-text">Cancel</span>';
                }
                button.title = 'Click to cancel download';

                // Add mouse leave listener to revert to loading state
                button.onmouseleave = () => {
                    this.setDownloadState(buttonId, 'loading');
                };
                break;

            case 'error':
                button.disabled = false;
                button.classList.add('download-error');
                button.classList.remove('downloading', 'cancellable');
                const errorIconSpan = button.querySelector('.btn-icon');
                const errorTextSpan = button.querySelector('.btn-text');
                if (errorIconSpan && errorTextSpan) {
                    errorIconSpan.innerHTML = '⚠️';
                    errorTextSpan.innerHTML = 'Error';
                } else {
                    button.innerHTML = '<span class="btn-icon">⚠️</span><span class="btn-text">Error</span>';
                }
                button.title = state.errorMessage || 'Download failed';

                // Auto-reset to idle after 3 seconds
                setTimeout(() => {
                    if (this.getDownloadState(buttonId).state === 'error') {
                        this.setDownloadState(buttonId, 'idle');
                    }
                }, 3000);
                break;
        }
    }

    cancelDownload(buttonId) {
        const state = this.getDownloadState(buttonId);

        // Abort the download if in progress
        if (state.abortController) {
            state.abortController.abort();
            state.abortController = null;
        }

        // Clear timeout
        this.clearDownloadTimeout(buttonId);

        // Reset all state properties
        state.downloadId = null;
        state.errorMessage = null;
        state.startTime = null;

        // Set to idle state
        this.setDownloadState(buttonId, 'idle');
    }

    clearDownloadState(buttonId) {
        this.downloadStates.delete(buttonId);
    }
}

// Export for use in other modules
window.DownloadStateManager = DownloadStateManager;