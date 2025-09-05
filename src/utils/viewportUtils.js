/**
 * Viewport Boundary Detection Utilities
 * Provides utilities for calculating viewport dimensions, element positions,
 * and optimal positioning for dropdowns and tooltips.
 */
class ViewportUtils {
    /**
     * Get current viewport dimensions
     * @returns {Object} Object with width and height properties
     */
    static getViewportDimensions() {
        return {
            width: window.innerWidth,
            height: window.innerHeight
        };
    }

    /**
     * Get element position relative to viewport
     * @param {HTMLElement} element - The element to get position for
     * @returns {Object} Object with position and dimension properties
     */
    static getElementPosition(element) {
        const rect = element.getBoundingClientRect();
        return {
            top: rect.top,
            left: rect.left,
            bottom: rect.bottom,
            right: rect.right,
            width: rect.width,
            height: rect.height
        };
    }

    /**
     * Calculate available space around an element
     * @param {HTMLElement} element - The element to calculate space around
     * @returns {Object} Object with available space in each direction
     */
    static calculateAvailableSpace(element) {
        const elementPos = this.getElementPosition(element);
        const viewport = this.getViewportDimensions();

        return {
            top: elementPos.top,
            bottom: viewport.height - elementPos.bottom,
            left: elementPos.left,
            right: viewport.width - elementPos.right
        };
    }

    /**
     * Check if a dropdown would extend beyond viewport boundaries
     * @param {HTMLElement} element - The trigger element
     * @param {number} dropdownWidth - Width of the dropdown
     * @param {number} dropdownHeight - Height of the dropdown
     * @returns {Object} Object indicating which boundaries would be exceeded
     */
    static wouldExtendBeyondViewport(element, dropdownWidth, dropdownHeight) {
        const elementPos = this.getElementPosition(element);
        const viewport = this.getViewportDimensions();

        return {
            right: (elementPos.right + dropdownWidth) > viewport.width,
            bottom: (elementPos.bottom + dropdownHeight) > viewport.height,
            left: (elementPos.left - dropdownWidth) < 0,
            top: (elementPos.top - dropdownHeight) < 0
        };
    }

    /**
     * Calculate optimal position for a dropdown element
     * @param {HTMLElement} triggerElement - The element that triggers the dropdown
     * @param {HTMLElement} dropdownElement - The dropdown element to position
     * @returns {Object} Object with optimal top and left positions
     */
    static getOptimalDropdownPosition(triggerElement, dropdownElement) {
        const triggerPos = this.getElementPosition(triggerElement);
        const dropdownRect = dropdownElement.getBoundingClientRect();
        const viewport = this.getViewportDimensions();

        let position = {
            top: triggerPos.bottom + 4, // Default: below trigger
            left: triggerPos.right - dropdownRect.width // Default: right-aligned
        };

        // Check if dropdown extends beyond right edge
        if (position.left + dropdownRect.width > viewport.width - 10) {
            position.left = triggerPos.left; // Left-align instead
        }

        // Check if dropdown extends beyond left edge
        if (position.left < 10) {
            position.left = 10;
        }

        // Check if dropdown extends beyond bottom edge
        if (position.top + dropdownRect.height > viewport.height - 10) {
            position.top = triggerPos.top - dropdownRect.height - 4; // Position above
        }

        // Check if dropdown extends beyond top edge
        if (position.top < 10) {
            position.top = triggerPos.bottom + 4; // Force below
        }

        return position;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ViewportUtils;
} else {
    window.ViewportUtils = ViewportUtils;
}