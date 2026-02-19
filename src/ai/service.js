(function () {
  /**
   * Remove common leading indentation from template literals or strings while preserving
   * embedded expressions. Useful for embedding large multi-line system prompts in code
   * without carrying indentation noise into the final payload.
   *
   * Behavior:
   * - Unwraps escaped newlines (\\\n) inserted by tagged templates.
   * - Strips a single leading and trailing newline if present to allow neat code formatting.
   * - Computes the minimal indent across non-empty lines and removes it from all lines.
   * - Leaves relative indentation intact.
   *
   * @param {TemplateStringsArray|string} strings Raw template strings or string input
   * @param {...any} values Interpolated values for template literals
   * @returns {string} De-indented string
   */
  function dedent(strings, ...values) {
    const raw = typeof strings === 'string' ? [strings] : strings.raw || strings;
    let result = '';
    for (let i = 0; i < raw.length; i++) {
      result += raw[i].replace(/\\\n/g, '\n');
      if (i < values.length) result += values[i];
    }
    result = result.replace(/^\n/, '').replace(/\n$/, '');
    const lines = result.split('\n');
    let min = Infinity;
    for (const l of lines) {
      if (!l.trim()) continue;
      const m = l.match(/^\s*/)[0].length;
      if (m < min) min = m;
    }
    if (!isFinite(min)) return result;
    return lines.map(l => l.slice(Math.min(min, l.length))).join('\n');
  }

  /**
   * Map of provider keys to their respective client objects exposed on the global `DV`.
   * Indirection allows lazy binding to providers loaded on the page and isolates lookups
   * in a single place.
   * @returns {{[key:string]: { distill: Function, test?: Function }}}
   */
  const map = () => ({
    openai: DV.aiProviders.openai,
    gemini: DV.aiProviders.gemini,
    anthropic: DV.aiProviders.anthropic,
    deepseek: DV.aiProviders.deepseek,
    grok: DV.aiProviders.grok,
  });

  /**
   * Orchestrate AI-based distillation for extracted content using the selected provider.
   * Prepares a rigorous system directive and user content, then delegates to the provider
   * `distill` method. The provider returns HTML which is post-processed into a standardized
   * document format for consistent display.
   *
   * Contract:
   * - Input `extracted`: { title?, fileName?, url?, text? }.
   * - Input `aiSettings`: { mode: 'openai'|'gemini'|'anthropic'|'deepseek'|'grok', apiKey?, model? }.
   * - Output: HTML string with standardized wrapper and formatting.
   * - Throws: when provider missing/unavailable or the downstream provider rejects.
   *
   * Notes:
   * - Truncates input text to ~12,000 chars to avoid request size limits.
   * - Injects `__prepared` into settings for providers to reuse the exact prompt/messages.
   * - If a global `dayjs` exists, it is used for consistent date formatting.
   *
   * @param {{title?:string, fileName?:string, url?:string, text?:string}} extracted
   * @param {{mode:string, apiKey?:string, model?:string, [k:string]:any}} aiSettings
   * @returns {Promise<string>} Standardized HTML document containing the distilled content
   */
  async function distill(extracted, aiSettings) {
    const key = (aiSettings?.mode);
    if (!key) throw new Error('No AI provider selected. Open Settings and choose a provider.');
    const provider = map()[key];
    if (!provider) throw new Error('AI provider not available: ' + key);
    const title = extracted.title || extracted.fileName || extracted.url || 'Untitled';
    const fullText = extracted.text || '';

    // High-specificity system directive that enforces the output format for downstream parsing
    const directive = dedent`
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
        Instead, just state the idea: "Habit formation works by..." not "The text explains that habit formation works by..."
      - Keep every specific example, number, date, name, quote, and anecdote from the source.

      4. PROCESS
      Go through the text section by section. For each distinct idea or topic:
      A. Write a bold headline sentence capturing the main point.
      B. Write 2-3 paragraphs explaining the idea fully, including all supporting details, examples, and reasoning.
      C. Move to the next idea. Do not combine multiple ideas into one point.

      5. OUTPUT FORMAT
      Start directly with **1.** — no introductions, no preambles.

      **1. Bold headline sentence here**
      First paragraph explaining the concept fully with all relevant details.
      Second paragraph with specific examples, data, or evidence mentioned in the source.

      **2. Next bold headline sentence**
      Paragraphs of explanation...

      Continue for ALL ideas in the source. Do not stop early. Do not cut corners.

      6. IMPORTANT REMINDERS
      - Your output should be MUCH LONGER than a typical summary. Aim for thousands of words.
      - Never say "in summary", "briefly", "to conclude", or "overall". Just keep going through all the material.
      - If you catch yourself writing short bullet points, stop and expand them into full paragraphs.
      - Cover the ENTIRE source from beginning to end. Do not stop halfway.
    `;

    // Reduced chunk size to force more granular processing.
    // Smaller chunks = more chunks = more total detail generated.
    const CHUNK_SIZE = 6000;
    const CHUNK_OVERLAP = 500;

    /**
     * Split text at paragraph boundaries into chunks of roughly CHUNK_SIZE chars,
     * with CHUNK_OVERLAP overlap between adjacent chunks.
     */
    function chunkText(text) {
      if (text.length <= CHUNK_SIZE) return [text];
      const chunks = [];
      let start = 0;
      while (start < text.length) {
        let end = start + CHUNK_SIZE;
        if (end >= text.length) {
          chunks.push(text.slice(start));
          break;
        }
        // Find paragraph break near the boundary
        const searchRegion = text.slice(end - 300, end + 300);
        const breakIdx = searchRegion.lastIndexOf('\n\n');
        if (breakIdx !== -1) {
          end = end - 300 + breakIdx;
        }
        chunks.push(text.slice(start, end));
        start = Math.max(start + 1, end - CHUNK_OVERLAP);
      }
      return chunks;
    }

    async function distillSingle(text, partNote) {
      if (aiSettings.signal?.aborted) throw new Error('Aborted');

      const userContent = `${partNote}Here is the text to distill. Remember: be THOROUGH and LONG. Cover every single point.\n\nTitle: ${title}\nURL: ${extracted.url || ''}\n\nContent:\n${text}`;
      const prepared = {
        title,
        prompt: `${directive}\n\n${userContent}`,
        messages: [{ role: 'system', content: directive }, { role: 'user', content: userContent }]
      };
      // Pass the settings INCLUDING the signal down to the provider
      const settingsWithPrepared = { ...aiSettings, __prepared: prepared };
      return await retryWithBackoff(() => provider.distill(extracted, settingsWithPrepared), 3, aiSettings.signal);
    }

    let rawHtml;
    // ... existing logic ...

    // For chunked content loop:
    if (fullText.length > CHUNK_SIZE) {
      const chunks = chunkText(fullText);
      const chunkResults = [];
      for (let i = 0; i < chunks.length; i++) {
        if (aiSettings.signal?.aborted) throw new Error('Aborted');
        // ...
        const partNote = `[This is part ${i + 1} of ${chunks.length} of a longer document. Distill THIS PART fully and in detail — do not shorten or summarize. Produce as many numbered points as this section warrants.]\n\n`;
        const result = await distillSingle(chunks[i], partNote);
        chunkResults.push(result);
      }
      // ... join ...
      if (chunkResults.length === 1) {
        rawHtml = chunkResults[0];
      } else {
        rawHtml = chunkResults.join('\n\n');
      }
    } else {
      rawHtml = await distillSingle(fullText, '');
    }

    const now = new Date();
    // ... rest of function ...
    const meta = {
      // ...
      title,
      sourceUrl: extracted.url || '',
      sourceName: extracted.fileName || extracted.url || title,
      dateText: (typeof dayjs === 'function' ? dayjs(now).format('DD/MM/YYYY HH:mm') : now.toLocaleString())
    };
    const formatted = reformatDistilled(rawHtml, meta);
    return formatted;
  }

  /**
   * Lightweight connectivity test for selected provider.
   * Uses provider-specific `test` if available; otherwise attempts a minimal `distill` call
   * to validate credentials and reachability.
   * @param {{mode:string, apiKey?:string, model?:string}} aiSettings
   * @returns {Promise<boolean>} true if the provider is reachable/authorized
   */
  async function test(aiSettings) {
    const key = (aiSettings?.mode);
    if (!key) throw new Error('No AI provider selected.');
    const provider = map()[key];
    if (!provider) throw new Error('AI provider not available: ' + key);
    if (typeof provider.test === 'function') return await provider.test(aiSettings);
    await provider.distill({ title: 'Test', text: 'ping' }, aiSettings);
    return true;
  }

  /**
   * Generate ~5 short topic tags from distilled content using a lightweight AI call.
   * @param {string} title - Item title
   * @param {string} text - Distilled text (plain or HTML)
   * @param {{mode:string, apiKey?:string, model?:string}} aiSettings
   * @returns {Promise<string[]>} Array of lowercase tag strings
   */
  async function generateTags(title, text, aiSettings) {
    const key = aiSettings?.mode;
    if (!key) return [];
    const provider = map()[key];
    if (!provider) return [];

    // Extract plain text from HTML if needed
    let plain = text || '';
    if (plain.includes('<')) {
      try {
        const doc = new DOMParser().parseFromString(plain, 'text/html');
        doc.querySelectorAll('script, style, link, meta').forEach(n => n.remove());
        plain = (doc.body?.innerText || doc.body?.textContent || '').trim();
      } catch { }
    }

    // Use only first 2000 chars to keep it fast and cheap
    const snippet = plain.slice(0, 2000);

    const tagDirective = dedent`
      You are a content tagger. Given a title and content snippet, return EXACTLY 5 short lowercase topic tags.
      Rules:
      - Tags must be 1-2 words each, lowercase, no special characters
      - Tags should be broad topics (e.g. "machine-learning", "economics", "psychology", "web-dev", "history")
      - Do NOT include the source platform as a tag (no "youtube", "substack", "medium", etc.)
      - Return ONLY a comma-separated list, nothing else
      - Example output: ai, neuroscience, attention, productivity, deep-work
    `;

    const userContent = `Title: ${title}\n\nContent:\n${snippet}`;
    const prepared = {
      title: 'Tag generation',
      prompt: `${tagDirective}\n\n${userContent}`,
      messages: [{ role: 'system', content: tagDirective }, { role: 'user', content: userContent }]
    };
    const settingsWithPrepared = { ...aiSettings, __prepared: prepared };

    try {
      const raw = await retryWithBackoff(() => provider.distill({ title, text: snippet }, settingsWithPrepared), 1);
      // Parse comma-separated response
      const cleaned = (raw || '')
        .replace(/<[^>]*>/g, '')  // strip HTML
        .replace(/\n/g, ',')
        .replace(/\d+\.\s*/g, '') // strip numbering
        .trim();
      const blacklist = new Set(['html', 'head', 'body', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'img', 'a', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'form', 'input', 'button', 'script', 'style', 'meta', 'link', 'title', 'strong', 'em', 'b', 'i']);
      const tags = cleaned.split(',')
        .map(t => t.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-'))
        .filter(t => t.length >= 2 && t.length <= 30 && !blacklist.has(t))
        // Strip tags that look like CSS leakage (font-family, body, etc.)
        .filter(t => !/font|family|inter|arial|helvetica|serif|sans|body|margin|padding|color|display|width|height|border|background|opacity|overflow|position|text-align/.test(t))
        .slice(0, 5);
      return tags.length >= 2 ? tags : [];
    } catch {
      return [];
    }
  }

  window.DV = window.DV || {};
  window.DV.ai = { distill, test, generateTags };
  /**
   * Try to parse a strict numbered-list response and transform it into a structured
   * HTML document with consistent styling and metadata. Falls back to the original
   * provider HTML if parsing fails.
   * @param {string} html Raw provider HTML/string
   * @param {{title?:string, sourceUrl?:string, sourceName?:string, dateText?:string}} meta
   * @returns {string}
   */
  function reformatDistilled(html = '', meta) {
    try {
      // Pre-sanitize the raw HTML before parsing
      const sanitized = sanitizeDistilledHtml(html);
      const doc = new DOMParser().parseFromString(sanitized || '', 'text/html');
      const rawText = (doc.body?.innerText || '').trim();
      let points = parseNumberedList(rawText);
      // Fallback: if no numbered list found, try splitting on double-newlines
      if (!points.length) {
        points = fallbackParagraphParse(rawText);
      }
      if (!points.length) return sanitized;
      const body = points.map((pt, idx) => {
        // Strip markdown bold markers from the heading text (handling start/end)
        let cleanHead = pt.head.trim().replace(/^\*\*/, '').replace(/\*\*$/, '');
        // Force sequential numbering (1..N) regardless of what the AI output said
        const head = escapeHtml(`${idx + 1}. ${cleanHead}`);
        const bodyText = stripBoldFromText(pt.body);
        const paras = bodyText.split(/\n{2,}/).map(p => `<p style="font-weight:400;">${escapeHtml(p.trim())}</p>`).join('');
        // Removed the 10px spacer div to create a "small space" (just the p margin)
        // Kept section margins to ensure "larger space" between points
        return `
<section class="dv-point" style="margin: 8px 0 20px 0;">
  <div class="dv-head" style="font-weight:700;">${head}</div>
  <div class="dv-body" style="font-weight:400;">${paras}</div>
</section>`;
      }).join('\n\n');
      return standardWrapHtml(body, meta);
    } catch {
      return html;
    }
  }

  /**
   * Parse a strict 1., 2., ... numbered list from plain text into a structured array.
   * Lines that do not start a new point are appended to the current point's body.
   * @param {string} [text]
   * @returns {Array<{n:number, head:string, body:string}>}
   */
  function parseNumberedList(text = '') {
    const lines = text.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').split('\n');
    const pts = [];
    let current = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const m = line.match(/^(?:\*\*)?(\d+)\.\s+(.+)/);
      if (m) {
        if (current) pts.push(current);
        current = { n: Number(m[1]), head: m[2].trim(), body: '' };
      } else if (current) {
        current.body += (current.body ? '\n' : '') + line;
      }
    }
    if (current) pts.push(current);
    return pts;
  }

  /**
   * Wrap the distilled inner HTML with a minimal, self-contained page shell and metadata.
   * Provides light/dark support via parent document class probing.
   * @param {string} inner
   * @param {{title?:string, sourceUrl?:string, sourceName?:string, dateText?:string}} meta
   * @returns {string}
   */
  function standardWrapHtml(inner, meta) {
    const title = escapeHtml(meta?.title || 'Distilled');
    const srcLabel = meta?.sourceUrl ? `<a href="${escapeHtml(meta.sourceUrl)}" target="_blank" rel="noopener" class="dv-link">${escapeHtml(meta.sourceUrl)}</a>` : `<span>${escapeHtml(meta?.sourceName || '')}</span>`;
    const dateText = escapeHtml(meta?.dateText || '');
    return `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title><style>
:root{color-scheme: light dark}
html,body{height:100%}
body{font-family:Inter,system-ui,sans-serif;line-height:1.65;padding:20px;color:#0f172a;background:#ffffff}
.dark body{color:#f1f5f9;background:#0f172a}
h1,h2,h3{margin:12px 0 4px}
p{margin:10px 0}
.dv-head{font-size:1rem}
.dv-body p{margin:10px 0}
.dv-meta{color:#334155}
.dark .dv-meta{color:#94a3b8}
.dv-link{color:#2563eb;text-decoration:underline}
.dark .dv-link{color:#93c5fd}
hr{border:none;border-top:1px solid #e2e8f0}
.dark hr{border-top-color:#334155}
footer.dv-footer{position:fixed;left:20px;bottom:10px;color:#64748b}
.dark footer.dv-footer{color:#94a3b8}
</style></head><body>
<script>(function(){try{var d=document.documentElement;var p=parent&&parent.document&&parent.documentElement;if(p&&p.classList.contains('dark')){d.classList.add('dark');}}catch(e){}})();</script>
<header>
  <h1>${title}</h1>
  <div class="dv-meta"><strong>Source:</strong> ${srcLabel}</div>
  <div class="dv-meta"><strong>Date:</strong> ${dateText}</div>
</header>
<hr />
${inner}
<hr />
<footer class="dv-footer">DistyVault · ${new Date().getFullYear()}</footer>
</body></html>`;
  }

  /** Use shared escapeHtml from DV.utils. */
  const escapeHtml = DV.utils.escapeHtml;

  /**
   * Retry a function up to maxRetries times with exponential backoff
   * for transient errors (429, 5xx). Non-retryable errors throw immediately.
   * @param {() => Promise<any>} fn
   * @param {number} [maxRetries=3]
   * @param {AbortSignal} [signal]
   * @returns {Promise<any>}
   */
  async function retryWithBackoff(fn, maxRetries = 10, signal) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (signal?.aborted) throw new Error('Aborted');
      try {
        return await fn();
      } catch (err) {
        if (signal?.aborted) throw new Error('Aborted');
        const msg = String(err?.message || err);
        // Retry if it's explicitly marked as retryable OR matches common network/server error patterns
        const isRetryable = msg.includes('RetryableError') ||
          /\b(429|500|502|503|504)\b/.test(msg) ||
          /rate.?limit|too many requests|overloaded|network|fetch/i.test(msg);

        if (!isRetryable || attempt >= maxRetries) throw err;

        // Exponential backoff: 1s, 2s, 4s, 8s... capped at 15s
        const delay = Math.min(Math.pow(2, attempt) * 1000, 15000) + (Math.random() * 500);
        console.warn(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed: ${msg}. Retrying in ${Math.round(delay)}ms...`);

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, delay);
          if (signal) signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new Error('Aborted'));
          });
        });
      }
    }
  }

  /**
   * Sanitize raw AI HTML output to fix common formatting issues.
   * Strips wrapping bold/strong tags, removes excessive markdown bold markers,
   * and normalizes font weights.
   * @param {string} html
   * @returns {string}
   */
  function sanitizeDistilledHtml(html = '') {
    let s = html;
    // Remove wrapping <strong>/<b> that envelop the entire content
    s = s.replace(/^\s*<(strong|b)>\s*/i, '').replace(/\s*<\/(strong|b)>\s*$/i, '');
    // Remove markdown ** bold that wraps entire paragraphs
    s = s.replace(/\*\*([^*]{100,})\*\*/g, '$1');
    // Strip <strong>/<b> tags from body paragraphs (preserve content)
    s = s.replace(/<(strong|b)>((?:(?!<\/\1>).)*)<\/\1>/gi, (match, tag, content) => {
      // Keep short bold text (likely intentional emphasis), strip long bold blocks
      return content.length > 80 ? content : match;
    });
    return s;
  }

  /**
   * Strip bold/strong markers from plain text.
   * @param {string} text
   * @returns {string}
   */
  function stripBoldFromText(text = '') {
    // Check bold ratio: if > 50% of text is wrapped in bold, strip all
    const boldMatches = text.match(/\*\*[^*]+\*\*/g) || [];
    const boldLen = boldMatches.reduce((sum, m) => sum + m.length, 0);
    if (boldLen > text.length * 0.5) {
      return text.replace(/\*\*/g, '');
    }
    return text;
  }

  /**
   * Fallback parser: split text into paragraphs and create pseudo-numbered points.
   * Used when the AI ignores the numbered-list format entirely.
   * @param {string} text
   * @returns {Array<{n:number, head:string, body:string}>}
   */
  function fallbackParagraphParse(text = '') {
    if (!text || text.length < 50) return [];
    const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 20);
    if (paragraphs.length < 2) return [];
    return paragraphs.map((p, i) => {
      // Use first sentence as heading, rest as body
      const sentenceEnd = p.search(/[.!?]\s/) + 1;
      const head = sentenceEnd > 10 ? p.slice(0, sentenceEnd).trim() : p.slice(0, 80).trim();
      const body = sentenceEnd > 10 ? p.slice(sentenceEnd).trim() : '';
      return { n: i + 1, head, body };
    });
  }
})();