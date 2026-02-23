import { db } from './db';
import { extractTextFromUrl } from './extractors/urlExtractor';
import { extractYouTubeTranscript, extractPlaylistVideos } from './extractors/youtubeExtractor';
import { extractTextFromFile } from './extractors/fileExtractor';
import { processWithGemini } from './gemini';
import type { Item, ItemType } from '../types/item';

interface ProcessArgs {
    url?: string;
    file?: File;
}

/**
 * Core Processing Pipeline (Sequential)
 */
export async function processItemProcess(args: ProcessArgs) {
    if (args.url && isYouTubePlaylist(args.url)) {
        // Handle Playlist Expansion
        try {
            const videoUrls = await extractPlaylistVideos(args.url);
            // Queue them sequentially
            for (const vUrl of videoUrls) {
                // We fire and forget each one, but they enter the DB sequentially
                // Wait just a tiny bit to ensure order
                await new Promise(r => setTimeout(r, 100));
                processSingleItem({ url: vUrl });
            }
        } catch (err: any) {
            console.error("Playlist Expansion failed:", err);
            // Could add an explicit error item here if wanted, but generally we just log playlist errors
        }
    } else {
        await processSingleItem(args);
    }
}

async function processSingleItem(args: ProcessArgs) {
    const id = crypto.randomUUID();

    let isFile = !!args.file;
    let isYoutube = !isFile && args.url ? isYouTubeVideo(args.url) : false;

    let type: ItemType = isFile ? 'file' : isYoutube ? 'youtube' : 'url';
    let source = args.file ? args.file.name : (args.url || 'Unknown Source');

    // 1. Create item with status `extracting`
    const newItem: Item = {
        id,
        type,
        source,
        title: 'Extracting...',
        status: 'extracting',
        createdAt: Date.now(),
        rawText: '',
        summary: ''
    };

    await db.items.add(newItem);

    try {
        let text = '';
        let title = '';

        // 2. Extract text based on routing
        if (isFile && args.file) {
            const res = await extractTextFromFile(args.file);
            text = res.text;
            title = res.title;
        } else if (isYoutube && args.url) {
            const res = await extractYouTubeTranscript(args.url);
            text = res.text;
            title = res.title;
        } else if (args.url) {
            const res = await extractTextFromUrl(args.url);
            text = res.text;
            title = res.title;
        } else {
            throw new Error("No valid input provided.");
        }

        // 3. Update status to `processing`
        await db.items.update(id, {
            title,
            rawText: text,
            status: 'processing'
        });

        // 4. Send to Gemini
        const summary = await processWithGemini(text);

        // 5 & 6. Store summary & Update status to `done`
        await db.items.update(id, {
            summary,
            status: 'done'
        });

    } catch (err: any) {
        // 7. If failure -> `error`
        await db.items.update(id, {
            status: 'error',
            error: err.message || 'An unknown error occurred'
        });
    }
}

function isYouTubePlaylist(url: string) {
    return url.includes('youtube.com/playlist') || (url.includes('youtube.com/watch') && url.includes('&list='));
}

function isYouTubeVideo(url: string) {
    return url.includes('youtube.com/watch') || url.includes('youtu.be/');
}
