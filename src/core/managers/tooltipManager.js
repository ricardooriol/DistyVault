// Enhanced Tooltip Manager - Fixed positioning and stuck tooltip issues
class TooltipManager {
    constructor() {
        this.activeTooltip = null;
        this.showTimeoutId = null;
        this.hideTimeoutId = null;
        this.targetElement = null;
        this.isMouseOverTooltip = false;
    }

    showTooltip(element, text) {
        try {
            // Clear any pending hide timeout
            if (this.hideTimeoutId) {
                clearTimeout(this.hideTimeoutId);
                this.hideTimeoutId = null;
            }

            // If tooltip is already showing for this element, don't recreate
            if (this.activeTooltip && this.targetElement === element) {
                return;
            }

            this.cleanup();

            if (!element || !text || typeof text !== 'string' || text.trim() === '') {
                return;
            }

            // Only show tooltip if text is actually truncated
            if (!this.isTextTruncated(element, text)) {
                return;
            }

            // Delay showing tooltip to prevent flickering
            this.showTimeoutId = setTimeout(() => {
                this.createTooltip(element, text);
            }, 300);

        } catch (error) {
            console.warn('Error showing tooltip:', error);
            this.cleanup();
        }
    }

    createTooltip(element, text) {
        try {
            // Create tooltip using DomUtils
            this.activeTooltip = DomUtils.createElement('div', {
                className: 'tooltip',
                textContent: text
            });
            document.body.appendChild(this.activeTooltip);

            // Position tooltip above the element with proper centering
            const elementRect = element.getBoundingClientRect();
            const tooltipRect = this.activeTooltip.getBoundingClientRect();

            let left = elementRect.left + (elementRect.width / 2) - (tooltipRect.width / 2);
            let top = elementRect.top;

            // Keep tooltip within viewport bounds
            const padding = 10;
            if (left < padding) {
                left = padding;
            } else if (left + tooltipRect.width > window.innerWidth - padding) {
                left = window.innerWidth - tooltipRect.width - padding;
            }

            // Ensure tooltip doesn't go above viewport
            if (top < padding + tooltipRect.height) {
                top = elementRect.bottom + 8;
                // Flip arrow direction if showing below
                this.activeTooltip.classList.add('tooltip-below');
            }

            this.activeTooltip.style.left = left + 'px';
            this.activeTooltip.style.top = top + 'px';
            this.activeTooltip.classList.add('show');

            this.targetElement = element;

        } catch (error) {
            console.warn('Error creating tooltip:', error);
            this.cleanup();
        }
    }

    hideTooltip() {
        // Delay hiding to prevent flickering when moving between elements
        this.hideTimeoutId = setTimeout(() => {
            this.cleanup();
        }, 100);
    }

    isTextTruncated(element, text) {
        // Use DomUtils for text truncation detection
        return DomUtils.isTextTruncated(element, text);
    }

    cleanup() {
        if (this.showTimeoutId) {
            clearTimeout(this.showTimeoutId);
            this.showTimeoutId = null;
        }

        if (this.hideTimeoutId) {
            clearTimeout(this.hideTimeoutId);
            this.hideTimeoutId = null;
        }

        if (this.activeTooltip) {
            this.activeTooltip.remove();
            this.activeTooltip = null;
        }

        this.targetElement = null;
        this.isMouseOverTooltip = false;
    }

    cleanupStuckTooltips() {
        // Emergency cleanup for any stuck tooltips using DomUtils
        const stuckTooltips = DomUtils.querySelectorAll('.tooltip');
        stuckTooltips.forEach(tooltip => tooltip.remove());
        this.cleanup();
    }
}

// Export for use in other modules
window.TooltipManager = TooltipManager;