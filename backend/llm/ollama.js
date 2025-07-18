// LLM integration using Ollama
const { spawn } = require('child_process');

async function summarizeText(text) {
  return new Promise((resolve, reject) => {
    const prompt = `Summarize the following text in a long, dense, and comprehensive way, extracting all key points and learnings.\n\n${text}`;
    console.log('[DEBUG] [Ollama] Starting summarization with prompt length:', prompt.length);
    const ollama = spawn('ollama', ['run', 'llama3'], { stdio: ['pipe', 'pipe', 'pipe'] });
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
