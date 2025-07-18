// LLM integration using Ollama
const { spawn } = require('child_process');

async function summarizeText(text) {
  return new Promise((resolve, reject) => {
    const prompt = `Summarize the following text in a long, dense, and comprehensive way, extracting all key points and learnings.\n\n${text}`;
    const ollama = spawn('ollama', ['run', 'llama3', prompt]);
    let output = '';
    ollama.stdout.on('data', (data) => {
      output += data.toString();
    });
    ollama.stderr.on('data', (data) => {
      console.error('Ollama error:', data.toString());
    });
    ollama.on('close', () => {
      resolve(output.trim());
    });
    ollama.on('error', reject);
  });
}

module.exports = { summarizeText };
