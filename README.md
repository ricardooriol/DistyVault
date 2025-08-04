# 💠 SAWRON - Connect the Dots & Fill the Gaps 💠

**The Ultimate Knowledge Distillation AI Processing Platform**

---

## What is SAWRON?

SAWRON is a powerful knowledge distillation platform that transforms diverse content sources into structured, actionable insights using advanced AI. You have complete control over your data processing - choose between **local AI processing** for maximum privacy or **online AI providers** for enhanced capabilities. The application runs locally on your machine, but you decide where the AI processing happens.

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
- **📚 Universal Content Processing** - YouTube videos/playlists, web pages and documents
- **⚡ Real-time Processing** - Live status updates and progress tracking
- **💾 Local Knowledge Base** - SQLite-powered storage with full-text search
- **📊 Bulk Operations** - Process multiple items, bulk download, and batch management
- **🎨 Modern Interface** - Clean, intuitive browser-based UI

---

## Installation


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

### Configuration Steps
1. Click the Settings button (⚙️)
2. **Choose your processing approach**:
   - **Local**: Select Ollama for privacy-first processing
   - **Online**: Choose OpenAI, Anthropic, Google, Grok, or DeepSeek for enhanced capabilities
3. Enter your API key (for online providers) or configure Ollama endpoint (for local)
4. Select your preferred model
5. Test the connection and save


---

## Future Enhancements

- **Web Search**: Real time web search to complement processing for all AI providers (only available in Gemini models at the moment)
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