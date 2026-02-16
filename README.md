# DistyVault

Turn any source into structured knowledge. DistyVault extracts content from web pages, YouTube videos, playlists, and local files, then distills it into clear, concise summaries using the AI provider of your choice. Everything runs in your browser. No server, no signup, no data leaves your device except the API call you control.

**Live app:** https://distyvault.vercel.app

## Why

Most content is buried in noise. Long articles, hour-long videos, dense PDFs. DistyVault pulls the signal out. You point it at a source, pick a model, and get back structured key points that are actually useful. Your API key, your data, your exports.

## How it works

**Capture** anything by pasting a URL, a YouTube link (single video or full playlist), or dropping local files (PDF, DOCX, images, HTML, plain text).

**Distill** using your own API key with any of five providers: OpenAI, Google Gemini, Anthropic Claude, DeepSeek, or Grok. The app prepares a structured prompt, sends your content to the provider, and formats the response into a clean, readable document with numbered key points.

**Manage** your queue with search, filters, sorting, bulk selection, retry, and stop controls. Export individual results as PDF or download everything as a ZIP archive. Import and export your full database for backup or portability.

## Supported sources

- **Web pages**: articles, blog posts, documentation, any public URL
- **YouTube**: single videos (transcript extraction) and playlists (auto-expands up to 100 entries)
- **Local files**: PDF (text layer with OCR fallback), DOCX, images (Tesseract OCR), HTML, plain text

## Supported providers

| Provider | Default model |
|---|---|
| Google Gemini | Gemini 3 Flash |
| OpenAI | GPT-5 Mini |
| Anthropic Claude | Claude Sonnet 4.5 |
| DeepSeek | DeepSeek Chat |
| Grok (xAI) | Grok 4 |

You can select any available model from the settings panel.

## Privacy

- API keys are stored in your browser and sent directly to the provider you select. They never touch any intermediary server.
- All extracted content and distilled output lives in your browser's IndexedDB. Nothing is stored remotely.
- A minimal proxy endpoint (`/api/fetch`) is used only when a target URL blocks cross-origin requests. It enforces protocol restrictions, timeouts, and response size limits.

## Architecture

The app is a single-page client-side application with no build step. It loads React (UMD) and Babel standalone via CDN, transpiling JSX at runtime.

```
index.html              Entry point, script loading, theme init
src/
  App.jsx               UI components and application state
  core/
    db.js               IndexedDB operations, ZIP import/export
    queue.js            Item lifecycle, scheduling, concurrency
    eventBus.js         Pub/sub for inter-module communication
    toast.js            Transient notifications
  extractors/
    index.js            Dispatcher by item type
    url.js              Web page content extraction
    youtube.js          YouTube video/playlist handling
    files.js            PDF, DOCX, image, and text extraction
  ai/
    service.js          Prompt preparation, provider orchestration
    providers/
      openai.js         OpenAI chat completions
      gemini.js         Google Gemini generateContent
      anthropic.js      Anthropic Claude messages
      deepseek.js       DeepSeek chat completions
      grok.js           xAI Grok chat completions
api/
  fetch.js              CORS proxy with protocol/size/timeout guards
```

## Contributing

The project runs from static hosting with in-browser transpilation. For larger contributions (new extractors, providers, or packaging changes), open an issue first to discuss scope and design.

## License

Copyright 2025. All rights reserved.
