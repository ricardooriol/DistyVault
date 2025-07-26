# Design Document

## Overview

The numbered list display issue stems from a combination of JavaScript logic that generates manual numbering and CSS styling that needs to properly override browser defaults. The current implementation generates the correct HTML structure but the CSS is not effectively applied, causing browsers to fall back to default numbering behavior.

## Architecture

The numbered list system consists of three main components:

1. **JavaScript Markdown Parser** (`public/app.js`) - Converts markdown numbered lists to HTML with manual numbering
2. **CSS Styling System** (`public/styles.css`) - Provides visual styling and overrides browser defaults
3. **HTML Structure** - Uses `<ol class="manual-numbered">` with `<span class="list-number">` elements

## Components and Interfaces

### JavaScript Component

**Location:** `public/app.js` - `markdownToHtml()` method

**Current Logic:**
```javascript
// Ordered list items - GENERATE NUMBERS MANUALLY
const orderedMatch = trimmedLine.match(/^\d+\. (.+)$/);
if (orderedMatch) {
    if (!inList || listType !== 'ol') {
        if (inList) result.push(`</${listType}>`);
        result.push('<ol class="manual-numbered">');
        inList = true;
        listType = 'ol';
        listCounter = 0;
    }
    listCounter++;
    const content = this.processInlineMarkdown(orderedMatch[1]);
    result.push(`<li><span class="list-number">${listCounter}.</span> ${content}</li>`);
    continue;
}
```

**Issues Identified:**
- Logic appears correct but may have edge cases with list counter reset
- Need to ensure proper list termination and counter reset

### CSS Component

**Location:** `public/styles.css`

**Required Styles:**
- Complete override of browser default `<ol>` numbering
- Proper styling for `.list-number` spans
- Ensure styles are applied with sufficient specificity

**Critical CSS Rules Needed:**
```css
ol.manual-numbered {
    list-style: none !important;
    counter-reset: none !important;
    padding-left: 0 !important;
}

ol.manual-numbered li {
    list-style: none !important;
    display: block !important;
}

ol.manual-numbered li::marker {
    display: none !important;
}

.list-number {
    color: var(--text-primary) !important;
    font-weight: bold !important;
    margin-right: 0.5rem !important;
}
```

### HTML Structure

**Target Structure:**
```html
<ol class="manual-numbered">
    <li><span class="list-number">1.</span> First item</li>
    <li><span class="list-number">2.</span> Second item</li>
    <li><span class="list-number">3.</span> Third item</li>
</ol>
```

## Data Models

### List State Tracking
```javascript
{
    inList: boolean,
    listType: 'ol' | 'ul' | null,
    listCounter: number,
    currentParagraph: string[]
}
```

### CSS Selector Hierarchy
```
.modal-body ol.manual-numbered li .list-number  // Highest specificity
ol.manual-numbered li .list-number              // Medium specificity  
.list-number                                    // Fallback
```

## Error Handling

### CSS Loading Issues
- Add CSS loading verification
- Implement fallback styles
- Use multiple selector specificity levels

### JavaScript Counter Issues
- Ensure counter resets between lists
- Handle edge cases with empty lines
- Proper list termination

### Browser Compatibility
- Use `!important` declarations to override defaults
- Target `::marker` pseudo-element specifically
- Disable browser counter mechanisms

## Testing Strategy

### Unit Testing
1. **JavaScript Logic Testing**
   - Test counter increment logic
   - Test list termination and reset
   - Test edge cases with mixed content

2. **CSS Application Testing**
   - Verify styles override browser defaults
   - Test across different browsers
   - Verify specificity hierarchy

### Integration Testing
1. **End-to-End Flow Testing**
   - Test markdown input → HTML output → CSS styling
   - Test multiple lists in same content
   - Test list interruption and restart

### Manual Testing
1. **Visual Verification**
   - Create test pages with known numbered lists
   - Verify sequential numbering displays correctly
   - Verify black bold styling without backgrounds

### Debug Tools
1. **CSS Debug Markers**
   - Add temporary visual indicators
   - Console logging for counter values
   - HTML structure inspection tools

## Implementation Approach

### Phase 1: CSS Foundation
1. Remove all existing numbered list CSS
2. Add comprehensive CSS reset for `ol.manual-numbered`
3. Add proper `.list-number` styling
4. Test with static HTML

### Phase 2: JavaScript Verification
1. Add debug logging to counter logic
2. Verify counter reset behavior
3. Test edge cases
4. Ensure proper HTML generation

### Phase 3: Integration and Testing
1. Test complete flow with real content
2. Verify across browsers
3. Add permanent debug capabilities
4. Performance verification

## Success Criteria

1. Numbered lists display sequential numbering (1., 2., 3., 4.)
2. Numbers are black, bold, without background decoration
3. Multiple lists each start from 1 and increment properly
4. Solution works consistently across browsers
5. CSS changes don't affect other list types
6. Implementation is maintainable and debuggable