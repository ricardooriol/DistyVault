# ollama_runner.py

import subprocess
import json

def run_ollama_prompt(prompt: str, model: str = "llama3") -> str:
    result = subprocess.run(
        ["ollama", "run", model],
        input=prompt.encode("utf-8"),
        capture_output=True
    )
    return result.stdout.decode("utf-8")