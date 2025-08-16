/**
 * DOM Manipulation Utilities
 * Provides utilities for DOM manipulation, element creation, and common DOM operations.
 */
class DomUtils {
    /**
     * Safely get element by ID
     * @param {string} id - Element ID
     * @returns {HTMLElement|null} Element or null if not found
     */
    static getElementById(id) {
        if (!id || typeof id !== 'string') {
            return null;
        }
        return document.getElementById(id);
    }

    /**
     * Safely query selector
     * @param {string} selector - CSS selector
     * @param {HTMLElement} parent - Parent element (defaults to document)
     * @returns {HTMLElement|null} Element or null if not found
     */
    static querySelector(selector, parent = document) {
        if (!selector || typeof selector !== 'string') {
            return null;
        }
        try {
            return parent.querySelector(selector);
        } catch (error) {
            console.warn('Invalid selector:', selector, error);
            return null;
        }
    }

    /**
     * Safely query all elements matching selector
     * @param {string} selector - CSS selector
     * @param {HTMLElement} parent - Parent element (defaults to document)
     * @returns {NodeList} NodeList of matching elements
     */
    static querySelectorAll(selector, parent = document) {
        if (!selector || typeof selector !== 'string') {
            return [];
        }
        try {
            return parent.querySelectorAll(selector);
        } catch (error) {
            console.warn('Invalid selector:', selector, error);
            return [];
        }
    }

    /**
     * Create element with optional attributes and content
     * @param {string} tagName - HTML tag name
     * @param {Object} attributes - Object with attribute key-value pairs
     * @param {string|HTMLElement} content - Text content or child element
     * @returns {HTMLElement} Created element
     */
    static createElement(tagName, attributes = {}, content = null) {
        if (!tagName || typeof tagName !== 'string') {
            throw new Error('Tag name is required and must be a string');
        }

        const element = document.createElement(tagName);

        // Set attributes
        if (attributes && typeof attributes === 'object') {
            Object.entries(attributes).forEach(([key, value]) => {
                if (key === 'className' || key === 'class') {
                    element.className = value;
                } else if (key === 'innerHTML') {
                    element.innerHTML = value;
                } else if (key === 'textContent') {
                    element.textContent = value;
                } else {
                    element.setAttribute(key, value);
                }
            });
        }

        // Set content
        if (content !== null) {
            if (typeof content === 'string') {
                element.textContent = content;
            } else if (content instanceof HTMLElement) {
                element.appendChild(content);
            }
        }

        return element;
    }

    /**
     * Safely remove element from DOM
     * @param {HTMLElement|string} element - Element or element ID to remove
     * @returns {boolean} True if element was removed
     */
    static removeElement(element) {
        let el = element;
        
        if (typeof element === 'string') {
            el = this.getElementById(element);
        }

        if (el && el.parentNode) {
            el.parentNode.removeChild(el);
            return true;
        }
        return false;
    }

    /**
     * Add CSS class to element
     * @param {HTMLElement|string} element - Element or element ID
     * @param {string|string[]} className - Class name(s) to add
     * @returns {boolean} True if class was added
     */
    static addClass(element, className) {
        const el = typeof element === 'string' ? this.getElementById(element) : element;
        if (!el) return false;

        if (Array.isArray(className)) {
            className.forEach(cls => el.classList.add(cls));
        } else if (typeof className === 'string') {
            el.classList.add(className);
        }
        return true;
    }

    /**
     * Remove CSS class from element
     * @param {HTMLElement|string} element - Element or element ID
     * @param {string|string[]} className - Class name(s) to remove
     * @returns {boolean} True if class was removed
     */
    static removeClass(element, className) {
        const el = typeof element === 'string' ? this.getElementById(element) : element;
        if (!el) return false;

        if (Array.isArray(className)) {
            className.forEach(cls => el.classList.remove(cls));
        } else if (typeof className === 'string') {
            el.classList.remove(className);
        }
        return true;
    }

    /**
     * Toggle CSS class on element
     * @param {HTMLElement|string} element - Element or element ID
     * @param {string} className - Class name to toggle
     * @returns {boolean} True if class is now present
     */
    static toggleClass(element, className) {
        const el = typeof element === 'string' ? this.getElementById(element) : element;
        if (!el || typeof className !== 'string') return false;

        return el.classList.toggle(className);
    }

    /**
     * Check if element has CSS class
     * @param {HTMLElement|string} element - Element or element ID
     * @param {string} className - Class name to check
     * @returns {boolean} True if element has class
     */
    static hasClass(element, className) {
        const el = typeof element === 'string' ? this.getElementById(element) : element;
        if (!el || typeof className !== 'string') return false;

        return el.classList.contains(className);
    }

    /**
     * Set element style properties
     * @param {HTMLElement|string} element - Element or element ID
     * @param {Object} styles - Object with style property-value pairs
     * @returns {boolean} True if styles were applied
     */
    static setStyles(element, styles) {
        const el = typeof element === 'string' ? this.getElementById(element) : element;
        if (!el || !styles || typeof styles !== 'object') return false;

        Object.entries(styles).forEach(([property, value]) => {
            el.style[property] = value;
        });
        return true;
    }

    /**
     * Get computed style property value
     * @param {HTMLElement|string} element - Element or element ID
     * @param {string} property - CSS property name
     * @returns {string} Computed style value
     */
    static getComputedStyle(element, property) {
        const el = typeof element === 'string' ? this.getElementById(element) : element;
        if (!el || typeof property !== 'string') return '';

        return window.getComputedStyle(el).getPropertyValue(property);
    }

    /**
     * Check if element is visible in viewport
     * @param {HTMLElement|string} element - Element or element ID
     * @returns {boolean} True if element is visible
     */
    static isElementVisible(element) {
        const el = typeof element === 'string' ? this.getElementById(element) : element;
        if (!el) return false;

        const rect = el.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    /**
     * Scroll element into view smoothly
     * @param {HTMLElement|string} element - Element or element ID
     * @param {Object} options - Scroll options
     * @returns {boolean} True if scroll was initiated
     */
    static scrollIntoView(element, options = { behavior: 'smooth', block: 'center' }) {
        const el = typeof element === 'string' ? this.getElementById(element) : element;
        if (!el) return false;

        el.scrollIntoView(options);
        return true;
    }

    /**
     * Check if text content is truncated (overflowing)
     * @param {HTMLElement} element - Element to check
     * @param {string} text - Text content to check
     * @returns {boolean} True if text is truncated
     */
    static isTextTruncated(element, text) {
        if (!element || !text || typeof text !== 'string') {
            return false;
        }

        // Create temporary element to measure text width
        const tempSpan = document.createElement('span');
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.position = 'absolute';
        tempSpan.style.whiteSpace = 'nowrap';
        tempSpan.style.font = window.getComputedStyle(element).font;
        tempSpan.textContent = text;
        document.body.appendChild(tempSpan);

        const isOverflowing = tempSpan.offsetWidth > element.offsetWidth;
        document.body.removeChild(tempSpan);

        return isOverflowing;
    }

    /**
     * Add event listener with automatic cleanup
     * @param {HTMLElement|string} element - Element or element ID
     * @param {string} event - Event type
     * @param {Function} handler - Event handler function
     * @param {Object} options - Event listener options
     * @returns {Function} Cleanup function to remove the listener
     */
    static addEventListener(element, event, handler, options = {}) {
        const el = typeof element === 'string' ? this.getElementById(element) : element;
        if (!el || typeof event !== 'string' || typeof handler !== 'function') {
            return () => {}; // Return empty cleanup function
        }

        el.addEventListener(event, handler, options);

        // Return cleanup function
        return () => {
            el.removeEventListener(event, handler, options);
        };
    }

    /**
     * Debounce function calls
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle function calls
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in milliseconds
     * @returns {Function} Throttled function
     */
    static throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DomUtils;
} else {
    window.DomUtils = DomUtils;
}