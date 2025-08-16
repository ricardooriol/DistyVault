# Frontend Utility Modules

This directory contains modular utility functions extracted from the main application to improve code organization and reusability.

## Modules Overview

### ViewportUtils (`viewportUtils.js`)
Provides utilities for viewport calculations and element positioning.

**Key Functions:**
- `getViewportDimensions()` - Get current viewport width and height
- `getElementPosition(element)` - Get element's position relative to viewport
- `calculateAvailableSpace(element)` - Calculate available space around an element
- `wouldExtendBeyondViewport(element, width, height)` - Check if element would extend beyond viewport
- `getOptimalDropdownPosition(trigger, dropdown)` - Calculate optimal dropdown positioning

**Usage:**
```javascript
const viewport = ViewportUtils.getViewportDimensions();
const position = ViewportUtils.getElementPosition(myElement);
```

### DateUtils (`dateUtils.js`)
Provides utilities for date formatting, time calculations, and duration display.

**Key Functions:**
- `formatTimeDisplay(seconds)` - Format duration in seconds to "Xm Ys" format
- `calculateProcessingTimeDisplay(item)` - Calculate processing time for items with different statuses
- `formatDate(date)` - Format date to readable string
- `formatDateShort(date)` - Format date to short relative string ("Today", "Yesterday", etc.)
- `calculateElapsedSeconds(startDate, endDate)` - Calculate elapsed time between dates
- `isToday(date)` - Check if date is today
- `getRelativeTime(date)` - Get relative time string ("2 minutes ago", etc.)

**Usage:**
```javascript
const timeDisplay = DateUtils.formatTimeDisplay(125); // "2m 5s"
const processingTime = DateUtils.calculateProcessingTimeDisplay(item);
const isToday = DateUtils.isToday(new Date());
```

### ValidationUtils (`validationUtils.js`)
Provides utilities for input validation and data validation.

**Key Functions:**
- `isValidUrl(string)` - Validate URL format
- `isValidEmail(email)` - Validate email format
- `isNotEmpty(str)` - Check if string is not empty after trimming
- `isValidNumber(value)` - Check if value is a valid number
- `matchesPattern(str, pattern)` - Check if string matches regex pattern
- `isValidFileType(file, allowedExtensions)` - Validate file type
- `isValidFileSize(file, maxSizeBytes)` - Validate file size
- `isYouTubeUrl(url)` - Check if URL is a YouTube URL
- `sanitizeHtml(html)` - Sanitize HTML string
- `isAlphanumericWithSpecial(str, allowedChars)` - Validate alphanumeric with special chars
- `isValidLength(str, minLength, maxLength)` - Validate string length
- `validateMultiple(value, validations)` - Validate against multiple conditions

**Usage:**
```javascript
const isValid = ValidationUtils.isValidUrl('https://example.com');
const isEmail = ValidationUtils.isValidEmail('user@domain.com');
const isEmpty = ValidationUtils.isNotEmpty('  '); // false
```

### DomUtils (`domUtils.js`)
Provides utilities for DOM manipulation and common DOM operations.

**Key Functions:**
- `getElementById(id)` - Safely get element by ID
- `querySelector(selector, parent)` - Safely query selector
- `querySelectorAll(selector, parent)` - Safely query all elements
- `createElement(tagName, attributes, content)` - Create element with attributes
- `removeElement(element)` - Safely remove element from DOM
- `addClass(element, className)` - Add CSS class to element
- `removeClass(element, className)` - Remove CSS class from element
- `toggleClass(element, className)` - Toggle CSS class on element
- `hasClass(element, className)` - Check if element has CSS class
- `setStyles(element, styles)` - Set multiple style properties
- `getComputedStyle(element, property)` - Get computed style property
- `isElementVisible(element)` - Check if element is visible in viewport
- `scrollIntoView(element, options)` - Scroll element into view
- `isTextTruncated(element, text)` - Check if text is truncated
- `addEventListener(element, event, handler, options)` - Add event listener with cleanup
- `debounce(func, wait)` - Debounce function calls
- `throttle(func, limit)` - Throttle function calls

**Usage:**
```javascript
const element = DomUtils.getElementById('my-element');
const newDiv = DomUtils.createElement('div', { className: 'my-class' }, 'Content');
DomUtils.addClass(element, 'active');
const debouncedFn = DomUtils.debounce(myFunction, 300);
```

## Integration with Main Application

These utility modules are loaded before the main `app.js` file in `index.html`:

```html
<!-- Utility Modules -->
<script src="src/utils/viewportUtils.js"></script>
<script src="src/utils/dateUtils.js"></script>
<script src="src/utils/validationUtils.js"></script>
<script src="src/utils/domUtils.js"></script>

<!-- Main Application -->
<script src="app.js"></script>
```

## Extracted Functionality

The following functions were extracted from the main `app.js` file:

### From ViewportUtils class (previously inline):
- All viewport calculation methods
- Dropdown positioning logic

### From time formatting functions:
- `formatTimeDisplay()` → `DateUtils.formatTimeDisplay()`
- `calculateProcessingTimeDisplay()` → `DateUtils.calculateProcessingTimeDisplay()`

### From validation functions:
- `isValidUrl()` → `ValidationUtils.isValidUrl()`

### From DOM manipulation:
- `document.getElementById()` calls → `DomUtils.getElementById()`
- `document.querySelector()` calls → `DomUtils.querySelector()`
- `document.createElement()` calls → `DomUtils.createElement()`
- Text truncation detection → `DomUtils.isTextTruncated()`

## Testing

All utility modules are thoroughly tested with unit tests in `tests/unit/utility-modules.test.js`. The tests cover:

- Individual function behavior
- Edge cases and error handling
- Integration with existing application patterns
- Browser and Node.js compatibility

Run tests with:
```bash
npm run test:unit
```

## Browser Compatibility

All utility modules are designed to work in modern browsers and include fallbacks for older browsers where necessary. They use standard JavaScript APIs and avoid dependencies on external libraries.

## Node.js Compatibility

The utility modules can also be used in Node.js environments (for testing or server-side rendering) by including appropriate polyfills for DOM-related functions.