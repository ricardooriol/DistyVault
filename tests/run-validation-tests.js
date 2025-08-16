#!/usr/bin/env node

/**
 * Validation Test Runner
 * Runs comprehensive tests after each refactoring step to ensure no functionality is lost
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🧪 SAWRON Validation Test Suite');
console.log('================================');
console.log('Running comprehensive tests to validate all functionality...\n');

// Test categories to run
const testCategories = [
    {
        name: 'Comprehensive Validation Tests',
        pattern: 'tests/comprehensive-validation.test.js',
        description: 'Complete validation of all functionality to ensure no regressions'
    },
    {
        name: 'End-to-End Tests',
        pattern: 'tests/e2e/**/*.test.js',
        description: 'Testing complete user workflows and API integration'
    },
    {
        name: 'Database Integration Tests',
        pattern: 'tests/integration/database.test.js',
        description: 'Testing database operations and data persistence'
    },
    {
        name: 'AI Provider Integration Tests',
        pattern: 'tests/integration/ai-provider.test.js',
        description: 'Testing AI provider integration and settings management'
    },
    {
        name: 'Processor Integration Tests',
        pattern: 'tests/integration/processor.test.js',
        description: 'Testing content processing workflows'
    },
    {
        name: 'Frontend Component Tests',
        pattern: 'tests/unit/frontend-components.test.js',
        description: 'Testing frontend UI components and user interactions'
    },
    {
        name: 'Automated Execution Tests',
        pattern: 'tests/automated-execution.test.js',
        description: 'Testing automated test execution system and CI/CD integration'
    }
];

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failedCategories = [];

// Function to run a specific test category
function runTestCategory(category) {
    console.log(`\n📋 ${category.name}`);
    console.log(`   ${category.description}`);
    console.log('   ' + '─'.repeat(60));
    
    try {
        const result = execSync(`npx jest "${category.pattern}" --verbose --no-coverage`, {
            encoding: 'utf8',
            stdio: 'pipe'
        });
        
        // Parse test results
        const lines = result.split('\n');
        const testSummaryLine = lines.find(line => line.includes('Tests:'));
        
        if (testSummaryLine) {
            const passedMatch = testSummaryLine.match(/(\d+) passed/);
            const failedMatch = testSummaryLine.match(/(\d+) failed/);
            
            const categoryPassed = passedMatch ? parseInt(passedMatch[1]) : 0;
            const categoryFailed = failedMatch ? parseInt(failedMatch[1]) : 0;
            
            totalTests += categoryPassed + categoryFailed;
            passedTests += categoryPassed;
            failedTests += categoryFailed;
            
            if (categoryFailed > 0) {
                failedCategories.push(category.name);
                console.log(`   ❌ ${categoryFailed} tests failed, ${categoryPassed} passed`);
            } else {
                console.log(`   ✅ All ${categoryPassed} tests passed`);
            }
        } else {
            console.log('   ✅ Tests completed successfully');
        }
        
    } catch (error) {
        console.log(`   ❌ Test category failed: ${error.message}`);
        failedCategories.push(category.name);
        failedTests++;
        totalTests++;
    }
}

// Function to check if server is running
function checkServerStatus() {
    console.log('🔍 Checking server status...');
    
    try {
        const { spawn } = require('child_process');
        const curl = spawn('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', 'http://localhost:3000/api/health']);
        
        curl.on('close', (code) => {
            if (code === 0) {
                console.log('   ✅ Server is running and responding');
            } else {
                console.log('   ⚠️  Server may not be running. Some tests may fail.');
                console.log('   💡 Start the server with: npm start');
            }
        });
        
        curl.on('error', () => {
            console.log('   ⚠️  Could not check server status. Some tests may fail.');
        });
        
    } catch (error) {
        console.log('   ⚠️  Could not check server status. Some tests may fail.');
    }
}

// Function to generate test report
function generateTestReport() {
    console.log('\n📊 Test Results Summary');
    console.log('========================');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ${failedTests > 0 ? '❌' : '✅'}`);
    console.log(`Success Rate: ${totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0}%`);
    
    if (failedCategories.length > 0) {
        console.log('\n❌ Failed Categories:');
        failedCategories.forEach(category => {
            console.log(`   • ${category}`);
        });
        
        console.log('\n🔧 Troubleshooting Tips:');
        console.log('   • Ensure the server is running (npm start)');
        console.log('   • Check that all dependencies are installed (npm install)');
        console.log('   • Verify database is accessible');
        console.log('   • Check for any recent code changes that might affect functionality');
        
        return false;
    } else {
        console.log('\n🎉 All tests passed! The refactoring step was successful.');
        console.log('   No functionality has been lost during the refactoring process.');
        return true;
    }
}

// Function to create test temp directory
function setupTestEnvironment() {
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
}

// Main execution
async function main() {
    try {
        // Setup test environment
        setupTestEnvironment();
        
        // Check server status
        checkServerStatus();
        
        // Wait a moment for server check
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Run each test category
        for (const category of testCategories) {
            runTestCategory(category);
        }
        
        // Generate final report
        const allTestsPassed = generateTestReport();
        
        // Exit with appropriate code
        process.exit(allTestsPassed ? 0 : 1);
        
    } catch (error) {
        console.error('\n💥 Test runner encountered an error:', error.message);
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n\n⏹️  Test run interrupted by user');
    process.exit(1);
});

process.on('SIGTERM', () => {
    console.log('\n\n⏹️  Test run terminated');
    process.exit(1);
});

// Run the test suite
main();