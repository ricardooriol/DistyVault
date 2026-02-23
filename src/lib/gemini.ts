import { GoogleGenerativeAI } from '@google/generative-ai';
import { useAppStore } from '../store/useAppStore';

const PROMPT_TEMPLATE = `
SYSTEM DIRECTIVE: DO NOT SUMMARIZE. YOUR OUTPUT MUST BE LONG AND COMPLETE.

1. ROLE
You are a detailed note-taker. Your job is to create a FULL, THOROUGH record of every idea in the provided text.
You must NOT condense, shorten, or skip content. Every point the source makes must appear in your output.

2. WHAT "LONG AND COMPLETE" MEANS
- If the source text has 10 ideas, you produce at least 10 numbered points.
- Each numbered point must have a bold headline AND at least 2-3 paragraphs of explanation.
- A short article should produce 8-15 points. A long article or video transcript should produce 20-50+ points.
- One-sentence bullet points are NOT acceptable. Each point needs full paragraphs.
- When in doubt, include more detail, not less. The user explicitly wants long output.

3. TONE AND STYLE
- Write in normal, plain English. Not overly academic, not overly casual.
- Explain concepts directly as facts. Do NOT write "The text says..." or "The author argues...".
- Keep every specific example, number, date, name, quote, and anecdote from the source.

4. PROCESS
Go through the text section by section. For each distinct idea or topic:
A. Write a bold headline sentence capturing the main point.
B. Write 2-3 paragraphs explaining the idea fully, including all supporting details, examples, and reasoning.
C. Move to the next idea. Do not combine multiple ideas into one point.

5. OUTPUT FORMAT
Start directly with **1.** — no introductions, no preambles.
Continue for ALL ideas in the source. Do not stop early. Do not cut corners.

6. IMPORTANT REMINDERS
- Your output should be MUCH LONGER than a typical summary.
- Never say "in summary", "briefly", "to conclude", or "overall".
- Cover the ENTIRE source from beginning to end.

### Content to Distill:
{TEXT}
`;

export async function processWithGemini(text: string): Promise<string> {
    const apiKey = useAppStore.getState().geminiApiKey;

    if (!apiKey || !apiKey.trim()) {
        throw new Error('Gemini API key is not configured. Please add it in Settings.');
    }

    // Phase 1: Hardcoded to gemini-2.5-pro as specified
    const genAI = new GoogleGenerativeAI(apiKey.trim());
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

    const prompt = PROMPT_TEMPLATE.replace('{TEXT}', text);

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const summary = response.text();

        if (!summary) {
            throw new Error('Gemini returned an empty response.');
        }

        return summary;
    } catch (err: any) {
        throw new Error(`Gemini API Error: ${err.message || 'Unknown failure'}`);
    }
}
