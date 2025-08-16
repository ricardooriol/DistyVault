# SAWRON Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [Directory Structure](#directory-structure)
3. [Module Dependencies](#module-dependencies)
4. [Development Guidelines](#development-guidelines)
5. [Developer Onboarding](#developer-onboarding)
6. [Design Rationale](#design-rationale)

## Overview

SAWRON follows a modern, modular architecture that separates frontend and backend concerns while maintaining clear boundaries between different types of functionality. The architecture emphasizes:

- **Separation of Concerns**: Clear boundaries between UI, business logic, and data layers
- **Modularity**: Small, focused modules with single responsibilities
- **Maintainability**: Easy to locate, understand, and modify specific functionality
- **Testability**: Components can be tested in isolation
- **Scalability**: Structure supports growth and feature additions

## Directory Structure

### Root Level Organization

```
sawron/
├── backend/                    # Server-side application code
├── frontend/                   # Client-side application code
├── tests/                      # Test suites and test utilities
├── data/                       # Database files and data storage
├── uploads/                    # File upload temporary storage
├── coverage/                   # Test coverage reports (generated)
├── node_modules/               # Dependencies (generated)
├── .kiro/                      # Kiro IDE configuration
├── server.js                   # Legacy server entry point (deprecated)
├── package.json                # Project configuration and dependencies
└── README.md                   # Project documentation
```

### Backend Structure (`backend/`)

```
backend/
├── src/                        # Main backend source code
│   ├── controllers/            # HTTP request handlers
│   │   ├── aiSettingsController.js      # AI provider configuration
│   │   ├── distillationController.js    # Content processing operations
│   │   ├── healthController.js          # System health endpoints
│   │   └── processingController.js      # Processing workflow management
│   ├── middleware/             # Express middleware functions
│   ├── models/                 # Data models and schemas
│   │   └── distillation.js     # Enhanced distillation model
│   ├── routes/                 # API route definitions
│   │   └── (route files)       # RESTful API endpoints
│   ├── services/               # Business logic services
│   │   ├── ai/                 # AI provider integrations
│   │   │   ├── aiProvider.js            # Base AI provider interface
│   │   │   ├── aiProviderFactory.js     # Provider factory pattern
│   │   │   ├── aiSettingsManager.js     # Settings management
│   │   │   ├── numberingProcessor.js    # Content numbering logic
│   │   │   └── providers/               # Specific AI implementations
│   │   │       ├── anthropic.js         # Anthropic Claude integration
│   │   │       ├── deepseek.js          # DeepSeek integration
│   │   │       ├── google.js            # Google Gemini integration
│   │   │       ├── grok.js              # Grok integration
│   │   │       ├── ollama.js            # Ollama local AI integration
│   │   │       └── openAI.js            # OpenAI integration
│   │   ├── contentExtractor.js          # Content extraction utilities
│   │   ├── database.js                  # Database operations
│   │   ├── processingQueue.js           # Async processing queue
│   │   ├── processor.js                 # Main processing orchestrator
│   │   └── youtubeTranscriptExtractor.js # YouTube content extraction
│   └── utils/                  # Backend utility functions
├── models/                     # Legacy models (to be migrated)
├── routes/                     # Legacy routes (to be migrated)
├── services/                   # Legacy services (to be migrated)
└── server.js                   # Express server entry point
```

### Frontend Structure (`frontend/`)

```
frontend/
├── src/                        # Frontend source code
│   ├── components/             # UI components
│   │   ├── inputSection.js              # File upload and URL input
│   │   ├── knowledgeBaseTable.js        # Data table display
│   │   ├── settingsModal.js             # AI settings configuration
│   │   └── statusSection.js             # Processing status display
│   ├── core/                   # Core application logic
│   │   ├── apiClient.js                 # Centralized API communication
│   │   ├── app.js                       # Main application controller
│   │   └── eventBus.js                  # Event management system
│   ├── managers/               # State and behavior managers
│   │   ├── bulkActionsManager.js        # Bulk operations handling
│   │   ├── downloadStateManager.js      # Download state tracking
│   │   ├── modalManager.js              # Modal dialog management
│   │   └── tooltipManager.js            # Tooltip display logic
│   ├── utils/                  # Frontend utilities
│   │   ├── dateUtils.js                 # Date formatting and manipulation
│   │   ├── domUtils.js                  # DOM manipulation helpers
│   │   ├── errorUtils.js                # Error handling utilities
│   │   ├── validationUtils.js           # Input validation helpers
│   │   └── viewportUtils.js             # Viewport calculations
│   └── init.js                 # Application initialization
├── styles/                     # Modular CSS organization
│   ├── base/                   # Foundation styles
│   │   ├── reset.css                    # CSS reset and normalization
│   │   ├── typography.css               # Font and text styles
│   │   └── variables.css                # CSS custom properties
│   ├── components/             # Component-specific styles
│   │   ├── buttons.css                  # Button styles and variants
│   │   ├── cards.css                    # Card component styles
│   │   ├── dropdowns.css                # Dropdown menu styles
│   │   ├── forms.css                    # Form element styles
│   │   ├── modals.css                   # Modal dialog styles
│   │   ├── tables.css                   # Table and data display
│   │   └── tooltips.css                 # Tooltip appearance
│   ├── layout/                 # Layout and structural styles
│   │   └── (layout files)               # Header, main, footer styles
│   ├── utilities/              # Utility classes
│   │   ├── animations.css               # Transitions and animations
│   │   ├── content.css                  # Content-specific utilities
│   │   ├── spacing.css                  # Margin and padding utilities
│   │   └── status.css                   # Status indicator styles
│   └── main.css                # Main stylesheet with imports
├── index.html                  # Main HTML template
├── app.js                      # Frontend entry point
└── styles.css                  # Legacy main stylesheet
```

### Test Structure (`tests/`)

```
tests/
├── e2e/                        # End-to-end tests
│   └── app.test.js             # Full application workflow tests
├── integration/                # Integration tests
│   ├── ai-provider.test.js     # AI provider integration tests
│   ├── database.test.js        # Database operation tests
│   └── processor.test.js       # Processing workflow tests
├── unit/                       # Unit tests
│   ├── frontend-components.test.js      # Frontend component tests
│   └── utility-modules.test.js          # Utility function tests
├── temp/                       # Temporary test files
├── automated-execution.test.js # Automated workflow tests
├── comprehensive-validation.test.js     # Full system validation
├── frontend-initialization.test.js      # Frontend startup tests
├── run-validation-tests.js     # Test runner utility
├── setup.js                    # Test environment setup
└── README.md                   # Testing documentation
```

## Module Dependencies

### Backend Dependencies

#### Controllers Layer
```
Controllers depend on:
├── Services (business logic)
├── Models (data structures)
└── Utils (helper functions)

Controllers do NOT depend on:
├── Other controllers
├── Routes (routes depend on controllers)
└── Frontend components
```

#### Services Layer
```
Services depend on:
├── Models (data structures)
├── External APIs (AI providers, databases)
├── Utils (helper functions)
└── Other services (composition)

Services do NOT depend on:
├── Controllers
├── Routes
└── Frontend components
```

#### AI Provider Dependencies
```
AI Providers:
├── aiProvider.js (base interface)
│   └── All providers implement this interface
├── aiProviderFactory.js
│   └── Depends on all provider implementations
├── aiSettingsManager.js
│   └── Depends on aiProviderFactory
└── Individual providers (anthropic.js, openAI.js, etc.)
    └── Depend only on aiProvider.js interface
```

### Frontend Dependencies

#### Core Layer
```
Core modules:
├── app.js (main controller)
│   ├── Depends on: apiClient, eventBus, all managers, all components
│   └── Entry point for entire frontend application
├── apiClient.js
│   ├── Depends on: errorUtils
│   └── Used by: app.js, components, managers
└── eventBus.js
    ├── Depends on: nothing (pure event system)
    └── Used by: all components and managers
```

#### Components Layer
```
Components depend on:
├── Core modules (app.js, apiClient.js, eventBus.js)
├── Utils (validation, error handling, DOM manipulation)
├── Managers (for state management)
└── Other components (minimal coupling)

Components do NOT depend on:
├── Backend services directly
└── Database models directly
```

#### Managers Layer
```
Managers depend on:
├── Core modules (apiClient, eventBus)
├── Utils (error handling, DOM manipulation)
└── Components (for UI updates)

Managers do NOT depend on:
├── Other managers (loose coupling)
├── Backend services directly
└── Database models directly
```

#### Utils Layer
```
Utils depend on:
├── Nothing (pure utility functions)
└── Browser APIs only

Utils are used by:
├── All other frontend modules
└── Provide reusable functionality
```

### CSS Dependencies

```
CSS Import Order (in main.css):
1. Base styles (reset, variables, typography)
2. Layout styles (header, main, footer)
3. Component styles (buttons, forms, modals)
4. Utility styles (spacing, animations, status)
```

## Development Guidelines

### Where to Place New Code

#### Backend Development

**New API Endpoints:**
1. Create controller method in appropriate controller file
2. Add route definition in corresponding route file
3. Add business logic to appropriate service
4. Update models if data structure changes

**New AI Providers:**
1. Create new provider file in `backend/src/services/ai/providers/`
2. Implement the `aiProvider.js` interface
3. Register provider in `aiProviderFactory.js`
4. Add configuration options to `aiSettingsManager.js`

**New Business Logic:**
1. Add to existing service if related functionality exists
2. Create new service file if it's a new domain
3. Place in `backend/src/services/` directory
4. Follow naming convention: `[domain]Service.js`

**New Data Models:**
1. Create in `backend/src/models/` directory
2. Follow existing model patterns
3. Include validation and transformation methods
4. Add database migration if schema changes

#### Frontend Development

**New UI Components:**
1. Create in `frontend/src/components/` directory
2. Follow naming convention: `[componentName].js`
3. Create corresponding CSS file in `frontend/styles/components/`
4. Register component in main app initialization

**New Utility Functions:**
1. Add to existing utility file if related
2. Create new utility file if it's a new category
3. Place in `frontend/src/utils/` directory
4. Export functions for use by other modules

**New State Management:**
1. Create manager class in `frontend/src/managers/`
2. Follow existing manager patterns
3. Use EventBus for communication
4. Keep managers focused on single responsibility

**New Styles:**
1. Component styles: `frontend/styles/components/`
2. Layout styles: `frontend/styles/layout/`
3. Utility styles: `frontend/styles/utilities/`
4. Update `main.css` imports if adding new files

#### Testing

**New Tests:**
1. Unit tests: `tests/unit/`
2. Integration tests: `tests/integration/`
3. End-to-end tests: `tests/e2e/`
4. Follow existing test patterns and naming

### Coding Standards

#### File Naming
- **JavaScript**: camelCase (e.g., `downloadStateManager.js`)
- **CSS**: camelCase (e.g., `knowledgeBaseTable.css`)
- **Test files**: `*.test.js` or `*.spec.js`
- **Directories**: camelCase for source, kebab-case for public assets

#### Code Organization
- **Maximum 300 lines per file** for maintainability
- **Single responsibility principle** for each module
- **Clear import/export statements**
- **Consistent code formatting** with Prettier

#### Documentation
- **JSDoc comments** for all public methods
- **README files** for complex modules
- **Inline comments** for complex logic
- **API documentation** for all endpoints

### Module Communication Patterns

#### Backend Communication
```javascript
// Controllers → Services → Models
// Example: Controller calls service, service uses model

// In controller
const result = await distillationService.processContent(data);

// In service
const distillation = new Distillation(data);
await distillation.save();
```

#### Frontend Communication
```javascript
// Components → Managers → API Client
// Example: Component uses manager, manager calls API

// In component
this.app.downloadStateManager.setDownloadState(id, 'downloading');

// In manager
await this.app.apiClient.post('/api/download', data);
```

#### Event-Driven Communication
```javascript
// Use EventBus for loose coupling
// Publisher
this.eventBus.emit('download:started', { id, filename });

// Subscriber
this.eventBus.on('download:started', (data) => {
    this.updateUI(data);
});
```

## Developer Onboarding

### Quick Start Guide

#### 1. Environment Setup
```bash
# Clone repository
git clone [repository-url]
cd sawron

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
```

#### 2. Understanding the Architecture

**Start with these files to understand the system:**
1. `backend/server.js` - Server entry point
2. `frontend/src/core/app.js` - Frontend entry point
3. `backend/src/controllers/` - API endpoints
4. `frontend/src/components/` - UI components

#### 3. Development Workflow

**For Backend Changes:**
1. Identify the appropriate controller
2. Add/modify business logic in services
3. Update models if needed
4. Add tests for new functionality
5. Test API endpoints manually

**For Frontend Changes:**
1. Identify the appropriate component
2. Add/modify UI logic
3. Update styles if needed
4. Test in browser
5. Add unit tests if applicable

#### 4. Common Development Tasks

**Adding a New API Endpoint:**
```javascript
// 1. Add controller method
// backend/src/controllers/exampleController.js
async function newEndpoint(req, res) {
    try {
        const result = await exampleService.doSomething(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// 2. Add route
// backend/src/routes/exampleRoutes.js
router.post('/new-endpoint', exampleController.newEndpoint);

// 3. Add service logic
// backend/src/services/exampleService.js
async function doSomething(data) {
    // Business logic here
    return result;
}
```

**Adding a New UI Component:**
```javascript
// 1. Create component file
// frontend/src/components/newComponent.js
class NewComponent {
    constructor(app) {
        this.app = app;
        this.init();
    }
    
    init() {
        // Component initialization
    }
}

// 2. Create styles
// frontend/styles/components/newComponent.css
.new-component {
    /* Component styles */
}

// 3. Register in app
// frontend/src/core/app.js
this.newComponent = new NewComponent(this);
```

### Key Concepts to Understand

#### 1. Separation of Concerns
- **Backend**: Data processing, business logic, API endpoints
- **Frontend**: User interface, user interactions, data presentation
- **Services**: Reusable business logic, external integrations
- **Utils**: Pure functions, helper methods

#### 2. Event-Driven Architecture
- **EventBus**: Central communication hub
- **Loose Coupling**: Components don't directly depend on each other
- **Reactive Updates**: UI updates in response to events

#### 3. Factory Pattern (AI Providers)
- **aiProviderFactory**: Creates appropriate AI provider instances
- **Interface Compliance**: All providers implement same interface
- **Easy Extension**: Add new providers without changing existing code

#### 4. Manager Pattern (Frontend)
- **State Management**: Managers handle specific state domains
- **Business Logic**: Complex UI logic separated from components
- **Reusability**: Managers can be used by multiple components

### Debugging and Troubleshooting

#### Common Issues and Solutions

**Backend Issues:**
1. **Import Errors**: Check file paths and module exports
2. **API Errors**: Check controller error handling and service logic
3. **Database Issues**: Check model definitions and database connections

**Frontend Issues:**
1. **Component Not Loading**: Check script tags in HTML and initialization
2. **API Calls Failing**: Check network tab and API client configuration
3. **Style Issues**: Check CSS import order and specificity

**Development Tools:**
1. **Browser DevTools**: Network, Console, Elements tabs
2. **Node.js Debugger**: Use `node --inspect` for backend debugging
3. **Test Runner**: `npm test` for automated testing
4. **Coverage Reports**: `npm run test:coverage` for test coverage

### Best Practices

#### Code Quality
1. **Write Tests**: Unit tests for utilities, integration tests for workflows
2. **Handle Errors**: Proper error handling at all levels
3. **Validate Input**: Validate all user input and API parameters
4. **Document Code**: Clear comments and documentation

#### Performance
1. **Lazy Loading**: Load components only when needed
2. **Efficient Queries**: Optimize database queries and API calls
3. **Caching**: Cache frequently accessed data
4. **Bundle Optimization**: Minimize JavaScript and CSS bundles

#### Security
1. **Input Sanitization**: Sanitize all user input
2. **API Security**: Implement proper authentication and authorization
3. **File Upload Security**: Validate file types and sizes
4. **Error Messages**: Don't expose sensitive information in errors

## Design Rationale

### Architectural Decisions

#### 1. Frontend/Backend Separation
**Decision**: Separate frontend and backend into distinct directories
**Rationale**:
- Clear separation of concerns
- Easier deployment and scaling
- Better development workflow
- Potential for separate teams

#### 2. Modular Frontend Architecture
**Decision**: Break large frontend file into focused modules
**Rationale**:
- **Maintainability**: 300-line files are easier to understand and modify
- **Testability**: Small modules can be tested in isolation
- **Reusability**: Components and utilities can be reused
- **Collaboration**: Multiple developers can work on different modules

#### 3. Service Layer Pattern (Backend)
**Decision**: Separate business logic into service layer
**Rationale**:
- **Single Responsibility**: Controllers handle HTTP, services handle business logic
- **Reusability**: Services can be used by multiple controllers
- **Testability**: Business logic can be tested without HTTP layer
- **Maintainability**: Changes to business logic don't affect HTTP handling

#### 4. Factory Pattern for AI Providers
**Decision**: Use factory pattern for AI provider instantiation
**Rationale**:
- **Extensibility**: Easy to add new AI providers
- **Consistency**: All providers implement same interface
- **Configuration**: Centralized provider configuration
- **Maintainability**: Changes to provider logic isolated to specific files

#### 5. Event-Driven Frontend Communication
**Decision**: Use EventBus for component communication
**Rationale**:
- **Loose Coupling**: Components don't directly depend on each other
- **Flexibility**: Easy to add new event listeners
- **Debugging**: Centralized event logging and monitoring
- **Scalability**: System can grow without tight coupling

#### 6. CSS Modularization
**Decision**: Split large CSS file into focused modules
**Rationale**:
- **Maintainability**: Easier to find and modify specific styles
- **Performance**: Can load only needed styles
- **Organization**: Styles grouped by purpose and component
- **Collaboration**: Multiple developers can work on different style areas

#### 7. Utility-First Approach
**Decision**: Create utility modules for common functionality
**Rationale**:
- **DRY Principle**: Don't repeat common functionality
- **Consistency**: Standardized error handling and validation
- **Testability**: Utilities can be thoroughly unit tested
- **Maintainability**: Changes to common functionality in one place

### Trade-offs and Considerations

#### Complexity vs. Maintainability
**Trade-off**: More files and structure vs. easier maintenance
**Decision**: Chose maintainability over simplicity
**Reasoning**: Long-term benefits outweigh short-term complexity

#### Performance vs. Modularity
**Trade-off**: More HTTP requests for modules vs. single large file
**Decision**: Chose modularity with build optimization
**Reasoning**: Development benefits with production optimization

#### Flexibility vs. Conventions
**Trade-off**: Flexible architecture vs. strict conventions
**Decision**: Balanced approach with clear guidelines
**Reasoning**: Flexibility for growth with consistency for maintainability

### Future Considerations

#### Scalability
- **Microservices**: Backend can be split into microservices if needed
- **CDN**: Frontend assets can be served from CDN
- **Database Sharding**: Database can be partitioned for scale
- **Load Balancing**: Multiple server instances can be deployed

#### Technology Evolution
- **Framework Migration**: Modular structure supports framework changes
- **Build Tools**: Can integrate modern build tools and bundlers
- **TypeScript**: Can gradually migrate to TypeScript
- **Testing**: Can expand testing coverage and automation

#### Team Growth
- **Code Ownership**: Clear module boundaries support team ownership
- **Onboarding**: Structured approach makes onboarding easier
- **Collaboration**: Multiple developers can work simultaneously
- **Code Review**: Smaller modules make code review more effective

This architecture documentation provides a comprehensive guide for understanding, developing, and maintaining the SAWRON application. The modular structure supports both current needs and future growth while maintaining code quality and developer productivity.