/**
 * Unit tests for utility modules integration
 */

// Mock DOM environment
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;

// Load utility modules
const ViewportUtils = require('../../frontend/src/utils/viewportUtils.js');
const DateUtils = require('../../frontend/src/utils/dateUtils.js');
const ValidationUtils = require('../../frontend/src/utils/validationUtils.js');
const DomUtils = require('../../frontend/src/utils/domUtils.js');

describe('Utility Modules Integration', () => {
    describe('ViewportUtils', () => {
        test('should provide viewport dimensions', () => {
            const dimensions = ViewportUtils.getViewportDimensions();
            expect(dimensions).toHaveProperty('width');
            expect(dimensions).toHaveProperty('height');
            expect(typeof dimensions.width).toBe('number');
            expect(typeof dimensions.height).toBe('number');
        });

        test('should get element position', () => {
            const mockElement = {
                getBoundingClientRect: () => ({
                    top: 10, left: 20, bottom: 110, right: 120, width: 100, height: 100
                })
            };
            
            const position = ViewportUtils.getElementPosition(mockElement);
            expect(position.top).toBe(10);
            expect(position.left).toBe(20);
            expect(position.width).toBe(100);
            expect(position.height).toBe(100);
        });
    });

    describe('DateUtils', () => {
        test('should format time display correctly', () => {
            expect(DateUtils.formatTimeDisplay(30)).toBe('30s');
            expect(DateUtils.formatTimeDisplay(90)).toBe('1m 30s');
            expect(DateUtils.formatTimeDisplay(3661)).toBe('61m 1s');
        });

        test('should calculate processing time display', () => {
            const completedItem = {
                status: 'completed',
                processingTime: 125
            };
            expect(DateUtils.calculateProcessingTimeDisplay(completedItem)).toBe('2m 5s');

            const pendingItem = {
                status: 'pending'
            };
            expect(DateUtils.calculateProcessingTimeDisplay(pendingItem)).toBe('Waiting...');
        });

        test('should format dates correctly', () => {
            const date = new Date('2024-01-15T10:30:00');
            const formatted = DateUtils.formatDate(date);
            expect(formatted).toContain('Jan');
            expect(formatted).toContain('15');
            expect(formatted).toContain('2024');
        });

        test('should detect today correctly', () => {
            const today = new Date();
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
            
            expect(DateUtils.isToday(today)).toBe(true);
            expect(DateUtils.isToday(yesterday)).toBe(false);
        });
    });

    describe('ValidationUtils', () => {
        test('should validate URLs correctly', () => {
            expect(ValidationUtils.isValidUrl('https://example.com')).toBe(true);
            expect(ValidationUtils.isValidUrl('http://test.org')).toBe(true);
            expect(ValidationUtils.isValidUrl('not-a-url')).toBe(false);
            expect(ValidationUtils.isValidUrl('')).toBe(false);
            expect(ValidationUtils.isValidUrl(null)).toBe(false);
        });

        test('should validate emails correctly', () => {
            expect(ValidationUtils.isValidEmail('test@example.com')).toBe(true);
            expect(ValidationUtils.isValidEmail('user.name@domain.co.uk')).toBe(true);
            expect(ValidationUtils.isValidEmail('invalid-email')).toBe(false);
            expect(ValidationUtils.isValidEmail('test@')).toBe(false);
            expect(ValidationUtils.isValidEmail('')).toBe(false);
        });

        test('should validate non-empty strings', () => {
            expect(ValidationUtils.isNotEmpty('hello')).toBe(true);
            expect(ValidationUtils.isNotEmpty('  test  ')).toBe(true);
            expect(ValidationUtils.isNotEmpty('')).toBe(false);
            expect(ValidationUtils.isNotEmpty('   ')).toBe(false);
            expect(ValidationUtils.isNotEmpty(null)).toBe(false);
        });

        test('should validate numbers correctly', () => {
            expect(ValidationUtils.isValidNumber(42)).toBe(true);
            expect(ValidationUtils.isValidNumber('3.14')).toBe(true);
            expect(ValidationUtils.isValidNumber('0')).toBe(true);
            expect(ValidationUtils.isValidNumber('not-a-number')).toBe(false);
            expect(ValidationUtils.isValidNumber('')).toBe(false);
        });

        test('should validate YouTube URLs', () => {
            expect(ValidationUtils.isYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
            expect(ValidationUtils.isYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
            expect(ValidationUtils.isYouTubeUrl('https://example.com')).toBe(false);
        });
    });

    describe('DomUtils', () => {
        test('should create elements with attributes', () => {
            const element = DomUtils.createElement('div', {
                className: 'test-class',
                id: 'test-id'
            }, 'Test content');

            expect(element.tagName).toBe('DIV');
            expect(element.className).toBe('test-class');
            expect(element.textContent).toBe('Test content');
        });

        test('should handle class operations', () => {
            const element = document.createElement('div');
            
            expect(DomUtils.addClass(element, 'test-class')).toBe(true);
            expect(DomUtils.hasClass(element, 'test-class')).toBe(true);
            
            expect(DomUtils.removeClass(element, 'test-class')).toBe(true);
            expect(DomUtils.hasClass(element, 'test-class')).toBe(false);
        });

        test('should toggle classes', () => {
            const element = document.createElement('div');
            
            expect(DomUtils.toggleClass(element, 'toggle-class')).toBe(true);
            expect(DomUtils.hasClass(element, 'toggle-class')).toBe(true);
            
            expect(DomUtils.toggleClass(element, 'toggle-class')).toBe(false);
            expect(DomUtils.hasClass(element, 'toggle-class')).toBe(false);
        });

        test('should set styles', () => {
            const element = document.createElement('div');
            
            const success = DomUtils.setStyles(element, {
                color: 'red',
                fontSize: '16px'
            });
            
            expect(success).toBe(true);
            expect(element.style.color).toBe('red');
            expect(element.style.fontSize).toBe('16px');
        });

        test('should handle debounce function', (done) => {
            let callCount = 0;
            const debouncedFn = DomUtils.debounce(() => {
                callCount++;
            }, 50);

            // Call multiple times quickly
            debouncedFn();
            debouncedFn();
            debouncedFn();

            // Should not be called immediately
            expect(callCount).toBe(0);

            // Should be called once after delay
            setTimeout(() => {
                expect(callCount).toBe(1);
                done();
            }, 100);
        });

        test('should handle throttle function', (done) => {
            let callCount = 0;
            const throttledFn = DomUtils.throttle(() => {
                callCount++;
            }, 50);

            // Call multiple times quickly
            throttledFn();
            throttledFn();
            throttledFn();

            // Should be called immediately once
            expect(callCount).toBe(1);

            // Should not be called again until throttle period passes
            setTimeout(() => {
                throttledFn();
                expect(callCount).toBe(2);
                done();
            }, 100);
        });
    });

    describe('Integration with existing functionality', () => {
        test('should work with existing time formatting patterns', () => {
            // Test patterns that were used in the original app.js
            const item1 = {
                status: 'completed',
                processingTime: 65
            };
            expect(DateUtils.calculateProcessingTimeDisplay(item1)).toBe('1m 5s');

            const item2 = {
                status: 'extracting',
                startTime: new Date(Date.now() - 30000).toISOString() // 30 seconds ago
            };
            const result = DateUtils.calculateProcessingTimeDisplay(item2);
            expect(result).toMatch(/^\d+s$/); // Should be in seconds format
        });

        test('should work with existing URL validation patterns', () => {
            // Test patterns that were used in the original app.js
            expect(ValidationUtils.isValidUrl('https://example.com/path?query=value')).toBe(true);
            expect(ValidationUtils.isValidUrl('ftp://files.example.com')).toBe(true);
            expect(ValidationUtils.isValidUrl('just-text')).toBe(false);
        });

        test('should work with existing DOM patterns', () => {
            // Create a test element similar to what the app uses
            const button = DomUtils.createElement('button', {
                id: 'test-btn',
                className: 'btn'
            });

            // Test class manipulation patterns used in the app
            DomUtils.addClass(button, 'disabled');
            expect(DomUtils.hasClass(button, 'disabled')).toBe(true);

            DomUtils.removeClass(button, 'disabled');
            expect(DomUtils.hasClass(button, 'disabled')).toBe(false);
        });
    });
});