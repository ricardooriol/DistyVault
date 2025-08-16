# DistyVault Test Suite Documentation

This comprehensive test suite validates all functionality of the DistyVault knowledge distillation platform to ensure no regressions occur during refactoring.

## Test Structure

```
tests/
├── setup.js                           # Test configuration and setup
├── run-validation-tests.js            # Automated test runner
├── README.md                          # This documentation
├── e2e/
│   └── app.test.js                    # End-to-end application tests
├── integration/
│   ├── database.test.js               # Database operations tests
│   ├── ai-provider.test.js            # AI provider integration tests
│   └── processor.test.js              # Content processing workflow tests
└── unit/
    └── frontend-components.test.js    # Frontend UI component tests
```

## Test Categories

### 1. End-to-End Tests (`tests/e2e/app.test.js`)
Tests complete user workflows from frontend to backend:
- **URL Processing Workflow**: Complete flow from URL input to distillation completion
- **File Upload and Processing**: File upload, validation, and processing workflow
- **Database Operations**: CRUD operations and data persistence
- **API Integration**: All REST endpoints and error handling
- **Process Management**: Starting, stopping, and retrying processes
- **PDF Generation**: Document export functionality
- **Bulk Operations**: Multi-item operations and batch processing

### 2. Database Integration Tests (`tests/integration/database.test.js`)
Tests database operations and data persistence:
- **CRUD Operations**: Create, read, update, delete distillations
- **Query Operations**: Search, filtering, and data retrieval
- **Data Validation**: Input validation and data integrity
- **Concurrent Operations**: Multi-user and concurrent access
- **Error Handling**: Database connection failures and recovery

### 3. AI Provider Integration Tests (`tests/integration/ai-provider.test.js`)
Tests AI provider integration and settings management:
- **Settings Management**: Configuration persistence and validation
- **Provider Factory**: Creation and validation of different AI providers
- **Connection Testing**: Provider availability and authentication
- **Configuration Validation**: Settings structure and security
- **Concurrent Processing**: Multi-threaded AI processing limits

### 4. Processor Integration Tests (`tests/integration/processor.test.js`)
Tests content processing workflows:
- **URL Processing**: Web content extraction and distillation
- **File Processing**: Document parsing and content extraction
- **Process Management**: Starting, stopping, and monitoring processes
- **Retry Functionality**: Failed process recovery
- **PDF Generation**: Document export and formatting
- **Error Recovery**: Handling temporary failures and resource cleanup

### 5. Frontend Component Tests (`tests/unit/frontend-components.test.js`)
Tests frontend UI components and user interactions:
- **Download State Manager**: Download progress and state management
- **Input Components**: URL input, file upload, and validation
- **Status Components**: Progress display and user feedback
- **Knowledge Base Table**: Data display, search, and filtering
- **Modal Components**: Settings dialogs and user interactions
- **API Integration**: Frontend-to-backend communication
- **Event Handling**: User interactions and DOM events
- **Accessibility**: Keyboard navigation and screen reader support

## Running Tests

### Run All Validation Tests
```bash
npm run test:validation
```
This runs the comprehensive validation suite that should be executed after each refactoring step.

### Run Specific Test Categories
```bash
# End-to-end tests
npm run test:e2e

# Integration tests
npm run test:integration

# Unit tests
npm run test:unit

# All tests with coverage
npm run test:coverage
```

### Run Individual Test Files
```bash
# Database tests only
npx jest tests/integration/database.test.js

# Frontend components only
npx jest tests/unit/frontend-components.test.js

# Specific test pattern
npx jest --testNamePattern="URL Processing"
```

## Test Requirements Coverage

The test suite validates all requirements from the specification:

### Requirement 5.1: Comprehensive Test Coverage
- ✅ End-to-end test exercises all major application functionality
- ✅ Tests cover URL processing, file upload, AI integration, and database operations
- ✅ Frontend UI components and user interactions are validated
- ✅ Backend API endpoints and error handling are tested

### Requirement 5.2: URL Processing Validation
- ✅ Complete URL processing workflow from input to completion
- ✅ Different URL types (web pages, YouTube videos, channels)
- ✅ Error handling for invalid URLs and extraction failures
- ✅ AI provider integration and content distillation

### Requirement 5.3: File Processing Validation
- ✅ File upload and validation functionality
- ✅ Support for PDF, DOCX, and TXT file types
- ✅ Content extraction and processing workflows
- ✅ Error handling for unsupported file types and large files

### Requirement 5.4: AI Provider Integration
- ✅ AI provider configuration and settings management
- ✅ Connection testing and authentication validation
- ✅ Multiple provider support (Ollama, OpenAI, Anthropic, Google)
- ✅ Error handling for AI service failures and timeouts

### Requirement 5.5: Database Operations
- ✅ CRUD operations for distillations
- ✅ Search and filtering functionality
- ✅ Data persistence and integrity validation
- ✅ Concurrent access and error recovery

### Requirement 5.6: Automated Test Execution
- ✅ Automated test runner for post-refactoring validation
- ✅ Clear pass/fail reporting with detailed feedback
- ✅ Integration with npm scripts for easy execution
- ✅ Performance validation and regression detection

## Test Environment Setup

### Prerequisites
- Node.js and npm installed
- SQLite database accessible
- Test dependencies installed (`npm install`)

### Environment Configuration
Tests use the following configuration:
- Test database: `tests/temp/test-distyvault.db`
- Test timeout: 30 seconds
- Coverage threshold: 70% for all metrics
- Mock external services (AI providers, file system)

### Mock Strategy
- **External Services**: AI providers are mocked to avoid API costs and ensure reliability
- **File System**: File operations use temporary test directories
- **Database**: Tests use isolated test database instances
- **Network**: HTTP requests are mocked using supertest and fetch mocks

## Continuous Integration

The test suite is designed for CI/CD integration:

```bash
# Pre-refactoring validation
npm run test:validation

# Post-refactoring validation
npm run test:validation

# Coverage reporting
npm run test:coverage
```

### Success Criteria
- All tests must pass (100% pass rate)
- No functionality regressions detected
- Performance within acceptable limits
- Coverage thresholds maintained

### Failure Handling
If tests fail after refactoring:
1. Review the specific failing test categories
2. Check for breaking changes in the refactored code
3. Verify all dependencies and imports are updated
4. Ensure database schema and API contracts are maintained
5. Run individual test categories to isolate issues

## Extending the Test Suite

When adding new functionality:

1. **Add Unit Tests**: Test individual functions and components
2. **Add Integration Tests**: Test component interactions
3. **Update E2E Tests**: Test complete user workflows
4. **Update Validation Runner**: Include new test categories
5. **Document Changes**: Update this README with new test descriptions

### Test Writing Guidelines
- Use descriptive test names that explain the scenario
- Include both positive and negative test cases
- Mock external dependencies appropriately
- Verify both functionality and error handling
- Include performance and edge case testing
- Maintain test isolation and cleanup

## Troubleshooting

### Common Issues

**Tests fail with "Server not running"**
- Start the server: `npm start`
- Verify server is accessible at `http://localhost:3000`

**Database connection errors**
- Ensure SQLite is installed and accessible
- Check database file permissions
- Verify test database directory exists

**Mock-related failures**
- Clear Jest cache: `npx jest --clearCache`
- Verify mock implementations match actual interfaces
- Check for mock leakage between tests

**Timeout errors**
- Increase test timeout in Jest configuration
- Check for infinite loops or blocking operations
- Verify async operations are properly awaited

### Debug Mode
Run tests with additional debugging:
```bash
# Verbose output
npx jest --verbose

# Debug specific test
npx jest --testNamePattern="specific test" --verbose

# Run with debugger
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Performance Benchmarks

The test suite includes performance validation:
- **API Response Times**: < 1000ms for most endpoints
- **Database Queries**: < 100ms for simple operations
- **File Processing**: < 5000ms for typical documents
- **Memory Usage**: Stable memory consumption during processing

These benchmarks help detect performance regressions during refactoring.