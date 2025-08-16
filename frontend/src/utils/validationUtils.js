/**
 * Validation Utilities
 * Provides utilities for input validation, data validation, and format checking.
 */
class ValidationUtils {
    /**
     * Check if a string is a valid URL
     * @param {string} string - String to validate
     * @returns {boolean} True if string is a valid URL
     */
    static isValidUrl(string) {
        if (!string || typeof string !== 'string') {
            return false;
        }

        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    /**
     * Check if a string is a valid email address
     * @param {string} email - Email string to validate
     * @returns {boolean} True if email is valid
     */
    static isValidEmail(email) {
        if (!email || typeof email !== 'string') {
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Check if a string is not empty after trimming
     * @param {string} str - String to validate
     * @returns {boolean} True if string is not empty
     */
    static isNotEmpty(str) {
        if (!str || typeof str !== 'string') {
            return false;
        }
        return str.trim().length > 0;
    }

    /**
     * Check if a value is a valid number
     * @param {any} value - Value to validate
     * @returns {boolean} True if value is a valid number
     */
    static isValidNumber(value) {
        return !isNaN(value) && !isNaN(parseFloat(value)) && isFinite(value);
    }

    /**
     * Check if a string matches a specific pattern
     * @param {string} str - String to validate
     * @param {RegExp} pattern - Regular expression pattern
     * @returns {boolean} True if string matches pattern
     */
    static matchesPattern(str, pattern) {
        if (!str || typeof str !== 'string' || !(pattern instanceof RegExp)) {
            return false;
        }
        return pattern.test(str);
    }

    /**
     * Validate file type based on allowed extensions and MIME types
     * @param {File} file - File object to validate
     * @param {string[]} allowedExtensions - Array of allowed extensions (e.g., ['.pdf', '.txt'])
     * @param {string[]} allowedMimeTypes - Array of allowed MIME types (optional)
     * @returns {boolean} True if file type is allowed
     */
    static isValidFileType(file, allowedExtensions, allowedMimeTypes = []) {
        if (!file || !file.name || !Array.isArray(allowedExtensions)) {
            return false;
        }

        const fileName = file.name.toLowerCase();
        const extensionMatch = allowedExtensions.some(ext => fileName.endsWith(ext.toLowerCase()));
        
        // If MIME types are provided, check both extension and MIME type
        if (allowedMimeTypes.length > 0) {
            const mimeTypeMatch = allowedMimeTypes.includes(file.type);
            return extensionMatch || mimeTypeMatch;
        }
        
        return extensionMatch;
    }

    /**
     * Validate common document file types (PDF, DOC, DOCX, TXT)
     * @param {File} file - File object to validate
     * @returns {boolean} True if file is a valid document type
     */
    static isValidDocumentFile(file) {
        const validExtensions = ['.pdf', '.doc', '.docx', '.txt'];
        const validMimeTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain'
        ];
        
        return this.isValidFileType(file, validExtensions, validMimeTypes);
    }

    /**
     * Validate file size
     * @param {File} file - File object to validate
     * @param {number} maxSizeBytes - Maximum allowed size in bytes
     * @returns {boolean} True if file size is within limit
     */
    static isValidFileSize(file, maxSizeBytes) {
        if (!file || typeof maxSizeBytes !== 'number') {
            return false;
        }
        return file.size <= maxSizeBytes;
    }

    /**
     * Check if a string is a valid YouTube URL
     * @param {string} url - URL to validate
     * @returns {boolean} True if URL is a valid YouTube URL
     */
    static isYouTubeUrl(url) {
        if (!this.isValidUrl(url)) {
            return false;
        }

        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
        return youtubeRegex.test(url);
    }

    /**
     * Sanitize HTML string by removing potentially dangerous elements
     * @param {string} html - HTML string to sanitize
     * @returns {string} Sanitized HTML string
     */
    static sanitizeHtml(html) {
        if (!html || typeof html !== 'string') {
            return '';
        }

        // Create a temporary div to parse HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Remove script tags and event handlers
        const scripts = temp.querySelectorAll('script');
        scripts.forEach(script => script.remove());

        // Remove potentially dangerous attributes
        const allElements = temp.querySelectorAll('*');
        allElements.forEach(element => {
            const attributes = [...element.attributes];
            attributes.forEach(attr => {
                if (attr.name.startsWith('on') || attr.name === 'javascript:') {
                    element.removeAttribute(attr.name);
                }
            });
        });

        return temp.innerHTML;
    }

    /**
     * Validate that a string contains only alphanumeric characters and allowed special characters
     * @param {string} str - String to validate
     * @param {string} allowedSpecialChars - String of allowed special characters (default: '-_')
     * @returns {boolean} True if string is valid
     */
    static isAlphanumericWithSpecial(str, allowedSpecialChars = '-_') {
        if (!str || typeof str !== 'string') {
            return false;
        }

        const pattern = new RegExp(`^[a-zA-Z0-9${allowedSpecialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]+$`);
        return pattern.test(str);
    }

    /**
     * Check if a string is within specified length limits
     * @param {string} str - String to validate
     * @param {number} minLength - Minimum length (default: 0)
     * @param {number} maxLength - Maximum length (default: Infinity)
     * @returns {boolean} True if string length is within limits
     */
    static isValidLength(str, minLength = 0, maxLength = Infinity) {
        if (!str || typeof str !== 'string') {
            return minLength === 0;
        }

        const length = str.trim().length;
        return length >= minLength && length <= maxLength;
    }

    /**
     * Validate multiple conditions and return detailed results
     * @param {any} value - Value to validate
     * @param {Object[]} validations - Array of validation objects with {test, message} properties
     * @returns {Object} Object with {isValid, errors} properties
     */
    static validateMultiple(value, validations) {
        const errors = [];
        
        if (!Array.isArray(validations)) {
            return { isValid: true, errors: [] };
        }

        validations.forEach(validation => {
            if (typeof validation.test === 'function') {
                if (!validation.test(value)) {
                    errors.push(validation.message || 'Validation failed');
                }
            }
        });

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValidationUtils;
} else {
    window.ValidationUtils = ValidationUtils;
}