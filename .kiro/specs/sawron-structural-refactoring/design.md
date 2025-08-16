# Design Document

## Overview

This design document outlines the comprehensive structural refactoring of the SAWRON knowledge distillation platform. The refactoring will transform the current monolithic structure into a modular, maintainable architecture following industry best practices. The design focuses on separating concerns, eliminating code duplication, and organizing code into logical, reusable components while maintaining 100% functional and visual compatibility.

The refactoring will address the main pain points: the 3602-line frontend JavaScript file, the 3304-line CSS file, and the need for better backend organization. The new structure will follow conventional patterns used in professional Node.js applications with clear separation between frontend components, backend services, and shared utilities.

## Architecture

### High-Level Structure

The refactored application will follow a conventional full-stack architecture:

```
sawron/
├── src/                          # Backend source code
│   ├── controllers/              # Route handlers and business logic
│   ├── middleware/               # Express middleware functions
│   ├── models/                   # Data models and schemas
│   ├── routes/                   # API route definitions
│   ├── services/                 # Business logic and external integrations
│   └── utils/                    # Backend utility functions
├── public/                       # Frontend static assets
│   ├── src/                      # Frontend source code
│   │   ├── components/           # UI components and managers
│   │   ├── core/                 # Core application logic
│   │   ├── utils/                # Frontend utility functions
│   │   └── managers/             # State and resource managers
│   ├── styles/                   # Modular CSS organization
│   │   ├── base/                 # Base styles and resets
│   │   ├── components/           # Component-specific styles
│   │   ├── layout/               # Layout and grid styles
│   │   └── utilities/            # Utility classes and mixins
│   ├── index.html                # Main HTML template
│   └── app.js                    # Frontend entry point
├── data/                         # Database and data files
├── uploads/                      # File upload directory
├── tests/                        # Test suites
├── server.js                     # Application entry point
└── package.json                  # Dependencies and scripts
```

### Frontend Architecture

The frontend will be organized into a modular structure that separates concerns and promotes reusability:

**Core Application (`public/src/core/`)**
- `sawronApp.js` - Main application class and initialization
- `apiClient.js` - Centralized API communication
- `eventBus.js` - Event management and communication between components

**Component Managers (`public/src/managers/`)**
- `downloadStateManager.js` - Download state tracking and UI updates
- `tooltipManager.js` - Tooltip display and positioning logic
- `modalManager.js` - Modal dialog management
- `bulkActionsManager.js` - Bulk operations handling

**UI Components (`public/src/components/`)**
- `knowledgeBaseTable.js` - Table rendering and interaction
- `inputSection.js` - File upload and URL input handling
- `statusSection.js` - Processing status display
- `settingsModal.js` - AI settings configuration

**Utilities (`public/src/utils/`)**
- `viewportUtils.js` - Viewport and positioning calculations
- `dateUtils.js` - Date formatting and manipulation
- `validationUtils.js` - Input validation helpers
- `domUtils.js` - DOM manipulation utilities

### Backend Architecture

The backend will follow a conventional MVC-like pattern with clear separation of concerns:

**Controllers (`src/controllers/`)**
- `distillationController.js` - Handles distillation CRUD operations
- `processingController.js` - Manages content processing workflows
- `aiSettingsController.js` - AI provider configuration management
- `healthController.js` - System health and status endpoints

**Services (`src/services/`)**
- Existing service structure will be preserved but moved to new location
- Services will be enhanced with better error handling and logging
- Dependencies between services will be clearly documented

**Routes (`src/routes/`)**
- Route definitions will be extracted from server.js
- Each controller will have corresponding route files
- Middleware will be applied consistently across routes

**Models (`src/models/`)**
- Existing Distillation model will be enhanced
- Additional models for configuration and settings
- Data validation and transformation logic

## Components and Interfaces

### Frontend Component Interfaces

**SawronApp (Main Application Class)**
```javascript
class SawronApp {
    constructor()
    init()
    setupEventListeners()
    loadKnowledgeBase()
    startAutoRefresh()
}
```

**DownloadStateManager**
```javascript
class DownloadStateManager {
    createDownloadState(buttonId)
    getDownloadState(buttonId)
    setDownloadState(buttonId, newState, options)
    cancelDownload(buttonId)
    updateButtonUI(buttonId, state)
}
```

**TooltipManager**
```javascript
class TooltipManager {
    showTooltip(element, text)
    hideTooltip()
    createTooltip(element, text)
    cleanup()
}
```

**KnowledgeBaseTable**
```javascript
class KnowledgeBaseTable {
    render(data)
    updateRow(item)
    handleSelection(itemId)
    applyFilters(searchTerm, filterType)
    sortData(sortBy, direction)
}
```

### Backend Controller Interfaces

**DistillationController**
```javascript
class DistillationController {
    async getAllDistillations(req, res)
    async getDistillation(req, res)
    async deleteDistillation(req, res)
    async retryDistillation(req, res)
    async bulkDelete(req, res)
    async downloadPdf(req, res)
    async bulkDownload(req, res)
}
```

**ProcessingController**
```javascript
class ProcessingController {
    async processUrl(req, res)
    async processFile(req, res)
    async stopProcess(req, res)
    async getProcessingStatus(req, res)
}
```

### API Client Interface

**ApiClient (Centralized API Communication)**
```javascript
class ApiClient {
    async get(endpoint)
    async post(endpoint, data)
    async put(endpoint, data)
    async delete(endpoint)
    async uploadFile(endpoint, file)
    handleError(error)
    setAuthToken(token)
}
```

## Data Models

### Enhanced Distillation Model

The existing Distillation model will be enhanced with better validation and methods:

```javascript
class Distillation {
    constructor(data)
    validate()
    toJSON()
    addLog(message, level)
    updateStatus(status, step)
    calculateProcessingTime()
    static fromDatabase(row)
    static create(data)
}
```

### Configuration Models

**AIProviderConfig**
```javascript
class AIProviderConfig {
    constructor(config)
    validate()
    getProviderInstance()
    testConnection()
    static getAvailableProviders()
}
```

**AppSettings**
```javascript
class AppSettings {
    constructor(settings)
    validate()
    save()
    load()
    reset()
    merge(newSettings)
}
```

## Error Handling

### Frontend Error Handling

**Centralized Error Management**
- `ErrorHandler` class to manage all frontend errors
- Consistent error display across components
- User-friendly error messages with technical details in console
- Automatic error reporting for debugging

**Component-Level Error Handling**
- Each component will have try-catch blocks for critical operations
- Graceful degradation when components fail
- Error boundaries to prevent cascade failures

### Backend Error Handling

**Middleware-Based Error Handling**
- Global error handler middleware
- Consistent error response format
- Logging integration for debugging
- Rate limiting and security error handling

**Service-Level Error Handling**
- Comprehensive error catching in all services
- Proper error propagation with context
- Retry logic for transient failures
- Circuit breaker pattern for external services

## Testing Strategy

### Unit Testing

**Frontend Unit Tests**
- Jest-based testing for all utility functions
- Component testing for UI managers
- Mock API responses for isolated testing
- Coverage requirements: 80% minimum

**Backend Unit Tests**
- Controller testing with mocked dependencies
- Service testing with isolated database operations
- Model validation testing
- API endpoint testing with supertest

### Integration Testing

**End-to-End Testing**
- Comprehensive test suite covering all user workflows
- URL processing from input to completion
- File upload and processing validation
- AI provider integration testing
- Database operations verification

**Component Integration Testing**
- Frontend component interaction testing
- API client integration with backend
- State management across components
- Event handling between modules

### Performance Testing

**Frontend Performance**
- Bundle size optimization validation
- Component rendering performance
- Memory leak detection
- Browser compatibility testing

**Backend Performance**
- API response time validation
- Database query optimization
- Memory usage monitoring
- Concurrent processing testing

## CSS Architecture

### Modular Stylesheet Organization

**Base Styles (`public/styles/base/`)**
- `reset.css` - CSS reset and normalization
- `variables.css` - CSS custom properties and design tokens
- `typography.css` - Font definitions and text styles
- `layout.css` - Grid systems and layout utilities

**Component Styles (`public/styles/components/`)**
- `buttons.css` - Button styles and variants
- `forms.css` - Form elements and validation styles
- `modals.css` - Modal dialog styles
- `tables.css` - Table and data display styles
- `tooltips.css` - Tooltip positioning and appearance
- `cards.css` - Card components and containers

**Layout Styles (`public/styles/layout/`)**
- `header.css` - Application header and navigation
- `main.css` - Main content area layout
- `sidebar.css` - Sidebar and secondary navigation
- `footer.css` - Footer and bottom elements

**Utility Styles (`public/styles/utilities/`)**
- `spacing.css` - Margin and padding utilities
- `colors.css` - Color utility classes
- `animations.css` - Transition and animation utilities
- `responsive.css` - Responsive design utilities

### CSS Import Strategy

The main stylesheet will import modules in the correct order:
1. Base styles (reset, variables, typography)
2. Layout styles (header, main, footer)
3. Component styles (buttons, forms, modals)
4. Utility styles (spacing, colors, animations)

## File Organization Strategy

### Naming Conventions

**Files and Directories**
- JavaScript files: camelCase (e.g., `downloadStateManager.js`)
- CSS files: camelCase (e.g., `knowledgeBaseTable.css`)
- Directories: camelCase for source code, kebab-case for public assets
- Test files: `*.test.js` or `*.spec.js`

**Code Organization Rules**
- Maximum 300 lines per file for maintainability
- Single responsibility principle for each module
- Clear import/export statements
- Consistent code formatting with Prettier

### Dependency Management

**Frontend Dependencies**
- Clear separation between internal and external dependencies
- Centralized API client to reduce coupling
- Event-driven communication between components
- Minimal global state, prefer local component state

**Backend Dependencies**
- Service layer abstraction for external dependencies
- Dependency injection for testability
- Clear interfaces between layers
- Configuration-driven service selection

## Migration Strategy

### Phase 1: Backend Restructuring
1. Create new directory structure
2. Extract controllers from server.js
3. Move existing services to new locations
4. Update import paths and dependencies
5. Test all API endpoints

### Phase 2: Frontend Modularization
1. Create frontend directory structure
2. Extract utility functions first
3. Create manager classes for state management
4. Split UI components into separate files
5. Update HTML to load modular scripts

### Phase 3: CSS Refactoring
1. Analyze current CSS for component boundaries
2. Create base stylesheets with variables
3. Extract component-specific styles
4. Organize layout and utility styles
5. Test visual consistency across browsers

### Phase 4: Code Cleanup
1. Identify and remove duplicate functions
2. Eliminate unused variables and imports
3. Consolidate similar functionality
4. Optimize performance bottlenecks
5. Update documentation

### Phase 5: Testing and Validation
1. Run comprehensive test suite after each phase
2. Validate all functionality remains identical
3. Performance testing and optimization
4. Cross-browser compatibility testing
5. Final integration testing

## Quality Assurance

### Code Quality Standards
- ESLint configuration for consistent code style
- Prettier for automatic code formatting
- JSDoc comments for all public methods
- TypeScript definitions for better IDE support

### Performance Optimization
- Bundle size monitoring and optimization
- Lazy loading for non-critical components
- Database query optimization
- Caching strategies for frequently accessed data

### Security Considerations
- Input validation at all entry points
- Secure file upload handling
- API rate limiting and authentication
- XSS and CSRF protection measures