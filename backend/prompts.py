# prompts.py

DENSE_SUMMARY_PROMPT = """
You are a brilliant technical explainer.

Your goal is to extract and reorganize **deep knowledge** from the provided text, then write a **dense, complete summary** that:

- Compresses the key ideas with clarity and structure
- Covers everything said, but removes repetition and fluff
- Fills in any missing logical gaps using your own knowledge
- Highlights concepts, processes, cause-effect, and structure
- Uses smart language, without overwhelming jargon

⚠️ The summary should **feel like high-level notes written by a domain expert for fast learning** — every sentence should teach something essential.

Use clear sections, bullet points or headers where helpful. Don't reference the original text, just deliver distilled insight.

TEXT:
{text}
"""