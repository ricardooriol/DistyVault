# DistyVault (MVP 0.2)

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
  - Upload files with local extraction (no backend):
    - TXT / MD
    - PDF (pdf.js text extraction + OCR fallback with Tesseract.js)
    - DOCX (Mammoth)
    - HTML/HTM (readable text from body/main/article)
    - Images (PNG/JPG/WebP/TIFF/BMP/GIF) via OCR
    - RTF (basic text fallback)
    - Note: legacy .doc is not supported; convert to PDF/DOCX
- AI providers:
  - Echo (offline) – returns structured HTML from extracted text
  - OpenAI (requires API key) – simple HTML distillation
- Knowledge base table with status tracking: pending, extracting, distilling, completed, error, stopped
- Selection dock with bulk actions: View, Retry, Stop, Download (PDF ZIP), Delete
- Export/Import the whole vault as ZIP (preserves stored file blobs)
- Sort (queue/title/status/duration/created) and quick search + type filters
- Theme toggle (system/light/dark), ESC clears selection, toasts for actions

## Notes and limitations

- URL extraction depends on site CORS; for blocked sites, use file upload instead.
- OCR uses Tesseract.js in the browser. First run downloads language data (eng by default) from the CDN; it can be heavy and takes time on large PDFs or images.
- PDF text extraction uses pdf.js and falls back to OCR when text content is sparse (e.g., scanned PDFs). For very large PDFs, OCR is truncated after ~30 pages.
- Legacy Word .doc is not supported client-side.
- YouTube/playlist extraction is placeholder (no transcript API yet).
 - YouTube transcript extraction uses captions when available (no Google API key needed). If a video has no captions, you'll see a notice. Playlists are not expanded yet.
- PDF export renders plaintext from distilled HTML for broad compatibility.

### Client-side libs used (loaded lazily on demand)
- pdf.js (3.x) – text extraction and page rendering
- Tesseract.js (4.x) – OCR for images and scanned PDFs
- Mammoth – DOCX to text

## Project structure

- `index.html` – loads everything (no build)
- `src/core/*` – event bus, toasts, IndexedDB, queue
- `src/ai/*` – provider wrappers and service
- `src/extractors/*` – URL/YouTube/file and router
- `src/App.jsx` – single-page React UI

## Roadmap (next)

- OCR language selection in settings and multi-language support
- Improved HTML readability with scoring and boilerplate removal
- Add Anthropic, Gemini, Grok, DeepSeek, and Ollama providers
- YouTube transcript/grabbers (yt-dlp API alternative or oEmbed + subtitles where available)
- Richer content modal (metadata, word count), inline error inspector
- Drag-to-reorder queue and queue-aware sorting reset button
- Persisted UI prefs (visible columns, density)
- Accessibility polish, reduced-motion animations
