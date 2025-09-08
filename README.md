## DistyVault

DistyVault is a local-first web app to capture URLs, YouTube videos/playlists, and documents, distill them with AI, and manage the results in a simple knowledge base.

### Highlights
- Runs fully in the browser with an IndexedDB
- Process with local models (Ollama) or online AI providers (OpenAI, Anthropic, Google, Grok, DeepSeek)
- Clean UI: capture, track status, export PDFs, and bulk actions

### Usage
- Paste a URL or upload a file to queue processing
- Open Settings to choose Online (provider + model) or Offline (Ollama endpoint/model)
- Use the table to monitor status, open content, view logs, download PDFs, retry, or delete

### Configuration
### Notes
• YouTube fetching is proxy-only by default to avoid 451/429 noise. LangChain’s YouTube loader is opt-in (Settings → Enable LangChain YouTube transcript loader).
• PDFs are generated client-side with proper formatting; downloads are cached for speed.

- AI settings are stored locally in the browser (LocalStorage) and mirrored in-memory in the app
- Online providers require an API key; nothing is sent to a backend by default

### License
MIT License

Copyright © 2025 DistyVault

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.