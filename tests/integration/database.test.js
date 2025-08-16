/**
 * Database Integration Tests
 * Tests database operations and data persistence
 */

const database = require('../../backend/src/services/database');
const Distillation = require('../../backend/models/distillation');
const path = require('path');
const fs = require('fs');

describe('Database Integration Tests', () => {
    let testDbPath;

    beforeAll(() => {
        // Create test directory
        testDbPath = path.join(__dirname, '../temp/test-distyvault.db');
        const testDir = path.dirname(testDbPath);
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
    });

    afterAll(async () => {
        // Clean up test database
        if (database && database.db) {
            database.db.close();
        }
        
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    beforeEach(async () => {
        // Clear all data before each test
        await new Promise((resolve, reject) => {
            database.db.run('DELETE FROM summaries', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });

    describe('Database Initialization', () => {
        test('should initialize database with correct schema', async () => {
            // Check if the summaries table exists and has correct structure
            const tableInfo = await new Promise((resolve, reject) => {
                database.db.all("PRAGMA table_info(summaries)", (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            const expectedColumns = [
                'id', 'title', 'content', 'sourceUrl', 'sourceType', 'sourceFile',
                'status', 'processingStep', 'rawContent', 'createdAt', 'completedAt',
                'processingTime', 'elapsedTime', 'startTime', 'distillingStartTime',
                'wordCount', 'error', 'logs'
            ];

            const actualColumns = tableInfo.map(col => col.name);
            expectedColumns.forEach(col => {
                expect(actualColumns).toContain(col);
            });
        });
    });

    describe('CRUD Operations', () => {
        test('should create and retrieve distillation', async () => {
            const testDistillation = new Distillation({
                title: 'Test Article',
                sourceUrl: 'https://example.com/test',
                sourceType: 'url',
                status: 'extracting'
            });

            // Save distillation
            await database.saveDistillation(testDistillation);
            expect(testDistillation.id).toBeDefined();

            // Retrieve distillation
            const retrieved = await database.getDistillation(testDistillation.id);
            expect(retrieved).toBeDefined();
            expect(retrieved.title).toBe('Test Article');
            expect(retrieved.sourceUrl).toBe('https://example.com/test');
            expect(retrieved.sourceType).toBe('url');
            expect(retrieved.status).toBe('extracting');
        });

        test('should update existing distillation', async () => {
            const testDistillation = new Distillation({
                title: 'Test Article',
                sourceUrl: 'https://example.com/test',
                sourceType: 'url',
                status: 'extracting'
            });

            await database.saveDistillation(testDistillation);
            
            // Update the distillation
            testDistillation.status = 'completed';
            testDistillation.content = 'This is the distilled content';
            testDistillation.completedAt = new Date();

            await database.saveDistillation(testDistillation);

            // Retrieve and verify update
            const updated = await database.getDistillation(testDistillation.id);
            expect(updated.status).toBe('completed');
            expect(updated.content).toBe('This is the distilled content');
            expect(updated.completedAt).toBeDefined();
        });

        test('should delete distillation', async () => {
            const testDistillation = new Distillation({
                title: 'Test Article',
                sourceUrl: 'https://example.com/test',
                sourceType: 'url',
                status: 'completed'
            });

            await database.saveDistillation(testDistillation);
            
            // Verify it exists
            let retrieved = await database.getDistillation(testDistillation.id);
            expect(retrieved).toBeDefined();

            // Delete it
            const deleteResult = await database.deleteDistillation(testDistillation.id);
            expect(deleteResult).toBe(true);

            // Verify it's gone
            retrieved = await database.getDistillation(testDistillation.id);
            expect(retrieved).toBeNull();
        });

        test('should return false when deleting non-existent distillation', async () => {
            const result = await database.deleteDistillation('non-existent-id');
            expect(result).toBe(false);
        });
    });

    describe('Query Operations', () => {
        beforeEach(async () => {
            // Create test data
            const testDistillations = [
                new Distillation({
                    title: 'JavaScript Fundamentals',
                    content: 'Learn about variables, functions, and objects in JavaScript',
                    sourceUrl: 'https://example.com/js',
                    sourceType: 'url',
                    status: 'completed'
                }),
                new Distillation({
                    title: 'Python Data Science',
                    content: 'Explore pandas, numpy, and machine learning with Python',
                    sourceUrl: 'https://example.com/python',
                    sourceType: 'url',
                    status: 'completed'
                }),
                new Distillation({
                    title: 'React Components',
                    content: 'Building reusable components in React applications',
                    sourceType: 'file',
                    status: 'extracting'
                })
            ];

            for (const distillation of testDistillations) {
                await database.saveDistillation(distillation);
            }
        });

        test('should retrieve all distillations', async () => {
            const allDistillations = await database.getAllSummaries();
            expect(allDistillations).toHaveLength(3);
            expect(allDistillations.map(d => d.title)).toContain('JavaScript Fundamentals');
            expect(allDistillations.map(d => d.title)).toContain('Python Data Science');
            expect(allDistillations.map(d => d.title)).toContain('React Components');
        });

        test('should search distillations by content', async () => {
            const searchResults = await database.searchSummaries('JavaScript');
            expect(searchResults).toHaveLength(1);
            expect(searchResults[0].title).toBe('JavaScript Fundamentals');
        });

        test('should search distillations by title', async () => {
            const searchResults = await database.searchSummaries('Python');
            expect(searchResults).toHaveLength(1);
            expect(searchResults[0].title).toBe('Python Data Science');
        });

        test('should return empty results for non-matching search', async () => {
            const searchResults = await database.searchSummaries('nonexistent');
            expect(searchResults).toHaveLength(0);
        });

        test('should filter by source type', async () => {
            const allDistillations = await database.getAllSummaries();
            const urlDistillations = allDistillations.filter(d => d.sourceType === 'url');
            expect(urlDistillations).toHaveLength(2);
            
            const fileDistillations = allDistillations.filter(d => d.sourceType === 'file');
            expect(fileDistillations).toHaveLength(1);
            expect(fileDistillations[0].title).toBe('React Components');
        });

        test('should filter by status', async () => {
            const allDistillations = await database.getAllSummaries();
            const completedDistillations = allDistillations.filter(d => d.status === 'completed');
            expect(completedDistillations).toHaveLength(2);
            
            const extractingDistillations = allDistillations.filter(d => d.status === 'extracting');
            expect(extractingDistillations).toHaveLength(1);
            expect(extractingDistillations[0].title).toBe('React Components');
        });
    });

    describe('Data Validation and Integrity', () => {
        test('should handle malformed data gracefully', async () => {
            // Try to save invalid data
            const invalidDistillation = {
                // Missing required fields
                title: null,
                sourceUrl: 'not-a-valid-url'
            };

            await expect(database.saveDistillation(invalidDistillation)).rejects.toThrow();
        });

        test('should preserve data types correctly', async () => {
            const testDistillation = new Distillation({
                title: 'Test Article',
                sourceUrl: 'https://example.com/test',
                sourceType: 'url',
                status: 'completed',
                wordCount: 1500,
                processingTime: 45.5,
                createdAt: new Date(),
                completedAt: new Date()
            });

            await database.saveDistillation(testDistillation);
            const retrieved = await database.getDistillation(testDistillation.id);

            expect(typeof retrieved.wordCount).toBe('number');
            expect(typeof retrieved.processingTime).toBe('number');
            expect(retrieved.wordCount).toBe(1500);
            expect(retrieved.processingTime).toBe(45.5);
        });

        test('should handle large content correctly', async () => {
            const largeContent = 'A'.repeat(100000); // 100KB of content
            
            const testDistillation = new Distillation({
                title: 'Large Content Test',
                content: largeContent,
                sourceUrl: 'https://example.com/large',
                sourceType: 'url',
                status: 'completed'
            });

            await database.saveDistillation(testDistillation);
            const retrieved = await database.getDistillation(testDistillation.id);

            expect(retrieved.content).toBe(largeContent);
            expect(retrieved.content.length).toBe(100000);
        });
    });

    describe('Concurrent Operations', () => {
        test('should handle concurrent reads correctly', async () => {
            const testDistillation = new Distillation({
                title: 'Concurrent Test',
                sourceUrl: 'https://example.com/concurrent',
                sourceType: 'url',
                status: 'completed'
            });

            await database.saveDistillation(testDistillation);

            // Perform multiple concurrent reads
            const readPromises = Array(10).fill().map(() => 
                database.getDistillation(testDistillation.id)
            );

            const results = await Promise.all(readPromises);
            
            // All reads should return the same data
            results.forEach(result => {
                expect(result.title).toBe('Concurrent Test');
                expect(result.id).toBe(testDistillation.id);
            });
        });

        test('should handle concurrent writes correctly', async () => {
            // Create multiple distillations concurrently
            const createPromises = Array(5).fill().map((_, index) => {
                const distillation = new Distillation({
                    title: `Concurrent Write Test ${index}`,
                    sourceUrl: `https://example.com/concurrent-${index}`,
                    sourceType: 'url',
                    status: 'completed'
                });
                return database.saveDistillation(distillation);
            });

            await Promise.all(createPromises);
            expect(createPromises).toHaveLength(5);

            // Verify all were saved correctly
            const allDistillations = await database.getAllSummaries();
            expect(allDistillations.length).toBeGreaterThanOrEqual(5);
        });
    });

    describe('Error Handling', () => {
        test('should handle database connection errors', async () => {
            // Close the database connection
            database.db.close();

            // Try to perform an operation
            await expect(database.getAllSummaries()).rejects.toThrow();

            // Database connection will be reestablished automatically
        });

        test('should handle SQL injection attempts', async () => {
            const maliciousInput = "'; DROP TABLE summaries; --";
            
            // This should not cause any issues
            const searchResults = await database.searchSummaries(maliciousInput);
            expect(Array.isArray(searchResults)).toBe(true);

            // Verify table still exists
            const allDistillations = await database.getAllSummaries();
            expect(Array.isArray(allDistillations)).toBe(true);
        });
    });
});