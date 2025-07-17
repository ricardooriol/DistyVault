# summarize.py

from backend.llm.ollama_runner import run_ollama_prompt
from backend.prompts import DENSE_SUMMARY_PROMPT

def summarize_text(raw_text: str) -> str:
    prompt = DENSE_SUMMARY_PROMPT.format(text=raw_text[:5000])  # Truncate if too long
    summary = run_ollama_prompt(prompt)
    return summary

if __name__ == "__main__":
    import sys
    with open(sys.argv[1], "r") as f:
        raw = f.read()
    result = summarize_text(raw)
    print(result)