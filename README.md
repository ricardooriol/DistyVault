## DistyVault

DistyVault is a local-first web app to capture URLs, YouTube videos/playlists, and documents, distill them with AI, and manage the results in a simple knowledge base.

### Highlights
- Runs fully in the browser with a small local HTTP server for static files.
- Process with local models (Ollama) or cloud providers (OpenAI, Anthropic, Google, Grok, DeepSeek).
- Clean UI: capture, track status, view logs, export PDFs, and bulk actions.

### Quick start
1) Install dependencies (optional; app mostly loads via CDN). You can serve the folder with any static server. A simple option is included:
	- macOS/Linux: use the provided npm script to serve with Python
2) Start a local server on port 8000
3) Open http://localhost:8000

### Usage
- Paste a URL or upload a file to queue processing.
- Open Settings to choose Online (provider + model) or Offline (Ollama endpoint/model).
- Use the table to monitor status, open content, view logs, download PDFs, retry, or delete.

### Configuration
- AI settings are stored locally in the browser (LocalStorage) and mirrored in-memory in the app.
- Online providers require an API key; nothing is sent to a backend by default.

### Development
- The React UI is loaded via UMD + Babel and lives in `styles/react/App.jsx`.
- Legacy vanilla JS components remain in `src/` and are still loaded for core logic and APIs.

### License
MIT