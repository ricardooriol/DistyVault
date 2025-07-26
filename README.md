# 🧠 SAWRON - Connect the Dots & Fill the Gaps

<div align="center">

**The Ultimate Local Knowledge Processing & AI Summarization Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v14+-green.svg)](https://nodejs.org/)
[![AI Powered](https://img.shields.io/badge/AI-Powered-blue.svg)](https://github.com/your-repo)

*Transform any content into structured, actionable knowledge with the power of AI*

</div>

---

## 🎯 What is SAWRON?

SAWRON is a powerful, **privacy-first** local knowledge processing application that transforms diverse content sources into comprehensive, structured summaries using advanced AI. Unlike cloud-based solutions, SAWRON runs entirely on your machine, ensuring your data never leaves your control.

### 🌟 Key Highlights

- **🔒 100% Local & Private** - No data ever leaves your machine
- **🤖 Multi-AI Support** - Works with 7+ AI providers (OpenAI, Anthropic, Google, Ollama, etc.)
- **📚 Universal Content Processing** - YouTube videos, web pages, documents, and more
- **⚡ Real-time Processing** - Live status updates and progress tracking
- **🎨 Modern Web Interface** - Clean, intuitive browser-based UI
- **💾 Local Database** - SQLite-powered knowledge base with full-text search
- **📊 Bulk Operations** - Process multiple items, bulk download, and batch management

---

## 🚀 What SAWRON Does

### Input Sources
SAWRON can process and summarize content from:

| Source Type | Supported Formats | Description |
|-------------|------------------|-------------|
| **🎥 YouTube Videos** | Any public YouTube URL | Extracts transcripts and generates comprehensive summaries |
| **🌐 Web Pages** | Any accessible URL | Scrapes and processes web content intelligently |
| **📄 Documents** | PDF, DOCX, TXT | Uploads and processes local documents |
| **📋 Direct Text** | Plain text input | Process any text content directly |

### Output Format
Every processed item generates:

- **📝 Structured Summary** - Sequential numbered insights with detailed explanations
- **🏷️ Metadata** - Source information, processing time, word count, extraction method
- **🔍 Searchable Content** - Full-text search across all summaries
- **📊 Processing Stats** - Performance metrics and extraction details
- **💾 Persistent Storage** - All summaries saved locally in SQLite database

### AI-Powered Analysis
SAWRON uses advanced AI to:
- **Distill Core Concepts** - Extract fundamental ideas from complex content
- **Research & Synthesize** - Fill knowledge gaps with expert-level research
- **Structure Information** - Present insights in clear, numbered format
- **Maintain Context** - Preserve important details while eliminating fluff

---

## 🛠️ Installation & Setup

### Prerequisites

Before installing SAWRON, ensure you have:

- **Node.js** (v14 or higher) - [Download here](https://nodejs.org/)
- **Git** - [Download here](https://git-scm.com/)
- **AI Provider** - At least one of the supported AI services (see AI Configuration section)

### Quick Start (5 minutes)

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/sawron.git
   cd sawron
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start the Application**
   ```bash
   npm start
   ```

4. **Open in Browser**
   ```
   http://localhost:3000
   ```

5. **Configure AI Provider** (see AI Configuration section below)

That's it! SAWRON is now running locally on your machine.

---

## 🤖 AI Provider Configuration

SAWRON supports multiple AI providers. You need to configure at least one to start processing content.

### Supported AI Providers

| Provider | Models | Setup Difficulty | Cost |
|----------|--------|------------------|------|
| **🦙 Ollama** | Llama, Phi, Mistral, etc. | Easy | Free |
| **🤖 OpenAI** | GPT-3.5, GPT-4, GPT-4o | Easy | Paid |
| **🧠 Anthropic** | Claude 3 (Haiku, Sonnet, Opus) | Easy | Paid |
| **🔍 Google** | Gemini Pro, Gemini Flash | Easy | Free tier available |
| **🚀 Deepseek** | Deepseek models | Easy | Paid |
| **🐦 Grok** | Grok models | Easy | Paid |
| **🏢 Microsoft** | Azure OpenAI | Medium | Paid |

### Quick Setup Guides

#### 🦙 Ollama (Recommended for Beginners)
**Free, runs locally, no API keys needed**

1. **Install Ollama**
   ```bash
   # macOS
   brew install ollama
   
   # Linux
   curl -fsSL https://ollama.ai/install.sh | sh
   
   # Windows: Download from https://ollama.ai
   ```

2. **Start Ollama Service**
   ```bash
   ollama serve
   ```

3. **Pull a Model**
   ```bash
   # Recommended models
   ollama pull phi3:mini        # Fast, efficient
   ollama pull llama3.2:3b      # Balanced performance
   ollama pull mistral:7b       # High quality
   ```

4. **Configure in SAWRON**
   - Open SAWRON in browser
   - Go to Settings → AI Configuration
   - Select "Ollama" as provider
   - Set endpoint: `http://localhost:11434`
   - Choose your downloaded model

#### 🤖 OpenAI
1. Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. In SAWRON Settings → AI Configuration:
   - Provider: OpenAI
   - API Key: `sk-your-api-key-here`
   - Model: `gpt-3.5-turbo` or `gpt-4`

#### 🧠 Anthropic Claude
1. Get API key from [Anthropic Console](https://console.anthropic.com/)
2. In SAWRON Settings → AI Configuration:
   - Provider: Anthropic
   - API Key: `sk-ant-your-api-key-here`
   - Model: `claude-3-haiku-20240307`

#### 🔍 Google Gemini
1. Get API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. In SAWRON Settings → AI Configuration:
   - Provider: Google
   - API Key: Your Google API key
   - Model: `gemini-pro`

---

## 📖 How to Use SAWRON

### Processing Content

#### 🎥 YouTube Videos
1. Copy any YouTube video URL
2. Paste into the URL field
3. Click "Process URL"
4. Watch real-time progress as SAWRON:
   - Extracts video transcript
   - Analyzes content with AI
   - Generates structured summary

#### 🌐 Web Pages
1. Enter any web page URL
2. Click "Process URL"
3. SAWRON will:
   - Scrape the page content
   - Clean and process the text
   - Generate comprehensive summary

#### 📄 Document Upload
1. Click "Upload File" button
2. Select PDF, DOCX, or TXT file (up to 50MB)
3. File will be processed automatically
4. View extracted content and AI summary

### Managing Your Knowledge Base

#### 🔍 Search & Filter
- **Full-text search**: Find content across all summaries
- **Filter by source**: YouTube, Web, Documents
- **Sort options**: Date, title, processing time
- **Status filter**: Completed, processing, failed

#### 📊 Bulk Operations
- **Select multiple items**: Use checkboxes to select summaries
- **Bulk download**: Download selected items as PDF or ZIP
- **Bulk delete**: Remove multiple summaries at once
- **Select all/none**: Quick selection controls

#### 📱 Interface Features
- **Real-time updates**: Live processing status
- **Progress tracking**: See extraction and AI processing progress
- **Responsive design**: Works on desktop, tablet, and mobile
- **Dark/light themes**: Comfortable viewing in any environment

---

## ⚙️ Configuration Options

### Application Settings

#### Processing Settings
- **Concurrent processing limit**: Control how many items process simultaneously
- **Timeout settings**: Configure processing timeouts
- **Retry attempts**: Set retry behavior for failed processing

#### AI Settings
- **Provider selection**: Choose your preferred AI service
- **Model configuration**: Select specific models for different providers
- **Temperature settings**: Control AI creativity vs consistency
- **Token limits**: Set maximum response lengths

#### Storage Settings
- **Database location**: Configure SQLite database path
- **File upload directory**: Set upload folder location
- **Cleanup policies**: Automatic cleanup of old files

### Environment Variables

Create a `.env` file in the root directory for advanced configuration:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Database
DATABASE_PATH=./data/sawron.db

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800

# AI Provider API Keys (optional)
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
GOOGLE_API_KEY=your-google-key

# Ollama Configuration
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_MODEL=phi3:mini
```

---

## 🏗️ Architecture & Technical Details

### System Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Browser   │◄──►│   Express.js     │◄──►│   AI Providers  │
│   (Frontend)    │    │   (Backend)      │    │   (OpenAI, etc) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   SQLite DB      │
                       │   (Local Storage)│
                       └──────────────────┘
```

### Core Components

#### Backend Services
- **`server.js`** - Express.js web server and API endpoints
- **`services/processor.js`** - Content processing orchestration
- **`services/contentExtractor.js`** - Content extraction from various sources
- **`services/database.js`** - SQLite database operations
- **`services/ai/`** - AI provider integrations and management

#### AI System
- **`AIProvider.js`** - Base class for all AI providers
- **`NumberingProcessor.js`** - Post-processing for consistent formatting
- **`AIProviderFactory.js`** - Dynamic provider instantiation
- **`AISettingsManager.js`** - Configuration management

#### Content Processing
- **YouTube Transcript Extraction** - LangChain-based transcript retrieval
- **Web Scraping** - Cheerio-based content extraction
- **Document Processing** - PDF, DOCX, TXT parsing
- **Content Validation** - Quality checks and error handling

### Database Schema
```sql
-- Summaries table
CREATE TABLE summaries (
    id TEXT PRIMARY KEY,
    title TEXT,
    content TEXT,
    sourceUrl TEXT,
    sourceType TEXT,
    sourceFile TEXT,
    status TEXT,
    processingStep TEXT,
    rawContent TEXT,
    createdAt TEXT,
    completedAt TEXT,
    processingTime REAL,
    wordCount INTEGER,
    error TEXT
);
```

---

## 🔧 Development & Customization

### Development Mode

For development with auto-reload:
```bash
npm run dev
```

### Adding New AI Providers

1. Create new provider class in `services/ai/providers/`:
```javascript
const AIProvider = require('../AIProvider');

class CustomProvider extends AIProvider {
    async generateSummary(text, options = {}) {
        // Your implementation
        const rawSummary = await this.callCustomAPI(text);
        return this.postProcessSummary(rawSummary);
    }
    
    async validateConfiguration() {
        // Validation logic
    }
}

module.exports = CustomProvider;
```

2. Register in `AIProviderFactory.js`
3. Add configuration UI in frontend

### Customizing Content Processing

Modify `services/contentExtractor.js` to add new content sources:
```javascript
async extractFromCustomSource(url) {
    // Your extraction logic
    return {
        text: extractedContent,
        title: contentTitle,
        contentType: 'custom-source',
        extractionMethod: 'custom-method'
    };
}
```

### Frontend Customization

- **`public/index.html`** - Main HTML structure
- **`public/app.js`** - JavaScript functionality
- **`public/styles.css`** - Styling and themes

---

## 📦 Dependencies & Requirements

### Core Dependencies
```json
{
  "express": "^4.18.2",           // Web server framework
  "sqlite3": "^5.1.6",           // Local database
  "axios": "^1.6.2",             // HTTP client
  "cheerio": "^1.0.0-rc.12",     // Web scraping
  "multer": "^1.4.5-lts.1",      // File upload handling
  "cors": "^2.8.5"               // Cross-origin requests
}
```

### AI & Processing
```json
{
  "@langchain/community": "^0.3.49",  // LangChain integrations
  "@google/generative-ai": "^0.24.1", // Google Gemini
  "pdf-parse": "^1.1.1",             // PDF processing
  "mammoth": "^1.6.0",               // DOCX processing
  "youtube-transcript": "^1.0.6",     // YouTube transcripts
  "puppeteer": "^24.15.0"            // Web automation
}
```

### System Requirements
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 1GB free space for application and database
- **Network**: Internet connection for AI APIs and content fetching
- **Browser**: Modern browser (Chrome, Firefox, Safari, Edge)

---

## 🚨 Troubleshooting

### Common Issues & Solutions

#### "Cannot connect to AI provider"
- **Ollama**: Ensure `ollama serve` is running
- **API Keys**: Verify API keys are correct and have sufficient credits
- **Network**: Check internet connection for cloud providers

#### "Transcript extraction failed"
- **YouTube**: Video may be private, age-restricted, or have no transcript
- **Web pages**: Site may block automated access
- **Solution**: Try different content or check source accessibility

#### "File upload failed"
- **Size limit**: Files must be under 50MB
- **Format**: Only PDF, DOCX, TXT supported
- **Permissions**: Ensure write permissions in upload directory

#### "Database errors"
- **Permissions**: Check write permissions in application directory
- **Corruption**: Delete `data/sawron.db` to reset (loses all data)
- **Space**: Ensure sufficient disk space

#### Performance Issues
- **Memory**: Close other applications if processing large files
- **Model size**: Use smaller AI models for faster processing
- **Concurrent processing**: Reduce concurrent processing limit in settings

### Debug Mode

Enable detailed logging:
```bash
DEBUG=sawron:* npm start
```

### Log Files
Application logs are written to console. For persistent logging:
```bash
npm start > sawron.log 2>&1
```

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Setup
1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/sawron.git`
3. Install dependencies: `npm install`
4. Create feature branch: `git checkout -b feature/amazing-feature`
5. Make changes and test thoroughly
6. Commit: `git commit -m 'Add amazing feature'`
7. Push: `git push origin feature/amazing-feature`
8. Open Pull Request

### Contribution Guidelines
- Follow existing code style and patterns
- Add tests for new functionality
- Update documentation for user-facing changes
- Ensure all tests pass before submitting
- Write clear, descriptive commit messages

### Areas for Contribution
- 🤖 New AI provider integrations
- 📄 Additional content source support
- 🎨 UI/UX improvements
- 🔧 Performance optimizations
- 📚 Documentation improvements
- 🧪 Test coverage expansion

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 SAWRON

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙏 Acknowledgments

- **LangChain** - For excellent AI integration framework
- **Ollama** - For making local AI accessible to everyone
- **OpenAI, Anthropic, Google** - For powerful AI models
- **Node.js Community** - For amazing tools and libraries
- **Contributors** - For making SAWRON better every day

---

<div align="center">

**Made with ❤️ for the knowledge-hungry minds**

[⭐ Star this repo](https://github.com/your-username/sawron) | [🐛 Report Bug](https://github.com/your-username/sawron/issues) | [💡 Request Feature](https://github.com/your-username/sawron/issues)

</div>