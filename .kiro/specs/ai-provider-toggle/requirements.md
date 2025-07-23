# AI Provider Toggle Requirements

## Introduction

The application currently only supports Ollama for AI summarization. Users need the ability to choose between offline (local Ollama) and online (cloud AI providers) modes, with support for multiple AI providers including OpenAI, Microsoft Copilot, Anthropic Claude, Google Gemini, Grok, and Deepseek.

## Requirements

### Requirement 1: AI Provider Mode Toggle

**User Story:** As a user, I want to choose between offline (local) and online (cloud) AI providers, so that I can use either my local Ollama installation or cloud-based AI services.

#### Acceptance Criteria

1. WHEN accessing the application THEN the system SHALL display a toggle to switch between "Offline" and "Online" modes
2. WHEN "Offline" mode is selected THEN the system SHALL show Ollama configuration options
3. WHEN "Online" mode is selected THEN the system SHALL show cloud AI provider options
4. WHEN the mode is changed THEN the system SHALL save the preference for future sessions
5. IF no mode is previously selected THEN the system SHALL default to "Offline" mode

### Requirement 2: Offline Mode Configuration

**User Story:** As a user, I want to configure my local Ollama model, so that I can use my preferred local AI model for summarization.

#### Acceptance Criteria

1. WHEN "Offline" mode is selected THEN the system SHALL display a text input for the Ollama model name
2. WHEN the model name is entered THEN the system SHALL validate that the model exists locally
3. WHEN a valid model is configured THEN the system SHALL use it for all summarization requests
4. IF no model is specified THEN the system SHALL use a default model (e.g., "llama2")
5. WHEN the model configuration changes THEN the system SHALL save the preference

### Requirement 3: Online Mode Provider Selection

**User Story:** As a user, I want to choose from popular AI providers, so that I can use my preferred cloud AI service for summarization.

#### Acceptance Criteria

1. WHEN "Online" mode is selected THEN the system SHALL display a dropdown with AI provider options
2. WHEN the dropdown is opened THEN the system SHALL show: OpenAI, Microsoft Copilot, Anthropic Claude, Google Gemini, Grok, and Deepseek
3. WHEN a provider is selected THEN the system SHALL show the appropriate API key input field
4. WHEN an API key is entered THEN the system SHALL validate the key format
5. WHEN a valid provider and API key are configured THEN the system SHALL use them for summarization

### Requirement 4: API Key Management

**User Story:** As a user, I want to securely enter and manage my API keys, so that I can authenticate with cloud AI providers safely.

#### Acceptance Criteria

1. WHEN entering an API key THEN the system SHALL mask the input (password field)
2. WHEN an API key is saved THEN the system SHALL store it securely (encrypted if possible)
3. WHEN the page is refreshed THEN the system SHALL remember the configured API key without displaying it
4. WHEN the API key is invalid THEN the system SHALL show an appropriate error message
5. IF the API key is changed THEN the system SHALL validate the new key before saving

### Requirement 5: Provider-Specific Configuration

**User Story:** As a user, I want provider-specific configuration options, so that I can optimize the AI service for my needs.

#### Acceptance Criteria

1. WHEN OpenAI is selected THEN the system SHALL show model selection (GPT-3.5, GPT-4, etc.)
2. WHEN Anthropic Claude is selected THEN the system SHALL show model selection (Claude-3, Claude-3.5, etc.)
3. WHEN Google Gemini is selected THEN the system SHALL show model selection (Gemini Pro, Gemini Ultra, etc.)
4. WHEN other providers are selected THEN the system SHALL show appropriate model options
5. WHEN a model is selected THEN the system SHALL use it for summarization requests

### Requirement 6: Settings Persistence

**User Story:** As a user, I want my AI provider settings to be remembered, so that I don't have to reconfigure them every time I use the application.

#### Acceptance Criteria

1. WHEN settings are changed THEN the system SHALL save them to local storage
2. WHEN the application is reloaded THEN the system SHALL restore the previous settings
3. WHEN switching between modes THEN the system SHALL remember the last configuration for each mode
4. IF settings become corrupted THEN the system SHALL reset to default values
5. WHEN settings are reset THEN the system SHALL notify the user

### Requirement 7: Error Handling and Validation

**User Story:** As a user, I want clear error messages when configuration fails, so that I can fix issues quickly.

#### Acceptance Criteria

1. WHEN an invalid API key is entered THEN the system SHALL show a specific error message
2. WHEN a local model is not found THEN the system SHALL suggest available models
3. WHEN network connectivity fails THEN the system SHALL provide appropriate fallback options
4. WHEN rate limits are exceeded THEN the system SHALL inform the user and suggest alternatives
5. IF configuration validation fails THEN the system SHALL prevent saving invalid settings