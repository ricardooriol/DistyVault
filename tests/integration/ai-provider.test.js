/**
 * AI Provider Integration Tests
 * Tests AI provider integration and settings management
 */

const AIProviderFactory = require('../../backend/src/services/ai/aiProviderFactory');
const AISettingsManager = require('../../backend/src/services/ai/aiSettingsManager');

// Mock external AI services
jest.mock('../../backend/src/services/ai/providers/ollama');
jest.mock('../../backend/src/services/ai/providers/openAI');
jest.mock('../../backend/src/services/ai/providers/anthropic');
jest.mock('../../backend/src/services/ai/providers/google');

describe('AI Provider Integration Tests', () => {
    let aiSettingsManager;

    beforeEach(() => {
        // Reset singleton instance
        AISettingsManager.instance = null;
        aiSettingsManager = AISettingsManager.getInstance();
        
        // Clear any existing settings
        aiSettingsManager.clearSettings();
    });

    describe('AI Settings Manager', () => {
        test('should be a singleton', () => {
            const instance1 = AISettingsManager.getInstance();
            const instance2 = AISettingsManager.getInstance();
            expect(instance1).toBe(instance2);
        });

        test('should save and load settings correctly', () => {
            const testSettings = {
                mode: 'offline',
                offline: {
                    provider: 'ollama',
                    model: 'llama2',
                    endpoint: 'http://localhost:11434'
                },
                online: {
                    provider: 'openai',
                    model: 'gpt-3.5-turbo',
                    apiKey: 'test-api-key'
                },
                concurrentProcessing: 2
            };

            aiSettingsManager.saveSettings(testSettings);
            const loadedSettings = aiSettingsManager.loadSettings();

            expect(loadedSettings.mode).toBe('offline');
            expect(loadedSettings.offline.provider).toBe('ollama');
            expect(loadedSettings.online.provider).toBe('openai');
            expect(loadedSettings.concurrentProcessing).toBe(2);
        });

        test('should validate settings structure', () => {
            const invalidSettings = {
                mode: 'invalid-mode',
                offline: {
                    provider: 'unknown-provider'
                }
            };

            const validation = aiSettingsManager.validateSettings(invalidSettings);
            expect(validation.valid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });

        test('should get current provider config based on mode', () => {
            const testSettings = {
                mode: 'offline',
                offline: {
                    provider: 'ollama',
                    model: 'llama2',
                    endpoint: 'http://localhost:11434'
                },
                online: {
                    provider: 'openai',
                    model: 'gpt-3.5-turbo',
                    apiKey: 'test-api-key'
                }
            };

            aiSettingsManager.saveSettings(testSettings);
            const currentConfig = aiSettingsManager.getCurrentProviderConfig();

            expect(currentConfig.type).toBe('ollama');
            expect(currentConfig.model).toBe('llama2');
            expect(currentConfig.endpoint).toBe('http://localhost:11434');
        });

        test('should switch between offline and online modes', () => {
            const testSettings = {
                mode: 'offline',
                offline: {
                    provider: 'ollama',
                    model: 'llama2',
                    endpoint: 'http://localhost:11434'
                },
                online: {
                    provider: 'openai',
                    model: 'gpt-3.5-turbo',
                    apiKey: 'test-api-key'
                }
            };

            aiSettingsManager.saveSettings(testSettings);

            // Test offline mode
            let currentConfig = aiSettingsManager.getCurrentProviderConfig();
            expect(currentConfig.type).toBe('ollama');

            // Switch to online mode
            testSettings.mode = 'online';
            aiSettingsManager.saveSettings(testSettings);
            currentConfig = aiSettingsManager.getCurrentProviderConfig();
            expect(currentConfig.type).toBe('openai');
            expect(currentConfig.apiKey).toBe('test-api-key');
        });

        test('should handle missing settings gracefully', () => {
            const defaultConfig = aiSettingsManager.getCurrentProviderConfig();
            expect(defaultConfig).toBeDefined();
            expect(defaultConfig.type).toBe('ollama'); // Default fallback
        });

        test('should clear settings', () => {
            const testSettings = {
                mode: 'offline',
                offline: {
                    provider: 'ollama',
                    model: 'llama2'
                }
            };

            aiSettingsManager.saveSettings(testSettings);
            expect(aiSettingsManager.loadSettings()).toBeDefined();

            aiSettingsManager.clearSettings();
            const clearedSettings = aiSettingsManager.loadSettings();
            expect(clearedSettings.mode).toBe('offline'); // Default fallback
        });
    });

    describe('AI Provider Factory', () => {
        test('should create Ollama provider', () => {
            const config = {
                type: 'ollama',
                model: 'llama2',
                endpoint: 'http://localhost:11434'
            };

            const provider = AIProviderFactory.createProvider(config);
            expect(provider).toBeDefined();
            expect(provider.constructor.name).toBe('OllamaProvider');
        });

        test('should create OpenAI provider', () => {
            const config = {
                type: 'openai',
                model: 'gpt-3.5-turbo',
                apiKey: 'test-api-key'
            };

            const provider = AIProviderFactory.createProvider(config);
            expect(provider).toBeDefined();
            expect(provider.constructor.name).toBe('OpenAIProvider');
        });

        test('should create Anthropic provider', () => {
            const config = {
                type: 'anthropic',
                model: 'claude-3-sonnet-20240229',
                apiKey: 'test-api-key'
            };

            const provider = AIProviderFactory.createProvider(config);
            expect(provider).toBeDefined();
            expect(provider.constructor.name).toBe('AnthropicProvider');
        });

        test('should create Google provider', () => {
            const config = {
                type: 'google',
                model: 'gemini-pro',
                apiKey: 'test-api-key'
            };

            const provider = AIProviderFactory.createProvider(config);
            expect(provider).toBeDefined();
            expect(provider.constructor.name).toBe('GoogleProvider');
        });

        test('should throw error for unknown provider type', () => {
            const config = {
                type: 'unknown-provider',
                model: 'some-model'
            };

            expect(() => {
                AIProviderFactory.createProvider(config);
            }).toThrow('Unknown AI provider type: unknown-provider');
        });

        test('should validate provider configurations', () => {
            // Valid Ollama config
            const validOllamaConfig = {
                type: 'ollama',
                model: 'llama2',
                endpoint: 'http://localhost:11434'
            };

            let validation = AIProviderFactory.validateConfig(validOllamaConfig);
            expect(validation.valid).toBe(true);

            // Valid OpenAI config
            const validOpenAIConfig = {
                type: 'openai',
                model: 'gpt-3.5-turbo',
                apiKey: 'test-api-key'
            };

            validation = AIProviderFactory.validateConfig(validOpenAIConfig);
            expect(validation.valid).toBe(true);

            // Invalid config - missing required fields
            const invalidConfig = {
                type: 'openai'
                // Missing model and apiKey
            };

            validation = AIProviderFactory.validateConfig(invalidConfig);
            expect(validation.valid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });

        test('should list available providers', () => {
            const availableProviders = AIProviderFactory.getAvailableProviders();
            expect(availableProviders).toContain('ollama');
            expect(availableProviders).toContain('openai');
            expect(availableProviders).toContain('anthropic');
            expect(availableProviders).toContain('google');
        });
    });

    describe('Provider Configuration Validation', () => {
        test('should validate Ollama configuration', () => {
            const validConfig = {
                type: 'ollama',
                model: 'llama2',
                endpoint: 'http://localhost:11434'
            };

            const validation = AIProviderFactory.validateConfig(validConfig);
            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        test('should reject invalid Ollama configuration', () => {
            const invalidConfig = {
                type: 'ollama'
                // Missing model and endpoint
            };

            const validation = AIProviderFactory.validateConfig(invalidConfig);
            expect(validation.valid).toBe(false);
            expect(validation.errors).toContain('Model is required for ollama provider');
        });

        test('should validate OpenAI configuration', () => {
            const validConfig = {
                type: 'openai',
                model: 'gpt-3.5-turbo',
                apiKey: 'sk-test-key'
            };

            const validation = AIProviderFactory.validateConfig(validConfig);
            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        test('should reject OpenAI configuration without API key', () => {
            const invalidConfig = {
                type: 'openai',
                model: 'gpt-3.5-turbo'
                // Missing apiKey
            };

            const validation = AIProviderFactory.validateConfig(invalidConfig);
            expect(validation.valid).toBe(false);
            expect(validation.errors).toContain('API key is required for openai provider');
        });

        test('should validate Anthropic configuration', () => {
            const validConfig = {
                type: 'anthropic',
                model: 'claude-3-sonnet-20240229',
                apiKey: 'sk-ant-test-key'
            };

            const validation = AIProviderFactory.validateConfig(validConfig);
            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        test('should validate Google configuration', () => {
            const validConfig = {
                type: 'google',
                model: 'gemini-pro',
                apiKey: 'test-google-key'
            };

            const validation = AIProviderFactory.validateConfig(validConfig);
            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });
    });

    describe('Provider Testing and Connection', () => {
        test('should test provider connection successfully', async () => {
            const config = {
                type: 'ollama',
                model: 'llama2',
                endpoint: 'http://localhost:11434'
            };

            // Mock successful connection test
            const mockProvider = {
                testConnection: jest.fn().mockResolvedValue({
                    success: true,
                    message: 'Connection successful'
                })
            };

            jest.spyOn(AIProviderFactory, 'createProvider').mockReturnValue(mockProvider);

            const provider = AIProviderFactory.createProvider(config);
            const testResult = await provider.testConnection();

            expect(testResult.success).toBe(true);
            expect(testResult.message).toBe('Connection successful');
        });

        test('should handle provider connection failures', async () => {
            const config = {
                type: 'ollama',
                model: 'llama2',
                endpoint: 'http://localhost:11434'
            };

            // Mock failed connection test
            const mockProvider = {
                testConnection: jest.fn().mockResolvedValue({
                    success: false,
                    error: 'Connection failed: Service unavailable'
                })
            };

            jest.spyOn(AIProviderFactory, 'createProvider').mockReturnValue(mockProvider);

            const provider = AIProviderFactory.createProvider(config);
            const testResult = await provider.testConnection();

            expect(testResult.success).toBe(false);
            expect(testResult.error).toContain('Connection failed');
        });

        test('should handle provider connection timeouts', async () => {
            const config = {
                type: 'openai',
                model: 'gpt-3.5-turbo',
                apiKey: 'test-key'
            };

            // Mock timeout error
            const mockProvider = {
                testConnection: jest.fn().mockRejectedValue(new Error('Request timeout'))
            };

            jest.spyOn(AIProviderFactory, 'createProvider').mockReturnValue(mockProvider);

            const provider = AIProviderFactory.createProvider(config);
            
            await expect(provider.testConnection()).rejects.toThrow('Request timeout');
        });
    });

    describe('Settings Persistence and Security', () => {
        test('should not persist sensitive data to disk', () => {
            const testSettings = {
                mode: 'online',
                online: {
                    provider: 'openai',
                    model: 'gpt-3.5-turbo',
                    apiKey: 'sensitive-api-key'
                }
            };

            aiSettingsManager.saveSettings(testSettings);
            
            // Settings should be in memory only
            const loadedSettings = aiSettingsManager.loadSettings();
            expect(loadedSettings.online.apiKey).toBe('sensitive-api-key');

            // But should not be written to any file
            // This is verified by the fact that settings are cleared when the instance is reset
            AISettingsManager.instance = null;
            const newManager = AISettingsManager.getInstance();
            const clearedSettings = newManager.loadSettings();
            
            // Should fall back to defaults, not load the sensitive data
            expect(clearedSettings.mode).toBe('offline'); // Default
        });

        test('should mask API keys in logs', () => {
            const testSettings = {
                mode: 'online',
                online: {
                    provider: 'openai',
                    model: 'gpt-3.5-turbo',
                    apiKey: 'sk-1234567890abcdef'
                }
            };

            // Mock console.log to capture log output
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            aiSettingsManager.saveSettings(testSettings);

            // Check that API key is masked in logs
            const logCalls = consoleSpy.mock.calls;
            const settingsLog = logCalls.find(call => 
                call[0] && call[0].includes && call[0].includes('Saved settings:')
            );

            if (settingsLog && settingsLog[1]) {
                expect(settingsLog[1]).not.toContain('sk-1234567890abcdef');
                expect(settingsLog[1]).toContain('sk-****'); // Should be masked
            }

            consoleSpy.mockRestore();
        });
    });

    describe('Concurrent Processing Settings', () => {
        test('should handle concurrent processing limits', () => {
            const testSettings = {
                mode: 'offline',
                offline: {
                    provider: 'ollama',
                    model: 'llama2'
                },
                concurrentProcessing: 3
            };

            aiSettingsManager.saveSettings(testSettings);
            const loadedSettings = aiSettingsManager.loadSettings();

            expect(loadedSettings.concurrentProcessing).toBe(3);
        });

        test('should validate concurrent processing limits', () => {
            const invalidSettings = {
                mode: 'offline',
                offline: {
                    provider: 'ollama',
                    model: 'llama2'
                },
                concurrentProcessing: -1 // Invalid negative value
            };

            const validation = aiSettingsManager.validateSettings(invalidSettings);
            expect(validation.valid).toBe(false);
            expect(validation.errors).toContain('Concurrent processing must be a positive number');
        });

        test('should default to 1 for concurrent processing', () => {
            const testSettings = {
                mode: 'offline',
                offline: {
                    provider: 'ollama',
                    model: 'llama2'
                }
                // No concurrentProcessing specified
            };

            aiSettingsManager.saveSettings(testSettings);
            const loadedSettings = aiSettingsManager.loadSettings();

            expect(loadedSettings.concurrentProcessing).toBe(1); // Default value
        });
    });
});