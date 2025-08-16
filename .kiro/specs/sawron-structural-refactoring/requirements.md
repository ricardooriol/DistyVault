# Requirements Document

## Introduction

This specification outlines the requirements for performing a comprehensive "gold standard" structural refactoring of the SAWRON knowledge distillation platform. SAWRON is a Node.js/Express application with a browser-based frontend that processes various content sources (URLs, YouTube videos, documents) using AI providers to generate structured insights. The current codebase suffers from maintainability issues due to excessively large files, particularly the frontend JavaScript (3602+ lines) and CSS (3304+ lines), along with potential code duplication and dead code throughout the system.

The primary objective is to transform the current unmaintainable structure into a highly professional, modular, and maintainable architecture while preserving 100% of existing functionality and visual appearance. This refactoring must adhere to industry-standard directory structures and naming conventions, eliminate code duplication, remove dead code, and organize related functionality into logical, reusable modules.

## Requirements

### Requirement 1

**User Story:** As a developer maintaining the SAWRON codebase, I want the frontend JavaScript code to be modularized into logical components, so that I can easily locate, understand, and modify specific functionality without navigating through thousands of lines of code.

#### Acceptance Criteria

1. WHEN the refactoring is complete THEN the current 3602-line `public/app.js` file SHALL be split into multiple focused modules with clear responsibilities
2. WHEN organizing frontend code THEN each module SHALL contain no more than 300 lines of code to ensure maintainability
3. WHEN creating frontend modules THEN they SHALL be organized into a logical directory structure under `public/src/` with subdirectories like `components/`, `utils/`, `core/`, and `managers/`
4. WHEN splitting the frontend code THEN all existing functionality SHALL remain identical including UI behavior, API interactions, and user experience
5. WHEN creating new files THEN they SHALL use descriptive camelCase naming conventions (e.g., `downloadStateManager.js`, `tooltipManager.js`)
6. WHEN organizing modules THEN no directory SHALL contain only a single file unless it represents a standalone utility

### Requirement 2

**User Story:** As a developer working on the SAWRON interface, I want the CSS styles to be organized into modular, maintainable stylesheets, so that I can efficiently manage styling for different components without dealing with a monolithic 3304-line CSS file.

#### Acceptance Criteria

1. WHEN the refactoring is complete THEN the current 3304-line `public/styles.css` file SHALL be split into focused stylesheets organized by component or functionality
2. WHEN organizing CSS code THEN styles SHALL be grouped into logical modules such as `base.css`, `components/`, `layout/`, and `utilities/`
3. WHEN creating CSS modules THEN each stylesheet SHALL focus on a specific aspect of the interface (e.g., modals, tables, forms, buttons)
4. WHEN splitting CSS THEN the visual appearance and responsive behavior SHALL remain exactly identical to the current implementation
5. WHEN organizing stylesheets THEN they SHALL be imported in the correct order to maintain CSS cascade and specificity rules
6. WHEN creating new CSS files THEN they SHALL use descriptive camelCase naming that matches their corresponding JavaScript components

### Requirement 3

**User Story:** As a developer maintaining the SAWRON backend, I want the server-side code to follow a conventional MVC-like structure, so that I can easily understand the application architecture and locate specific functionality.

#### Acceptance Criteria

1. WHEN refactoring the backend THEN the code SHALL be organized into conventional directories such as `src/controllers/`, `src/middleware/`, `src/routes/`, `src/services/`, and `src/models/`
2. WHEN organizing backend code THEN route handlers SHALL be extracted from `server.js` into dedicated controller files
3. WHEN creating controllers THEN each SHALL handle a specific domain of functionality (e.g., `distillationController.js`, `aiSettingsController.js`)
4. WHEN refactoring server.js THEN it SHALL become a clean application entry point focused on server setup and middleware configuration
5. WHEN organizing services THEN the existing service architecture SHALL be preserved but moved to the new directory structure
6. WHEN creating new backend files THEN they SHALL use descriptive camelCase naming conventions

### Requirement 4

**User Story:** As a developer working on the SAWRON codebase, I want all duplicate functions, unused variables, and dead code to be identified and removed, so that the application is optimized for performance and reliability.

#### Acceptance Criteria

1. WHEN analyzing the codebase THEN all duplicate functions across files SHALL be identified and consolidated into reusable utilities
2. WHEN removing duplication THEN common functionality SHALL be extracted into shared utility modules
3. WHEN scanning for dead code THEN all unused variables, functions, and imports SHALL be identified and removed
4. WHEN eliminating dead code THEN the removal SHALL not affect any existing functionality
5. WHEN consolidating duplicate code THEN the refactored version SHALL maintain identical behavior to the original implementations
6. WHEN creating shared utilities THEN they SHALL be placed in appropriate utility directories with clear naming

### Requirement 5

**User Story:** As a developer deploying or testing SAWRON, I want a comprehensive test suite that validates all components work correctly after refactoring, so that I can be confident that no functionality has been broken during the restructuring process.

#### Acceptance Criteria

1. WHEN the refactoring is complete THEN a comprehensive test SHALL be created that exercises all major application functionality
2. WHEN running the test THEN it SHALL verify that URL processing, file upload, AI provider integration, and database operations work correctly
3. WHEN testing the frontend THEN the test SHALL validate that all UI components render correctly and user interactions work as expected
4. WHEN testing the backend THEN the test SHALL verify that all API endpoints return correct responses and handle errors appropriately
5. WHEN executing the test suite THEN it SHALL run automatically after each refactoring step to ensure no functionality is lost
6. WHEN the test completes THEN it SHALL provide clear feedback on any functionality that may have been affected by the refactoring

### Requirement 6

**User Story:** As a developer understanding the SAWRON architecture, I want clear documentation of the new directory structure and file organization, so that I can quickly navigate the codebase and understand where different types of functionality are located.

#### Acceptance Criteria

1. WHEN the refactoring is complete THEN a detailed directory structure document SHALL be provided showing the new organization
2. WHEN documenting the structure THEN it SHALL clearly explain which functionality belongs in each directory and file
3. WHEN describing file organization THEN it SHALL include the rationale for grouping related functionality together
4. WHEN providing documentation THEN it SHALL include guidelines for where to place new code in the future
5. WHEN documenting modules THEN it SHALL explain the dependencies and relationships between different components
6. WHEN creating the documentation THEN it SHALL be formatted as a clear, hierarchical structure that's easy to follow

### Requirement 7

**User Story:** As a developer working with the refactored SAWRON codebase, I want the new structure to follow widely-used industry standards and conventions, so that the codebase is familiar and approachable to other developers.

#### Acceptance Criteria

1. WHEN organizing the project structure THEN it SHALL follow conventional patterns used in professional Node.js/Express applications
2. WHEN naming directories and files THEN they SHALL use standard conventions (camelCase for files, kebab-case for directories where appropriate)
3. WHEN structuring the frontend THEN it SHALL follow patterns commonly used in modern JavaScript applications
4. WHEN organizing stylesheets THEN they SHALL follow CSS architecture best practices such as component-based organization
5. WHEN creating the new structure THEN it SHALL be intuitive to developers familiar with modern web application architectures
6. WHEN implementing the refactoring THEN it SHALL maintain separation of concerns between different layers of the application