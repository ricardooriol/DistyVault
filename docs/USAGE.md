# Sawron Usage Guide

## Starting Sawron

1. Make sure Ollama is installed and running locally with the phi4-mini model:
   ```sh
   ollama pull phi4-mini
   ollama serve
   ```
2. In the project root, run:
   ```sh
   npm install
   npm run dev
   ```
3. Open your browser at http://localhost:5173

## Features
- Input URLs (websites, YouTube videos, playlists)
- Upload large PDFs, DOCX, TXT files
- Summarize and save all outputs locally
- View and search your knowledge base

## CLI Shortcut
To start Sawron, type:
```sh
sawron
```
(You can add a shell alias for convenience)

## All data stays local. Enjoy your private knowledge powerhouse!
