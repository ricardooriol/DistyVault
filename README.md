DistyVault
==========

A lightweight, browser-based tool to gather, distill, and control knowledge from URLs, YouTube links, and local files. No local setup required—use the hosted app.

Live app
--------

- https://distyvault.vercel.app

What it does
------------

- Capture content
	- Paste a web URL (article, blog post, documentation)
	- Paste a YouTube URL (single video) or playlist URL (adds entries per video)
	- Drop or select local files (PDF, DOCX, images for OCR, etc.)
- Distill with AI
	- Choose your provider (OpenAI, Gemini, Anthropic, Deepseek, Grok) and model
	- Provide your own API key; keys are used from your browser only
	- Generates concise, structured summaries with key points
- Manage and export
	- Queue processing with per-item status and timing
	- Retry/stop, search, filter, and bulk select
	- Export content as PDF (single or bulk ZIP) and full database backup as ZIP

At a glance: how it works
-------------------------

- Everything runs client-side in your browser. The app uses React (UMD) and loads modules directly via script tags.
- Content extraction
	- URLs: fetch page HTML, extract main content heuristically; use a small proxy endpoint for cross-origin when needed
	- YouTube: parse metadata and fetch transcripts when available; playlists expand to multiple items
	- Files: PDF (text layer preferred, OCR fallback), DOCX (Mammoth), images (Tesseract OCR)
- Distillation: prompts are prepared uniformly, then sent to your selected AI provider using your API key (no server-side storage)
- Persistence: IndexedDB stores items, distilled HTML, and settings; export/import uses a ZIP manifest
- Eventing/queue: a small in-browser scheduler processes items with configurable concurrency

Privacy and data handling
-------------------------

- API keys: stored in browser storage and sent only to the selected AI provider from your device
- Content: extracted text and distilled output live in your browser’s IndexedDB; export/import under your control
- Network proxy: a minimal fetch endpoint is used only for cross-origin reads when necessary, with size and timeout limits

Limits and guardrails
---------------------

- AI input is trimmed to a safe length for provider limits
- Network requests have timeouts and response size caps
- YouTube playlists are capped (e.g., first 100 items) for responsiveness

Architecture overview
---------------------

- index.html: loads everything (Tailwind via CDN, React UMD, Babel stand‑alone)
- src/core
	- eventBus: simple pub/sub for UI and processing events
	- db: IndexedDB schema and ZIP import/export
	- queue: item lifecycle, scheduling, concurrency, status
	- toast: minimal notifications
- src/extractors
	- url, youtube, files: content extraction pipelines with graceful fallbacks
	- index: dispatcher by item type
- src/ai
	- service: prompt prep and provider orchestration
	- providers: OpenAI, Gemini, Anthropic, Deepseek, Grok
- src/core/fetch.js: tiny proxy with CORS, allow‑listed protocols, timeouts, and response size caps (exposed at /api/fetch)

Contributing
------------

This repo is designed to run from static hosting with in‑browser transpilation. If you plan larger contributions (new extractors/providers, UX, or packaging), open an issue first to coordinate design and scope.

License
-------

Copyright © 2025. All rights reserved.
