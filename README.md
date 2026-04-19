# DistyVault

**Live app:** https://distyvault.vercel.app/

DistyVault is a secure, local-first utility designed to extract and distill knowledge from dense content sources. It transforms long-form web pages, YouTube videos, and local documents into highly structured, insightful summaries using the AI provider of your choice.

Engineered for privacy and performance, DistyVault operates almost entirely within your browser. Content parsing, distillation processing, and data storage are handled locally on your device—ensuring your data remains strictly under your control.

## Project Intent

The primary objective of DistyVault is to separate signal from noise. In an era of informational overload—ranging from hour-long video essays to dense documentation—DistyVault acts as a specialized processing pipeline. By pointing it at a source, the application autonomously extracts the raw text, negotiates with modern LLMs to distill the core concepts, and returns a clean, uniform document comprised of structured points and critical takeaways.

## Core Capabilities

- **Universal Content Extraction**: Seamlessly pulls raw text from complex web articles, YouTube video transcripts, entire YouTube playlists, and local desktop files (including PDFs, DOCX, and images).
- **Advanced Routing & Proxying**: Features a sophisticated serverless proxy architecture that utilizes stealth headers and intelligent routing to successfully bypass strict CORS policies and anti-bot protections on modern platforms.
- **Concurrent Batch Processing**: Built with a robust background processing queue and strict concurrency limits. It safely handles multi-item extraction and distillation runs without exhausting API rate limits or hanging the browser.
- **Professional PDF Generation**: Generates beautifully formatted, print-ready PDF documents directly from the distilled results, customized with dedicated metadata, uniform typography, and professional pagination.

## Supported AI Providers

DistyVault employs a "Bring Your Own Key" (BYOK) model, enabling you to power the distillation engine securely using your preferred AI ecosystem. The platform stores your keys safely in your browser and seamlessly delegates requests to the selected provider's API.

Natively integrated providers include:

- **Google Gemini** (Gemini 3 Flash, Gemini 3 Pro)
- **OpenAI** (GPT-4o, GPT-5 Mini)
- **Anthropic Claude** (Claude Sonnet 4.5)
- **DeepSeek** (DeepSeek Chat)
- **xAI Grok** (Grok 4)

## Architecture & Privacy

DistyVault is a zero-build Single Page Application (SPA). It serves directly from static hosting and parses its modern frontend structure live in the browser, making it completely resilient and easy to deploy anywhere.

**Data Sovereignty:**
- API keys are stored exclusively in your browser's local database. They never touch DistyVault's servers.
- Distilled intelligence and extracted raw texts live permanently and solely on your device until you decide to export or delete them.
- A minimal serverless relay (`/api/fetch`) is entirely stateless and utilized strictly to securely fetch HTML sources when standard browser cross-origin requests are blocked.

## License

Copyright 2026. All rights reserved.
 
