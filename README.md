# 🧠 Sawron – Your Local AI Knowledge Engine

> Consume more. Learn faster. Forget less.

**Sawron** is a fully local, private, and powerful Mac app designed to help you accelerate learning by turning long-form content (articles, videos, documents) into dense, high-signal summaries using local LLMs. It’s your offline knowledge powerhouse — always available, never spying, no subscriptions.

---

## ✨ Vision

In a world drowning in content, most of what we read or watch is forgotten.  
**Sawron** exists to flip that.

The vision is simple:  
> **“Extract the *maximum* value from any content you consume — in *minimum* time — while keeping full ownership of your data.”**

Sawron is not just a summarizer. It’s a personal, extendable *learning engine* designed to help you:
- Replace passive consumption with active absorption
- Focus only on the *core knowledge* that matters
- Store and retrieve key learnings for life

---

## 📌 What Makes Sawron Different?

- 🧠 **Dense summarization**, not surface-level fluff
- 🔐 **100% offline and private**, no data ever leaves your Mac
- 🧰 **Multi-input ingestion**: articles, YouTube videos, PDFs, Word docs, and more
- 🗃️ **Knowledge centralization**: store, search, and tag everything you’ve learned
- 🔁 **Continuous growth**: queue new content, and summarize it when you want

---

## ⚙️ Features

### 🚀 Core Features (MVP)
These are the essential pillars of Sawron:

- ✅ **Local LLM summarization**
  - Long, exhaustive, dense summaries with learning focus
- ✅ **URL ingestion**  
  - Scrape article content and summarize it
- ✅ **YouTube ingestion**  
  - Extract transcript (even auto-generated) and summarize
- ✅ **Text & Document file support**  
  - Accepts `.txt`, `.pdf`, `.doc`, `.docx`, etc.
- ✅ **Private, local-first architecture**  
  - No cloud, no subscriptions, no data leakage
- ✅ **Summary export & storage**  
  - Save summaries locally for future use
- ✅ **Simple, clean Mac-native interface**  
  - Drag & drop, paste link, or file-open interface
- ✅ **Offline-first setup**  
  - Everything works without internet access (after initial setup)

---

### 💡 Nice-to-Have Features (Next Phase)

These are ideas to explore as Sawron grows:

- 🗃️ **Local tagging + search**  
  - Organize summaries with tags, titles, and dates
- 🧩 **Comparison mode**  
  - Compare two articles/videos side-by-side and extract differences
- 🔁 **Learning queue**  
  - Add URLs/files to a “queue” for later summarization
- 🔍 **Embedded citations**  
  - Link back to source passages inside the summaries
- 🧠 **Auto-generated flashcards**  
  - Turn summaries into spaced repetition cards (Anki-style)
- 🔧 **In-app prompt tweaking**  
  - Customize how you want the summary written (e.g. “explain like I’m 5”)
- 📥 **Browser extensions**  
  - One-click “Send to Sawron” from Safari/Chrome
- 🌐 **Offline web crawler**  
  - Summarize entire blog series or documentation sites in bulk
- 🎯 **Focused extraction mode**  
  - Extract only certain types of info (e.g. pros/cons, steps, lessons, risks)
- 🗨️ **Conversational Q&A with past knowledge**  
  - Chat with your stored summaries using retrieval + local LLM

---

## 🧰 Tech Stack (initial)

| Layer | Tech |
|-------|------|
| 🧠 LLM Engine | [Ollama](https://ollama.com/) with LLaMA 3 8B or Mistral |
| 📄 Doc Parsing | `unstructured`, `PyMuPDF`, `python-docx`, `pdfplumber` |
| 🌐 Web Scraping | `trafilatura`, `newspaper3k`, or `readability-lxml` |
| 📺 YouTube | `yt-dlp` + `ffmpeg` for transcript |
| 🖥️ UI | SwiftUI or Tauri (Rust + JS/TS) |
| 💾 Storage | Local SQLite or flat JSON files |

---

## 📦 Project Status

Sawron is currently in early development.  
It’s designed for **personal use**, but built with production quality.

Coming next:
- ✅ Functional LLM summarizer over local files
- 🔜 Basic UI with drag-and-drop support
- 🔜 URL + YouTube input modes
- 🔜 Local saving of summary files

---

## 👨‍💻 Made by Ricardo Oriol

This project is a personal tool built to enhance learning efficiency for high-agency autodidacts.  
If you're building your own version of the future, you might want to fork it too.

---

