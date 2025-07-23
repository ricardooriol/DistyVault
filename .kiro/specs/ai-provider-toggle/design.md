# AI Provider Toggle Design

## Overview

The AI provider toggle system will allow users to switch between offline (Ollama) and online (cloud AI providers) modes. The system will provide a clean, intuitive interface for configuring different AI providers with their respective API keys and model selections.

## Architecture

The solution will implement a modular AI provider system with:

1. **Frontend Configuration UI**: Toggle switch, provider selection, and configuration forms
2. **AI Provider Service**: Abstraction layer for different AI providers
3. **Settings Management**: Persistent storage for user preferences
4. **Provider Implementations**: Specific implementations for each AI service

## Components and Interfaces

### Frontend Components

```javascript
// Main AI Configuration Component
class AIProviderConfig {
    constructor() {
        this.mode = 'offline'; // 'offline' or 'online'
        this.providers = {
            offline: { model: 'llama2' },
            online: { provider: 'openai', apiKey: '', model: 'gpt-3.5-turbo' }
        };
    }
    
    renderModeToggle() {
        // Toggle between offline/online modes
    }
    
    renderOfflineConfig() {
        // Ollama model configuration
    }
    
    renderOnlineConfig() {
        // Cloud provider selection and API key input
    }
}
```

### Backend AI Provider Service

```javascript
// Abstract AI Provider Interface
class AIProvider {
    async generateSummary(text, options = {}) {
        throw new Error('generateSummary must be implemented');
    }
    
    async validateConfiguration() {
        throw new Error('validateConfiguration must be implemented');
    }
    
    getRequiredConfig() {
        throw new Error('getRequiredConfig must be implemented');
    }
}

// Ollama Provider (existing)
class OllamaProvider extends AIProvider {
    constructor(model = 'llama2') {
        super();
        this.model = model;
    }
}

// OpenAI Provider
class OpenAIProvider extends AIProvider {
    constructor(apiKey, model = 'gpt-3.5-turbo') {
        super();
        this.apiKey = apiKey;
        this.model = model;
    }
}

// Provider Factory
class AIProviderFactory {
    static createProvider(config) {
        switch (config.type) {
            case 'ollama':
                return new OllamaProvider(config.model);
            case 'openai':
                return new OpenAIProvider(config.apiKey, config.model);
            case 'anthropic':
                return new AnthropicProvider(config.apiKey, config.model);
            // ... other providers
            default:
                throw new Error(`Unknown provider: ${config.type}`);
        }
    }
}
```

### Settings Management

```javascript
class AISettingsManager {
    constructor() {
        this.storageKey = 'ai-provider-settings';
    }
    
    saveSettings(settings) {
        // Encrypt API keys before storing
        const encrypted = this.encryptSensitiveData(settings);
        localStorage.setItem(this.storageKey, JSON.stringify(encrypted));
    }
    
    loadSettings() {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            const parsed = JSON.parse(stored);
            return this.decryptSensitiveData(parsed);
        }
        return this.getDefaultSettings();
    }
    
    encryptSensitiveData(settings) {
        // Simple encryption for API keys
        // In production, use proper encryption
    }
}
```

## Data Models

### AI Provider Configuration

```javascript
{
    mode: 'offline' | 'online',
    offline: {
        model: string,
        endpoint: string // Ollama endpoint
    },
    online: {
        provider: 'openai' | 'anthropic' | 'google' | 'microsoft' | 'grok' | 'deepseek',
        apiKey: string,
        model: string,
        endpoint?: string // Custom endpoint if needed
    }
}
```

### Provider Definitions

```javascript
const PROVIDERS = {
    openai: {
        name: 'OpenAI',
        models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'],
        apiKeyFormat: /^sk-[A-Za-z0-9]{48}$/,
        endpoint: 'https://api.openai.com/v1/chat/completions'
    },
    anthropic: {
        name: 'Anthropic Claude',
        models: ['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus'],
        apiKeyFormat: /^sk-ant-[A-Za-z0-9-_]{95}$/,
        endpoint: 'https://api.anthropic.com/v1/messages'
    },
    google: {
        name: 'Google Gemini',
        models: ['gemini-pro', 'gemini-pro-vision'],
        apiKeyFormat: /^[A-Za-z0-9_-]{39}$/,
        endpoint: 'https://generativelanguage.googleapis.com/v1/models'
    },
    microsoft: {
        name: 'Microsoft Copilot',
        models: ['gpt-4', 'gpt-3.5-turbo'],
        apiKeyFormat: /^[A-Za-z0-9]{32}$/,
        endpoint: 'https://api.cognitive.microsoft.com/sts/v1.0'
    },
    grok: {
        name: 'Grok',
        models: ['grok-1', 'grok-1.5'],
        apiKeyFormat: /^xai-[A-Za-z0-9]{48}$/,
        endpoint: 'https://api.x.ai/v1/chat/completions'
    },
    deepseek: {
        name: 'Deepseek',
        models: ['deepseek-chat', 'deepseek-coder'],
        apiKeyFormat: /^sk-[A-Za-z0-9]{48}$/,
        endpoint: 'https://api.deepseek.com/v1/chat/completions'
    }
};
```

## User Interface Design

### Main Configuration Panel

```html
<div class="ai-provider-config">
    <div class="mode-toggle">
        <label class="toggle-switch">
            <input type="checkbox" id="mode-toggle">
            <span class="slider"></span>
        </label>
        <span class="mode-label">Offline (Ollama)</span>
        <span class="mode-label">Online (Cloud)</span>
    </div>
    
    <div id="offline-config" class="config-panel">
        <label for="ollama-model">Ollama Model:</label>
        <input type="text" id="ollama-model" placeholder="llama2">
        <button id="test-ollama">Test Connection</button>
    </div>
    
    <div id="online-config" class="config-panel hidden">
        <label for="provider-select">AI Provider:</label>
        <select id="provider-select">
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic Claude</option>
            <option value="google">Google Gemini</option>
            <option value="microsoft">Microsoft Copilot</option>
            <option value="grok">Grok</option>
            <option value="deepseek">Deepseek</option>
        </select>
        
        <label for="api-key">API Key:</label>
        <input type="password" id="api-key" placeholder="Enter your API key">
        
        <label for="model-select">Model:</label>
        <select id="model-select">
            <!-- Populated based on provider selection -->
        </select>
        
        <button id="test-provider">Test API Key</button>
    </div>
    
    <div class="actions">
        <button id="save-config">Save Configuration</button>
        <button id="reset-config">Reset to Defaults</button>
    </div>
</div>
```

## Error Handling

### Validation Strategies

1. **API Key Validation**: Format checking using regex patterns
2. **Connection Testing**: Actual API calls to validate credentials
3. **Model Availability**: Check if selected models are available
4. **Rate Limiting**: Handle API rate limits gracefully
5. **Network Errors**: Provide fallback options when online services fail

### Error Messages

```javascript
const ERROR_MESSAGES = {
    INVALID_API_KEY: 'Invalid API key format. Please check your key and try again.',
    CONNECTION_FAILED: 'Unable to connect to the AI provider. Please check your internet connection.',
    MODEL_NOT_FOUND: 'The selected model is not available. Please choose a different model.',
    RATE_LIMITED: 'API rate limit exceeded. Please wait before making more requests.',
    OLLAMA_OFFLINE: 'Ollama service is not running. Please start Ollama and try again.'
};
```

## Security Considerations

### API Key Protection

1. **Client-Side Encryption**: Encrypt API keys before storing in localStorage
2. **Secure Transmission**: Use HTTPS for all API communications
3. **Key Masking**: Never display full API keys in the UI
4. **Automatic Cleanup**: Clear sensitive data on logout/session end

### Implementation

```javascript
class SecurityManager {
    static encryptAPIKey(key) {
        // Use Web Crypto API for encryption
        return crypto.subtle.encrypt(algorithm, cryptoKey, encoder.encode(key));
    }
    
    static decryptAPIKey(encryptedKey) {
        return crypto.subtle.decrypt(algorithm, cryptoKey, encryptedKey);
    }
    
    static maskAPIKey(key) {
        if (!key || key.length < 8) return '••••••••';
        return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
    }
}
```

## Testing Strategy

### Unit Tests

1. **Provider Factory**: Test creation of different provider instances
2. **Settings Manager**: Test save/load/encryption functionality
3. **API Key Validation**: Test format validation for each provider
4. **Configuration UI**: Test toggle behavior and form validation

### Integration Tests

1. **End-to-End Provider Testing**: Test actual API calls to each provider
2. **Settings Persistence**: Test configuration saving and loading
3. **Error Handling**: Test various failure scenarios
4. **UI Interactions**: Test complete user workflows

### Manual Testing

1. **Provider Switching**: Test switching between different providers
2. **API Key Management**: Test entering, saving, and using API keys
3. **Error Recovery**: Test recovery from various error conditions
4. **Performance**: Test response times with different providers