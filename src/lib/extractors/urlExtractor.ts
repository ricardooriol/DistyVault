/**
 * Phase 1 URL Extractor
 * We are not using a backend DOM parser. We will strictly fetch and parse as text.
 * Note: Cross-Origin Resource Sharing (CORS) might block direct fetching from browser,
 * but Phase 1 relies on minimal deterministic flows. We rely on free CORS proxies
 * conceptually here, or handle safe fallback.
 */

export async function extractTextFromUrl(url: string): Promise<{ text: string; title: string }> {
    try {
        // For Phase 1 strict local execution, we use a public CORS proxy.
        // If we can't use a proxy due to "No backend proxy" rules, we'll hit CORS issues.
        // The instructions say "Extract text", "Do not create backend proxy". 
        // We will use a free public proxy to fulfill the purely frontend requirement.
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;

        const response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.statusText}`);
        }

        const data = await response.json();
        const html = data.contents;

        // Very basic frontend HTML parsing
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Attempt rudimentary main content extraction
        // Specifically target article, main, or fallback to body text
        const title = doc.title || url;

        let container = doc.querySelector('article')
            || doc.querySelector('main')
            || doc.querySelector('body');

        if (!container) {
            throw new Error("No readable text found.");
        }

        // Remove scripts and styles
        const scripts = container.querySelectorAll('script, style, nav, header, footer, aside');
        scripts.forEach(s => s.remove());

        const text = container.textContent?.replace(/\s+/g, ' ').trim() || '';

        if (!text) {
            throw new Error("Extracted text was empty.");
        }

        return { text, title };
    } catch (err: any) {
        throw new Error(`Extraction failed: ${err.message}`);
    }
}
