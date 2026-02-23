/**
 * Phase 2 YouTube Extractor
 * Strictly client-side leveraging public CORS proxies or iframe postMessage data to get transcripts.
 */

export async function extractYouTubeTranscript(url: string): Promise<{ text: string; title: string }> {
    try {
        // Fallback or scraping approach: YouTube transcript is usually baked into the ytInitialPlayerResponse.
        // We will fetch the page HTML through allorigins and parse it.
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch YouTube URL: ${response.statusText}`);
        }

        const data = await response.json();
        const html = data.contents;

        // Extract Title
        const titleMatch = html.match(/<title>(.*?) - YouTube<\/title>/)
            || html.match(/<title>(.*?)<\/title>/);
        const title = titleMatch ? titleMatch[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'") : 'YouTube Video';

        // Extract Transcript JSON from the HTML string
        // ytInitialPlayerResponse contains captions
        const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.*?\});/);

        let text = '';
        if (playerResponseMatch) {
            const playerResponse = JSON.parse(playerResponseMatch[1]);
            const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

            if (captionTracks && captionTracks.length > 0) {
                // Get the first track's URL (usually English or default)
                const transcriptUrl = captionTracks[0].baseUrl;

                // Fetch the actual XML transcript
                const transcriptProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(transcriptUrl)}`;
                const transcriptResponse = await fetch(transcriptProxyUrl);
                const transcriptXml = await transcriptResponse.text();

                // Parse the basic XML structure <text start="..." dur="...">word</text>
                const textNodes = (transcriptXml.match(/<text(.*?)>(.*?)<\/text>/g) || []);
                text = textNodes.map(node => {
                    const content = node.replace(/<text.*?>|<\/text>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
                    return content;
                }).join(' ').replace(/ +/g, ' ').trim();
            }
        }

        if (!text) {
            // Fallback: If no transcript, at least grab the description
            const descMatch = html.match(/"shortDescription":"(.*?)"/);
            if (descMatch) {
                // Decode unicode escapes
                text = "No transcript found. Description: " + descMatch[1].replace(/\\u[\dA-F]{4}/gi, (match: string) =>
                    String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16))
                ).replace(/\\n/g, ' ');
            } else {
                throw new Error("No transcript or description found for this video.");
            }
        }

        return { text, title };
    } catch (err: any) {
        throw new Error(`YouTube Extraction failed: ${err.message}`);
    }
}

/**
 * Extracts video URLs from a YouTube Playlist.
 */
export async function extractPlaylistVideos(playlistUrl: string): Promise<string[]> {
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(playlistUrl)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        const html = data.contents;

        // Find all /watch?v= in the playlist page
        // Very simplistic regex for Phase 2:
        const videoIdMatches = [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)];

        // Extract unique IDs
        const uniqueIds = Array.from(new Set(videoIdMatches.map(m => m[1])));

        if (uniqueIds.length === 0) {
            throw new Error("No videos found in this playlist.");
        }

        return uniqueIds.map(id => `https://www.youtube.com/watch?v=${id}`);
    } catch (err: any) {
        throw new Error(`Playlist Extraction failed: ${err.message}`);
    }
}
