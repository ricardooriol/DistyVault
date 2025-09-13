# DistyVault (MVP 0.1)

Local‑first, zero-backend AI distillation vault. Runs entirely in your browser with IndexedDB storage. No build step—just open `index.html`.

## Quick start

1. Open `index.html` in a modern browser (Chrome, Edge, Safari, Firefox).
   - If your browser restricts some features on `file://`, serve the folder locally.

Optional local server:

```sh
# one of the following
python3 -m http.server 8080
# or
npx serve .
```

Then navigate to http://localhost:8080

## What's included

- React 18 UMD + Babel in browser, Tailwind Play CDN, Inter font
- IndexedDB storage for items, contents, and settings
- Concurrency-controlled queue (1–10)
- Capture:
  - Paste URL (CORS permitting)
  - YouTube link recognition (placeholder transcript)
  - Upload files (TXT/MD fully; PDF/DOC/DOCX placeholders in MVP)
- AI providers:
  - Echo (offline) – returns structured HTML from extracted text
  - OpenAI (requires API key) – simple HTML distillation
- Knowledge base table with status tracking: pending, extracting, distilling, completed, error, stopped
- Selection dock with bulk actions: View, Retry, Stop, Download (PDF ZIP), Delete
- Export/Import the whole vault as ZIP (preserves stored file blobs)
- Sort (queue/title/status/duration/created) and quick search + type filters
- Theme toggle (system/light/dark), ESC clears selection, toasts for actions

## Notes and limitations (MVP)

- URL extraction depends on site CORS; for blocked sites, use file upload instead.
- PDF/DOC/DOCX parsing uses placeholders; add real parsers in future milestones.
- YouTube/playlist extraction is placeholder (no transcript API yet).
- PDF export renders plaintext from distilled HTML for broad compatibility.

## Project structure

- `index.html` – loads everything (no build)
- `src/core/*` – event bus, toasts, IndexedDB, queue
- `src/ai/*` – provider wrappers and service
- `src/extractors/*` – URL/YouTube/file and router
- `src/App.jsx` – single-page React UI

## Roadmap (next)

- Add robust PDF (pdf.js) and DOCX (mammoth) extractors (still no build via ESM CDN)
- Add Anthropic, Gemini, Grok, DeepSeek, and Ollama providers
- YouTube transcript/grabbers (yt-dlp API alternative or oEmbed + subtitles where available)
- Richer content modal (metadata, word count), inline error inspector
- Drag-to-reorder queue and queue-aware sorting reset button
- Persisted UI prefs (visible columns, density)
- Accessibility polish, reduced-motion animations
