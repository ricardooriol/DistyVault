# SAWRON - Connect the Dots & Fill the Gaps

**The Ultimate Knowledge Distillation & AI Processing Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v14+-green.svg)](https://nodejs.org/)
[![AI Powered](https://img.shields.io/badge/AI-Powered-blue.svg)](https://github.com/your-repo)

---

## What is SAWRON?

SAWRON is a powerful knowledge distillation application that transforms diverse content sources into structured, actionable insights using advanced AI. You have complete control over your data processing - choose between **local AI processing** for maximum privacy or **online AI providers** for enhanced capabilities. The application runs locally on your machine, but you decide where the AI processing happens.

### Core Purpose

SAWRON distills complex information from various sources into clear, numbered insights that help you:
- **Connect scattered information** across different content types
- **Fill knowledge gaps** with AI-powered analysis and research
- **Build a searchable knowledge base** of distilled insights
- **Choose your privacy level** - use local AI models or online providers based on your needs

---

## Key Features

- **🔒 Privacy Control** - Choose between local AI processing (private) or online providers (enhanced capabilities)
- **🤖 Multi-AI Support** - Works with OpenAI, Anthropic, Google, Grok, DeepSeek, and Ollama
- **📚 Universal Content Processing** - YouTube videos, web pages, documents, and direct text
- **⚡ Real-time Processing** - Live status updates and progress tracking
- **💾 Local Knowledge Base** - SQLite-powered storage with full-text search
- **📊 Bulk Operations** - Process multiple items, bulk download, and batch management
- **🎨 Modern Interface** - Clean, intuitive browser-based UI

---

## Installation

### Prerequisites
- **Node.js** (v14 or higher) - [Download here](https://nodejs.org/)
- **Git** - [Download here](https://git-scm.com/)

### Quick Setup

1. **Clone and Install**
   ```bash
   git clone https://github.com/your-username/sawron.git
   cd sawron
   npm install
   ```

2. **Start the Application**
   ```bash
   npm start
   ```

3. **Open in Browser**
   ```
   http://localhost:3000
   ```

4. **Configure AI Provider** (see Configuration section below)

---

## Configuration

### AI Providers

SAWRON supports multiple AI providers, giving you the flexibility to choose based on your privacy needs and performance requirements:

#### 🦙 Ollama (Local Processing - Maximum Privacy)
**Free, runs locally, no API keys needed, data never leaves your machine**

```bash
# Install Ollama
brew install ollama  # macOS
# or download from https://ollama.ai

# Start service and pull a model
ollama serve
ollama pull phi3:mini
```

#### ☁️ Online Providers (Enhanced Capabilities)
**More powerful models, faster processing, requires API keys, data sent to provider**
- **OpenAI**: Get API key from [platform.openai.com](https://platform.openai.com/api-keys)
- **Anthropic**: Get API key from [console.anthropic.com](https://console.anthropic.com/)
- **Google**: Get API key from [makersuite.google.com](https://makersuite.google.com/app/apikey)
- **Grok**: Get API key from [console.x.ai](https://console.x.ai/)
- **DeepSeek**: Get API key from [platform.deepseek.com](https://platform.deepseek.com/)

### Configuration Steps
1. Open SAWRON in your browser
2. Click the Settings button (⚙️)
3. **Choose your processing approach**:
   - **Local**: Select Ollama for privacy-first processing
   - **Online**: Choose OpenAI, Anthropic, Google, Grok, or DeepSeek for enhanced capabilities
4. Enter your API key (for online providers) or configure Ollama endpoint (for local)
5. Select your preferred model
6. Test the connection and save

---

## Privacy & Data Control

SAWRON gives you complete control over how your data is processed:

### 🔒 Local Processing (Ollama)
- **Maximum Privacy**: Your content never leaves your machine
- **No API Keys**: No external accounts or subscriptions needed
- **Offline Capable**: Works without internet connection
- **Trade-off**: May be slower and less capable than online models

### ☁️ Online Processing (OpenAI, Anthropic, etc.)
- **Enhanced Capabilities**: Access to the most powerful AI models
- **Faster Processing**: Optimized online infrastructure
- **Regular Updates**: Always access to latest model improvements
- **Trade-off**: Your content is sent to the AI provider for processing

**Your Choice**: Switch between providers anytime based on your current needs - use local for sensitive content and online for enhanced capabilities.

---

## Usage

### Processing Content

- **YouTube Videos**: Paste any YouTube Video/Playlist URL and click Distill
- **Web Pages**: Enter any webpage URL for content extraction
- **Documents**: Upload PDF, DOCX, or TXT files (up to 50MB)

### Managing Knowledge

- **Search**: Full-text search across all distilled content
- **Filter**: By source type (YouTube, Web, Documents)
- **Bulk Operations**: Select multiple items for batch download or deletion
- **Export**: Download individual items as PDF or multiple as ZIP

### Understanding Output

Each processed item generates:
- **Structured Insights**: Numbered points with detailed explanations
- **Source Metadata**: Original URL, processing time, word count
- **Processing Logs**: Detailed information about extraction and analysis
- **Raw Content**: Access to original extracted text

---

## Architecture

SAWRON is built with:
- **Backend**: Node.js with Express.js (runs locally)
- **Database**: SQLite for local storage (your data stays on your machine)
- **Frontend**: Vanilla JavaScript with modern CSS
- **AI Integration**: Modular provider system (supports both local and online AI)
- **Content Extraction**: LangChain, Puppeteer, and custom processors

---

## Future Enhancements

- **Additional AI Providers**: Integration with more AI services and local models
- **Export Formats**: Markdown, JSON, XML, and custom templates
- **Automation**: Scheduled processing, webhooks, and workflow triggers
- **App**: Native applications for Windows, MacOS, Linux, iOS and Android

---

## License

This project is licensed under the MIT License:

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

**Made with ❤️ for knowledge seekers and information architects**

[⭐ Star this repo](https://github.com/your-username/sawron) | [🐛 Report Bug](https://github.com/your-username/sawron/issues) | [💡 Request Feature](https://github.com/your-username/sawron/issues)