/**
 * Jest Configuration for SAWRON Test Suite
 */

module.exports = {
    // Test environment
    testEnvironment: 'node',
    
    // Setup files
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    
    // Test file patterns
    testMatch: [
        '<rootDir>/tests/**/*.test.js',
        '<rootDir>/tests/**/*.spec.js'
    ],
    
    // Coverage configuration
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    collectCoverageFrom: [
        'services/**/*.js',
        'models/**/*.js',
        'routes/**/*.js',
        'public/app.js',
        '!**/node_modules/**',
        '!**/coverage/**',
        '!**/tests/**'
    ],
    
    // Coverage thresholds
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70
        }
    },
    
    // Module paths
    moduleDirectories: ['node_modules', '<rootDir>'],
    
    // Test timeout
    testTimeout: 30000,
    
    // Clear mocks between tests
    clearMocks: true,
    
    // Verbose output
    verbose: true,
    
    // Transform configuration for different file types
    transform: {
        '^.+\\.js$': 'babel-jest'
    },
    
    // Module file extensions
    moduleFileExtensions: ['js', 'json'],
    
    // Test environment options for JSDOM tests
    testEnvironmentOptions: {
        url: 'http://localhost:3000'
    }
};