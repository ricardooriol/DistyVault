// LLM integration using Ollama
const { spawn } = require('child_process');

async function summarizeText(text) {
  return new Promise((resolve, reject) => {
    const prompt = `Analyze the following text and distill it to its core knowledge, removing all fluff and focusing only on the essential concepts. Your output should be a lesson, not a summary. Present the information with the following strict structure and style:\n\nStyle and Tone:\n\nDirect and Insightful: Begin immediately with the first key point. Do not use any introductory phrases like \"Here is the summary\" or other conversational filler.\n\nClear and Simple: Explain concepts using plain language. Avoid jargon, buzzwords, and overly complex terminology. The goal is to make complex ideas intuitive and accessible.\n\nConfident and Educational: Write as an expert distilling knowledge for a capable learner. Your goal is to ensure the core ideas are not just listed, but are fully understood and remembered.\n\nOutput Format:\nOrganize your entire response as a numbered list. Each point in the list must follow this two-part structure precisely:\n\nThe Core Idea Sentence.\nStart with a single, memorable sentence that captures one complete, fundamental idea from the text. This sentence should be comprehensive and stand on its own as a key takeaway.\n\nFollowing that sentence, write one or two detailed paragraphs to elaborate on this core idea. Deconstruct the concept, explain its implications, and provide the necessary context to eliminate any knowledge gaps. Use analogies or simple examples where they can aid understanding. The purpose of this section is to cement the idea, explaining not just what it is, but why it matters and how it works.\n\nThe Next Core Idea Sentence.\nThis follows the same pattern as the first point—a single, impactful sentence summarizing the next fundamental concept.\n\nAgain, follow up with one or two paragraphs of in-depth explanation. If the original text is missing crucial context, feel free to add it to ensure the concept is fully grasped. Connect this idea to previous points if it helps build a more cohesive mental model for the reader.\n\nContinue this pattern for as many points as are necessary to cover all the essential knowledge in the document. Do not summarize for the sake of brevity; distill for the sake of clarity and understanding.\n\nText to analyze:\n\n${text}`;
    console.log('[DEBUG] [Ollama] Starting summarization with prompt length:', prompt.length);
    const ollama = spawn('ollama', ['run', 'phi4-mini'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    let errorOutput = '';

    ollama.stdout.on('data', (data) => {
      output += data.toString();
    });
    ollama.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    ollama.on('close', (code) => {
      console.log('[DEBUG] [Ollama] Summarization process closed with code:', code, 'Output length:', output.length);
      if (errorOutput.trim()) {
        console.error('[Ollama error]:', errorOutput.trim());
      }
      resolve(output.trim());
    });
    ollama.on('error', (err) => {
      console.error('[Ollama error]:', err);
      reject(err);
    });
    ollama.stdin.write(prompt);
    ollama.stdin.end();
  });
}

module.exports = { summarizeText };
