/**
 * Frontend Initialization Test
 * Tests the HTML template and JavaScript module loading for task 11
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('Frontend Initialization Tests', () => {
    let dom;
    let window;
    let document;

    beforeAll(() => {
        // Read the HTML file
        const htmlPath = path.join(__dirname, '../frontend/index.html');
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
    });

    afterAll(() => {
        if (dom) {
            dom.window.close();
        }
    });

    describe('HTML Template Structure', () => {
        test('should have correct DOCTYPE and basic HTML structure', () => {
            expect(document.doctype.name).toBe('html');
            expect(document.documentElement.lang).toBe('en');
            expect(document.head).toBeTruthy();
            expect(document.body).toBeTruthy();
        });

        test('should have correct meta tags and title', () => {
            const charset = document.querySelector('meta[charset]');
            expect(charset.getAttribute('charset')).toBe('UTF-8');
            
            const viewport = document.querySelector('meta[name="viewport"]');
            expect(viewport.getAttribute('content')).toBe('width=device-width, initial-scale=1.0');
            
            expect(document.title).toBe('DistyVault');
        });

        test('should load modular CSS correctly', () => {
            const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
            const localCssLink = Array.from(cssLinks).find(link => 
                link.getAttribute('href') && !link.getAttribute('href').startsWith('http')
            );
            expect(localCssLink.getAttribute('href')).toBe('styles/main.css');
        });

        test('should maintain existing HTML structure and element IDs', () => {
            // Check critical elements exist with correct IDs
            expect(document.getElementById('main-input')).toBeTruthy();
            expect(document.getElementById('file-input')).toBeTruthy();
            expect(document.getElementById('distill-btn')).toBeTruthy();
            expect(document.getElementById('dropzone')).toBeTruthy();
            expect(document.getElementById('knowledge-base-table')).toBeTruthy();
            expect(document.getElementById('bulk-actions-bar')).toBeTruthy();
            expect(document.getElementById('ai-settings-modal')).toBeTruthy();
        });

        test('should have all required modals', () => {
            expect(document.getElementById('distillation-modal')).toBeTruthy();
            expect(document.getElementById('raw-content-modal')).toBeTruthy();
            expect(document.getElementById('logs-modal')).toBeTruthy();
            expect(document.getElementById('ai-settings-modal')).toBeTruthy();
        });
    });

    describe('JavaScript Module Loading', () => {
        test('should load JavaScript modules in correct order', () => {
            const scripts = Array.from(document.querySelectorAll('script[src]'));
            const scriptSources = scripts.map(script => script.getAttribute('src'));
            
            // Verify core modules load first
            expect(scriptSources).toContain('src/core/eventBus.js');
            expect(scriptSources).toContain('src/core/apiClient.js');
            
            // Verify utility modules
            expect(scriptSources).toContain('src/utils/viewportUtils.js');
            expect(scriptSources).toContain('src/utils/dateUtils.js');
            expect(scriptSources).toContain('src/utils/validationUtils.js');
            expect(scriptSources).toContain('src/utils/domUtils.js');
            expect(scriptSources).toContain('src/utils/errorUtils.js');
            
            // Verify manager modules
            expect(scriptSources).toContain('src/managers/downloadStateManager.js');
            expect(scriptSources).toContain('src/managers/tooltipManager.js');
            expect(scriptSources).toContain('src/managers/modalManager.js');
            expect(scriptSources).toContain('src/managers/bulkActionsManager.js');
            
            // Verify component modules
            expect(scriptSources).toContain('src/components/knowledgeBaseTable.js');
            expect(scriptSources).toContain('src/components/inputSection.js');
            expect(scriptSources).toContain('src/components/statusSection.js');
            expect(scriptSources).toContain('src/components/settingsModal.js');
            
            // Verify main application controller
            expect(scriptSources).toContain('src/core/app.js');
            
            // Verify entry point loads last
            expect(scriptSources).toContain('app.js');
            expect(scriptSources[scriptSources.length - 1]).toBe('app.js');
        });

        test('should have correct script loading order', () => {
            const scripts = Array.from(document.querySelectorAll('script[src]'));
            const scriptSources = scripts.map(script => script.getAttribute('src'));
            
            // Core modules should come first
            const eventBusIndex = scriptSources.indexOf('src/core/eventBus.js');
            const apiClientIndex = scriptSources.indexOf('src/core/apiClient.js');
            const appIndex = scriptSources.indexOf('src/core/app.js');
            const entryPointIndex = scriptSources.indexOf('app.js');
            
            expect(eventBusIndex).toBeGreaterThanOrEqual(0);
            expect(apiClientIndex).toBeGreaterThan(eventBusIndex);
            expect(appIndex).toBeGreaterThan(apiClientIndex);
            expect(entryPointIndex).toBe(scriptSources.length - 1);
        });
    });

    describe('Entry Point Functionality', () => {
        test('should have app.js entry point file', () => {
            const appJsPath = path.join(__dirname, '../frontend/app.js');
            expect(fs.existsSync(appJsPath)).toBe(true);
        });

        test('app.js should contain proper initialization code', () => {
            const appJsPath = path.join(__dirname, '../frontend/app.js');
            const appJsContent = fs.readFileSync(appJsPath, 'utf8');
            
            // Check for DOMContentLoaded event listener
            expect(appJsContent).toContain('DOMContentLoaded');
            
            // Check for dependency verification
            expect(appJsContent).toContain('requiredClasses');
            expect(appJsContent).toContain('EventBus');
            expect(appJsContent).toContain('ApiClient');
            expect(appJsContent).toContain('DistyVaultApp');
            
            // Check for global function exposure
            expect(appJsContent).toContain('window.startDistillation');
            expect(appJsContent).toContain('window.removeFile');
            expect(appJsContent).toContain('window.refreshKnowledgeBase');
            
            // Check for error handling
            expect(appJsContent).toContain('try {');
            expect(appJsContent).toContain('catch (error)');
        });

        test('should have modular CSS main file', () => {
            const mainCssPath = path.join(__dirname, '../frontend/styles/main.css');
            expect(fs.existsSync(mainCssPath)).toBe(true);
        });

        test('main.css should import all modular stylesheets', () => {
            const mainCssPath = path.join(__dirname, '../frontend/styles/main.css');
            const mainCssContent = fs.readFileSync(mainCssPath, 'utf8');
            
            // Check for base imports
            expect(mainCssContent).toContain('@import url(\'./base/reset.css\')');
            expect(mainCssContent).toContain('@import url(\'./base/variables.css\')');
            expect(mainCssContent).toContain('@import url(\'./base/typography.css\')');
            
            // Check for layout imports
            expect(mainCssContent).toContain('@import url(\'./layout/header.css\')');
            expect(mainCssContent).toContain('@import url(\'./layout/app.css\')');
            
            // Check for component imports
            expect(mainCssContent).toContain('@import url(\'./components/buttons.css\')');
            expect(mainCssContent).toContain('@import url(\'./components/forms.css\')');
            expect(mainCssContent).toContain('@import url(\'./components/modals.css\')');
            
            // Check for utility imports
            expect(mainCssContent).toContain('@import url(\'./utilities/spacing.css\')');
            expect(mainCssContent).toContain('@import url(\'./utilities/animations.css\')');
        });
    });

    describe('Backward Compatibility', () => {
        test('should maintain onclick handlers in HTML', () => {
            // Check that HTML still has onclick handlers for backward compatibility
            const settingsBtn = document.querySelector('.settings-btn');
            expect(settingsBtn.getAttribute('onclick')).toBe('openAISettingsModal()');
            
            const distillBtn = document.getElementById('distill-btn');
            expect(distillBtn.getAttribute('onclick')).toBe('startDistillation()');
            
            const refreshBtn = document.querySelector('.refresh-btn');
            expect(refreshBtn.getAttribute('onclick')).toBe('refreshKnowledgeBase()');
        });

        test('should maintain existing CSS class names', () => {
            // Check that critical CSS classes are preserved
            expect(document.querySelector('.app-container')).toBeTruthy();
            expect(document.querySelector('.header')).toBeTruthy();
            expect(document.querySelector('.main-content')).toBeTruthy();
            expect(document.querySelector('.input-section')).toBeTruthy();
            expect(document.querySelector('.knowledge-base-section')).toBeTruthy();
            expect(document.querySelector('.bulk-actions-bar')).toBeTruthy();
        });
    });
});