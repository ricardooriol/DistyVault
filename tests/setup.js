/**
 * Test setup and configuration
 * Sets up the test environment and common utilities
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

global.mockConsole = () => {
    console.log = jest.fn();
    console.error = jest.fn();
};

global.restoreConsole = () => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
};

// Global test timeout
jest.setTimeout(30000);

// Clean up after each test
afterEach(() => {
    jest.clearAllMocks();
});