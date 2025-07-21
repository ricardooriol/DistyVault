# SAWRON - Connect the Dots & Fill the Gaps

SAWRON is a local knowledge processing application that runs in your browser via localhost. It leverages a local LLM (Phi4-mini via Ollama) to provide extensive, dense summaries of various content types including web pages, YouTube videos, and document files.

## Features

- Process web pages, YouTube videos, and document files (PDF, DOCX, TXT)
- Generate comprehensive summaries using local LLM (Phi4-mini via Ollama)
- Store all summaries locally in a SQLite database
- View, search, and manage your knowledge base
- No external API calls - everything runs locally

## Requirements

- Node.js (v14+)
- Ollama with Phi4-mini model installed

## Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Make sure Ollama is installed and running with the Phi4-mini model:
   ```
   ollama pull phi4-mini
   ollama serve
   ```
4. Start the application:
   ```
   npm start
   ```
5. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Enter a URL or upload a file
2. Click "Summarize" to process the content
3. View your summaries in the Knowledge Base section
4. Search and filter your summaries as needed

## License

MIT