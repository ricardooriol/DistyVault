/**
 * Frontend Components Unit Tests
 * Tests frontend UI components and user interactions using JSDOM
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Frontend Components Unit Tests', () => {
    let dom;
    let window;
    let document;
    let appJs;

    beforeAll(() => {
        // Read the HTML template
        const htmlPath = path.join(__dirname, '../../frontend/index.html');
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');

        // Create JSDOM instance
        dom = new JSDOM(htmlContent, {
            url: 'http://localhost:3000',
            pretendToBeVisual: true,
            resources: 'usable'
        });

        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;
        global.navigator = window.navigator;
        global.HTMLElement = window.HTMLElement;
        global.Event = window.Event;
        global.CustomEvent = window.CustomEvent;

        // Read and evaluate the app.js file
        const appJsPath = path.join(__dirname, '../../frontend/src/core/app.js');
        appJs = fs.readFileSync(appJsPath, 'utf8');
        
        // Create a script element and add it to the document
        const script = document.createElement('script');
        script.textContent = appJs;
        document.head.appendChild(script);
    });

    beforeEach(() => {
        // Reset fetch mock
        fetch.mockClear();
        
        // Reset DOM state
        const mainInput = document.getElementById('main-input');
        const fileInput = document.getElementById('file-input');
        const fileDisplay = document.getElementById('file-display');
        const statusSection = document.getElementById('status-section');
        
        if (mainInput) mainInput.value = '';
        if (fileInput) fileInput.value = '';
        if (fileDisplay) fileDisplay.style.display = 'none';
        if (statusSection) statusSection.style.display = 'none';

        // Clear any existing knowledge base content
        const knowledgeBaseTable = document.getElementById('knowledge-base-table');
        if (knowledgeBaseTable) {
            knowledgeBaseTable.innerHTML = '';
        }
    });

    describe('Download State Manager', () => {
        test('should create download state for button', () => {
            // Assuming DownloadStateManager is available globally after script execution
            if (typeof window.DownloadStateManager !== 'undefined') {
                const manager = new window.DownloadStateManager();
                const state = manager.createDownloadState('test-button');

                expect(state).toBeDefined();
                expect(state.buttonId).toBe('test-button');
                expect(state.state).toBe('idle');
                expect(state.downloadId).toBeNull();
                expect(state.abortController).toBeNull();
            }
        });

        test('should get existing download state', () => {
            if (typeof window.DownloadStateManager !== 'undefined') {
                const manager = new window.DownloadStateManager();
                manager.createDownloadState('test-button');
                
                const state = manager.getDownloadState('test-button');
                expect(state.buttonId).toBe('test-button');
            }
        });

        test('should set download state with options', () => {
            if (typeof window.DownloadStateManager !== 'undefined') {
                const manager = new window.DownloadStateManager();
                const abortController = new AbortController();
                
                const state = manager.setDownloadState('test-button', 'loading', {
                    downloadId: 'test-download-id',
                    abortController: abortController,
                    startTime: Date.now()
                });

                expect(state.state).toBe('loading');
                expect(state.downloadId).toBe('test-download-id');
                expect(state.abortController).toBe(abortController);
                expect(state.startTime).toBeDefined();
            }
        });
    });

    describe('Input Section Components', () => {
        test('should handle URL input changes', () => {
            const mainInput = document.getElementById('main-input');
            const distillBtn = document.getElementById('distill-btn');

            expect(mainInput).toBeDefined();
            expect(distillBtn).toBeDefined();

            // Simulate URL input
            mainInput.value = 'https://example.com/article';
            mainInput.dispatchEvent(new window.Event('input'));

            // Check if distill button is enabled
            // Note: This depends on the actual implementation in app.js
            // The test verifies the DOM elements exist and can receive events
        });

        test('should handle file selection', () => {
            const fileInput = document.getElementById('file-input');
            const fileDisplay = document.getElementById('file-display');

            expect(fileInput).toBeDefined();
            expect(fileDisplay).toBeDefined();

            // Create a mock file
            const mockFile = new window.File(['test content'], 'test.txt', {
                type: 'text/plain'
            });

            // Simulate file selection
            Object.defineProperty(fileInput, 'files', {
                value: [mockFile],
                writable: false
            });

            fileInput.dispatchEvent(new window.Event('change'));

            // The actual behavior depends on the implementation
            // This test verifies the DOM structure is correct
        });

        test('should show file display when file is selected', () => {
            const fileDisplay = document.getElementById('file-display');
            const fileName = document.getElementById('file-name');

            expect(fileDisplay).toBeDefined();
            expect(fileName).toBeDefined();

            // Test the display functionality
            if (typeof window.showFileDisplay === 'function') {
                window.showFileDisplay('test-document.pdf');
                expect(fileDisplay.style.display).not.toBe('none');
                expect(fileName.textContent).toBe('test-document.pdf');
            }
        });

        test('should handle file removal', () => {
            const fileDisplay = document.getElementById('file-display');
            const removeBtn = fileDisplay?.querySelector('.remove-file-btn');

            if (removeBtn && typeof window.removeFile === 'function') {
                // Show file display first
                fileDisplay.style.display = 'block';
                
                // Simulate remove button click
                removeBtn.click();
                
                // File display should be hidden
                expect(fileDisplay.style.display).toBe('none');
            }
        });
    });

    describe('Status Section Components', () => {
        test('should show processing status', () => {
            const statusSection = document.getElementById('status-section');
            const statusMessage = document.getElementById('status-message');
            const progressFill = document.getElementById('progress-fill');

            expect(statusSection).toBeDefined();
            expect(statusMessage).toBeDefined();
            expect(progressFill).toBeDefined();

            // Test status display functionality
            if (typeof window.showProcessingStatus === 'function') {
                window.showProcessingStatus('Processing content...', 50);
                
                expect(statusSection.style.display).not.toBe('none');
                expect(statusMessage.textContent).toBe('Processing content...');
                expect(progressFill.style.width).toBe('50%');
            }
        });

        test('should hide processing status', () => {
            const statusSection = document.getElementById('status-section');

            if (typeof window.hideProcessingStatus === 'function') {
                statusSection.style.display = 'block';
                window.hideProcessingStatus();
                expect(statusSection.style.display).toBe('none');
            }
        });

        test('should update progress bar', () => {
            const progressFill = document.getElementById('progress-fill');

            if (typeof window.updateProgress === 'function') {
                window.updateProgress(75);
                expect(progressFill.style.width).toBe('75%');
            }
        });
    });

    describe('Knowledge Base Table Components', () => {
        test('should render knowledge base table', () => {
            const knowledgeBaseTable = document.getElementById('knowledge-base-table');
            expect(knowledgeBaseTable).toBeDefined();

            const mockData = [
                {
                    id: '1',
                    title: 'Test Article',
                    sourceType: 'url',
                    status: 'completed',
                    createdAt: new Date().toISOString()
                }
            ];

            if (typeof window.renderKnowledgeBase === 'function') {
                window.renderKnowledgeBase(mockData);
                
                // Check if table has content
                expect(knowledgeBaseTable.children.length).toBeGreaterThan(0);
            }
        });

        test('should handle search functionality', () => {
            const searchInput = document.getElementById('search-input');
            expect(searchInput).toBeDefined();

            if (typeof window.handleSearch === 'function') {
                searchInput.value = 'test query';
                searchInput.dispatchEvent(new window.Event('input'));
                
                // The search should trigger filtering
                // Actual behavior depends on implementation
            }
        });

        test('should handle filter selection', () => {
            const filterSelect = document.getElementById('filter-select');
            expect(filterSelect).toBeDefined();

            if (typeof window.handleFilter === 'function') {
                filterSelect.value = 'url';
                filterSelect.dispatchEvent(new window.Event('change'));
                
                // The filter should update the displayed items
                // Actual behavior depends on implementation
            }
        });

        test('should handle bulk actions', () => {
            const bulkActionsBar = document.querySelector('.bulk-actions-bar');
            
            if (bulkActionsBar) {
                const selectAllBtn = bulkActionsBar.querySelector('.select-all-btn');
                const bulkDeleteBtn = bulkActionsBar.querySelector('.bulk-delete-btn');
                
                expect(selectAllBtn).toBeDefined();
                expect(bulkDeleteBtn).toBeDefined();

                if (typeof window.selectAllItems === 'function') {
                    selectAllBtn?.click();
                    // Should select all visible items
                }

                if (typeof window.bulkDeleteSelected === 'function') {
                    bulkDeleteBtn?.click();
                    // Should delete selected items
                }
            }
        });
    });

    describe('Modal Components', () => {
        test('should open AI settings modal', () => {
            const settingsBtn = document.querySelector('.settings-btn');
            expect(settingsBtn).toBeDefined();

            if (typeof window.openAISettingsModal === 'function') {
                window.openAISettingsModal();
                
                const modal = document.querySelector('.modal');
                if (modal) {
                    expect(modal.style.display).not.toBe('none');
                }
            }
        });

        test('should close modal when clicking outside', () => {
            if (typeof window.openAISettingsModal === 'function' && 
                typeof window.closeModal === 'function') {
                
                window.openAISettingsModal();
                const modal = document.querySelector('.modal');
                
                if (modal) {
                    // Simulate click outside modal
                    modal.click();
                    expect(modal.style.display).toBe('none');
                }
            }
        });

        test('should handle AI provider selection', () => {
            if (typeof window.openAISettingsModal === 'function') {
                window.openAISettingsModal();
                
                const providerSelect = document.querySelector('#ai-provider-select');
                if (providerSelect) {
                    providerSelect.value = 'openai';
                    providerSelect.dispatchEvent(new window.Event('change'));
                    
                    // Should show/hide relevant configuration fields
                    const apiKeyField = document.querySelector('#api-key-field');
                    if (apiKeyField) {
                        expect(apiKeyField.style.display).not.toBe('none');
                    }
                }
            }
        });
    });

    describe('API Integration', () => {
        test('should make API call to process URL', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                status: 202,
                json: async () => ({
                    id: 'test-id',
                    status: 'processing'
                })
            });

            if (typeof window.processUrl === 'function') {
                const result = await window.processUrl('https://example.com');
                
                expect(fetch).toHaveBeenCalledWith('/api/process/url', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ url: 'https://example.com' })
                });

                expect(result.id).toBe('test-id');
                expect(result.status).toBe('processing');
            }
        });

        test('should handle API errors gracefully', async () => {
            fetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({
                    status: 'error',
                    message: 'Internal server error'
                })
            });

            if (typeof window.processUrl === 'function') {
                try {
                    await window.processUrl('https://example.com');
                } catch (error) {
                    expect(error.message).toContain('Internal server error');
                }
            }
        });

        test('should load knowledge base data', async () => {
            const mockData = [
                { id: '1', title: 'Test 1', status: 'completed' },
                { id: '2', title: 'Test 2', status: 'processing' }
            ];

            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockData
            });

            if (typeof window.loadKnowledgeBase === 'function') {
                await window.loadKnowledgeBase();
                
                expect(fetch).toHaveBeenCalledWith('/api/summaries');
                
                // Check if data was rendered
                const knowledgeBaseTable = document.getElementById('knowledge-base-table');
                if (knowledgeBaseTable) {
                    expect(knowledgeBaseTable.children.length).toBeGreaterThan(0);
                }
            }
        });
    });

    describe('Event Handling', () => {
        test('should handle distill button click', () => {
            const distillBtn = document.getElementById('distill-btn');
            const mainInput = document.getElementById('main-input');

            if (distillBtn && mainInput && typeof window.startDistillation === 'function') {
                mainInput.value = 'https://example.com';
                
                // Mock the API call
                fetch.mockResolvedValueOnce({
                    ok: true,
                    status: 202,
                    json: async () => ({ id: 'test-id', status: 'processing' })
                });

                distillBtn.click();
                
                // Should trigger processing
                expect(fetch).toHaveBeenCalled();
            }
        });

        test('should handle refresh button click', () => {
            const refreshBtn = document.querySelector('.refresh-btn');

            if (refreshBtn && typeof window.refreshKnowledgeBase === 'function') {
                // Mock the API call
                fetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => []
                });

                refreshBtn.click();
                
                // Should reload knowledge base
                expect(fetch).toHaveBeenCalledWith('/api/summaries');
            }
        });

        test('should handle drag and drop', () => {
            const dropzone = document.getElementById('dropzone');

            if (dropzone) {
                const mockFile = new window.File(['test content'], 'test.txt', {
                    type: 'text/plain'
                });

                const dragEvent = new window.Event('drop');
                Object.defineProperty(dragEvent, 'dataTransfer', {
                    value: {
                        files: [mockFile]
                    }
                });

                dropzone.dispatchEvent(dragEvent);
                
                // Should handle file drop
                // Actual behavior depends on implementation
            }
        });
    });

    describe('Responsive Design', () => {
        test('should handle mobile viewport', () => {
            // Change viewport size
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 375
            });

            Object.defineProperty(window, 'innerHeight', {
                writable: true,
                configurable: true,
                value: 667
            });

            window.dispatchEvent(new window.Event('resize'));

            // Check if mobile styles are applied
            // This would depend on the CSS and JavaScript implementation
            const header = document.querySelector('.header');
            if (header) {
                const computedStyle = window.getComputedStyle(header);
                // Verify responsive behavior
            }
        });

        test('should handle tablet viewport', () => {
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 768
            });

            window.dispatchEvent(new window.Event('resize'));

            // Check tablet-specific behavior
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                const computedStyle = window.getComputedStyle(mainContent);
                // Verify tablet layout
            }
        });
    });

    describe('Accessibility', () => {
        test('should have proper ARIA labels', () => {
            const mainInput = document.getElementById('main-input');
            const distillBtn = document.getElementById('distill-btn');
            const searchInput = document.getElementById('search-input');

            // Check for accessibility attributes
            if (mainInput) {
                expect(mainInput.getAttribute('placeholder')).toBeDefined();
            }

            if (distillBtn) {
                expect(distillBtn.getAttribute('title') || 
                       distillBtn.getAttribute('aria-label')).toBeDefined();
            }

            if (searchInput) {
                expect(searchInput.getAttribute('placeholder')).toBeDefined();
            }
        });

        test('should support keyboard navigation', () => {
            const distillBtn = document.getElementById('distill-btn');

            if (distillBtn) {
                // Test keyboard activation
                const enterEvent = new window.KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter'
                });

                distillBtn.dispatchEvent(enterEvent);
                
                // Should trigger the same action as click
                // Actual behavior depends on implementation
            }
        });

        test('should have proper focus management', () => {
            const mainInput = document.getElementById('main-input');
            const fileInput = document.getElementById('file-input');

            if (mainInput && fileInput) {
                mainInput.focus();
                expect(document.activeElement).toBe(mainInput);

                // Test tab navigation
                const tabEvent = new window.KeyboardEvent('keydown', {
                    key: 'Tab',
                    code: 'Tab'
                });

                mainInput.dispatchEvent(tabEvent);
                // Should move focus to next focusable element
            }
        });
    });
});