# Sawron

## Project Vision
Sawron is a fully local, browser-based knowledge powerhouse designed to help you rapidly expand your understanding of any content. By leveraging local Large Language Models (LLMs), Sawron extracts dense, comprehensive summaries and key learnings from various sources, allowing you to retain all essential knowledge without reading entire documents. All data and processing remain on your computer—no subscriptions, no cloud, and complete privacy.

## Benefits
- **Privacy-first:** All data and processing are local; nothing leaves your machine.
- **No subscriptions:** Free from recurring costs and cloud dependencies.
- **Centralized knowledge:** Store, search, and revisit your learnings in one place.
- **Rapid knowledge expansion:** Skip the fluff, retain the core insights.
- **Flexible input:** Summarize content from URLs, YouTube, files, and more.

## Features

### Core Features
- **Local LLM Summarization:** Use a local LLM (Ollama) to generate long, dense summaries and extract key points from any text.
- **URL Scraping & Summarization:** Input a URL, scrape its text, and summarize the contents.
- **YouTube Video Summarization:** Input a YouTube video link, extract the transcript, and summarize.
- **YouTube Playlist Summarization:** Input a playlist, process each video, extract transcripts, and summarize.
- **File Summarization:** Upload TXT, PDF, or DOCX files and summarize their contents.
- **Centralized Knowledge Store:** Save and organize all summaries and learnings locally.

### Nice-to-Have Features
- **Search & Tagging:** Search your knowledge base and tag summaries for easy retrieval.
- **Highlight Extraction:** Automatically extract and highlight the most important sentences or concepts.
- **Multi-language Support:** Summarize content in multiple languages.
- **Browser Extension:** Quickly send content from your browser to Sawron for summarization.
- **Rich Media Support:** Summarize podcasts, audio files, or images (OCR).
- **Knowledge Graph:** Visualize relationships between learnings and topics.
- **Export/Import:** Export summaries to markdown, PDF, or other formats; import existing notes.
- **User Customization:** Adjust summarization density, style, and focus areas.

## Folder Structure
```
sawron/
├── backend/           # Node.js/Express API, Python scripts for scraping/parsing
│   ├── llm/           # Local LLM integration (Ollama)
│   ├── scraping/      # Web, YouTube, file parsing scripts
│   ├── storage/       # SQLite DB or local file storage
│   └── ...
├── frontend/          # React app (UI)
│   ├── components/    # UI components
│   ├── pages/         # Main pages/views
│   ├── assets/        # Images, icons, styles
│   └── ...
├── docs/              # Documentation, guides
├── README.md          # Project overview
└── package.json       # Project dependencies
```

## Step-by-Step Development Plan
1. **Project Setup**
   - Initialize backend (Node.js/Express) and frontend (React) folders.
   - Set up Ollama for local LLM inference.
2. **Core Backend Features**
   - Implement API endpoints for summarization, scraping, transcript extraction, and file parsing.
   - Integrate Python scripts for robust scraping and parsing.
   - Set up local storage (SQLite or files) for summaries.
3. **Core Frontend Features**
   - Build UI for inputting URLs, YouTube links, and files.
   - Display summaries and allow saving to knowledge base.
4. **LLM Integration**
   - Connect backend to Ollama for local summarization.
   - Tune prompt for dense, long-form summaries.
5. **Knowledge Store**
   - Implement storage, retrieval, and basic search/tagging.
6. **Testing & Iteration**
   - Test all core features end-to-end.
   - Refine UI/UX and backend logic.
7. **Nice-to-Have Features**
   - Add advanced search, tagging, highlight extraction, multi-language support, browser extension, etc.
8. **Documentation & Final Polish**
   - Write usage guides and developer docs.
   - Polish UI and UX for smooth experience.

---
Ready to start with the folder structure and scaffolding?
