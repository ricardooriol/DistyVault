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
    const key = (aiSettings?.mode || '').toLowerCase();
    if (!key) throw new Error('No AI provider selected. Open Settings and choose a provider.');
    const provider = window.DV?.aiProviders?.[key];
    if (!provider) throw new Error('AI provider not available: ' + key);
    const title = extracted.title || extracted.fileName || extracted.url || 'Untitled';
    const fullText = (extracted.text || '').trim();
    if (!fullText) throw new Error('No text content available to distill.');

    // Deep Analysis Directive (Pass 1)
    const analysisDirective = dedent`
      SYSTEM DIRECTIVE: You are an elite, world-class knowledge extractor and research analyst.
      Your singular objective is to perform a 100% EXHAUSTIVE, VERBOSE DEEP ANALYSIS of the provided source material.

      EXTRACTION PROTOCOL:
      1. ABSOLUTELY NO SUMMARIZATION: You are strictly forbidden from summarizing, condensing, or shortening the content. You must distill and extract EVERY SINGLE detail, nuance, example, core concept, argument, underlying mechanism, and actionable insight.
      2. MAXIMUM VERBOSITY: Your output should be extremely detailed. Expand on the extracted ideas to ensure 100% of the original meaning and depth is preserved.
      3. FULL CONTEXT: Strip away purely meaningless rhetorical filler, but keep every single piece of context, supporting evidence, anecdote, or data point that adds to the understanding.
      4. STRUCTURAL FIDELITY: Capture the exact logical flow and hierarchy of ideas in painstaking detail.
      5. GRANULARITY: Retain ALL exact numbers, ALL key terminology, ALL methodologies, and heavily quote critical passages.
      6. WEB SEARCH & GAP FILLING: If you possess web search capabilities, aggressively use them! Search for tricky concepts, obscure terminology, or logical gaps present in the source text. Integrate this external context to build a completely comprehensive picture.
      
      OUTPUT RULES:
      - Do NOT worry about creating a beautiful final document. This is a massive raw brain dump for a subsequent editor.
      - Focus entirely on 100% retention of information, extreme depth, and sheer volume.
      - Output ONLY your raw analysis. No conversational filler or meta-commentary.
    `;

    // Formatting Directive (Pass 2)
    const formatDirective = dedent`
      SYSTEM DIRECTIVE: You are an elite information architect and technical editor.
      Your task is to take an incredibly dense, exhaustive raw knowledge dump and format it into a beautifully structured, highly readable Markdown document.

      FORMATTING PROTOCOL:
      1. ELEGANT STRUCTURE: Organize the massive volume of knowledge logically using a clear hierarchy (e.g., # Main Title, ## Core Concepts, ### Nuances). Use bullet points, numbered lists, and bold text extensively to make the dense content scannable.
      2. ABSOLUTELY NO SUMMARIZATION OR REDACTION: You are strictly forbidden from summarizing, cutting, or shortening the content. You MUST retain 100% of the information, deep insights, critical nuances, and data points from the raw analysis. The final document should be extremely verbose and comprehensive.
      3. READABILITY: Break up massive walls of text. Use blockquotes for critical insights or key takeaways. Ensure the flow of information builds logically from fundamental to complex.
      
      OUTPUT CONSTRAINTS:
      - Use ONLY standard, elegant Markdown.
      - Do NOT use HTML tags. Do NOT wrap your response in markdown code blocks.
      - Output ONLY the formatted content. No conversational intro or outro.
      
      TAGS REQUIREMENT:
      At the very end of your response, you MUST append a section exactly like this (generate 3-6 highly relevant, specific tags):
      TAGS: tag1, tag2, tag3
    `;

    const CHUNK_SIZE = 100000;
    const CHUNK_OVERLAP = 500;

    /**
     * Split text at paragraph boundaries into chunks of roughly CHUNK_SIZE chars,
     * with CHUNK_OVERLAP overlap between adjacent chunks.
     */
    function chunkText(text) {
      if (!text) return [];
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
        const regionStart = Math.max(0, end - 300);
        const searchRegion = text.slice(regionStart, end + 300);
        const breakIdx = searchRegion.lastIndexOf('\n\n');
        if (breakIdx !== -1) {
          end = regionStart + breakIdx;
        }
        chunks.push(text.slice(start, end));
        start = Math.max(start + 1, end - CHUNK_OVERLAP);
      }
      return chunks;
    }

    async function distillSingle(text, partNote) {
      // Pass 1: Deep Analysis
      const analysisContent = `${partNote}Here is the text to analyze:\n\nTitle: ${title}\nURL: ${extracted.url || ''}\n\nContent:\n${text}`;
      const analysisPrepared = {
        title,
        prompt: `${analysisDirective}\n\n${analysisContent}`,
        messages: [{ role: 'system', content: analysisDirective }, { role: 'user', content: analysisContent }]
      };
      const rawAnalysis = await provider.distill(extracted, { ...aiSettings, __prepared: analysisPrepared });

      // Pass 2: Markdown Formatting
      try {
        const formatContent = `Here is the raw analysis to format into a beautiful Markdown document:\n\n${rawAnalysis}`;
        const formatPrepared = {
          title,
          prompt: `${formatDirective}\n\n${formatContent}`,
          messages: [{ role: 'system', content: formatDirective }, { role: 'user', content: formatContent }]
        };
        const finalMarkdown = await provider.distill(extracted, { ...aiSettings, __prepared: formatPrepared });
        return finalMarkdown;
      } catch (err) {
        console.warn('Formatting pass failed, falling back to raw analysis:', err);
        return rawAnalysis;
      }
    }

    let rawHtml;
    if (fullText.length <= CHUNK_SIZE) {
      // Short content: single-pass distillation (existing behavior)
      rawHtml = await distillSingle(fullText, '');
    } else {
      // Chunked distillation for long content processed in parallel
      const chunks = chunkText(fullText);
      const chunkResults = await Promise.all(chunks.map((chunk, i) => {
        const partNote = `[This is part ${i + 1} of ${chunks.length} of a longer document. Distill this part thoroughly.]\n\n`;
        return distillSingle(chunk, partNote);
      }));

      if (chunkResults.length === 1) {
        rawHtml = chunkResults[0];
      } else {
        // Synthesis pass: merge all chunk distillations
        const mergeDirective = dedent`
          SYSTEM DIRECTIVE: You are a world-class knowledge synthesizer and editor.
          You have been given multiple partial Markdown distillations of a massive document.
          Your task is to cleanly merge them into ONE cohesive, unified, beautifully structured Markdown document.
          Remove redundant overlaps between parts, but DO NOT lose any detailed insights.
          Output ONLY standard Markdown. No HTML tags. No markdown code blocks wrappers.
          
          TAGS SECTION:
          At the very end of your response, add a section exactly like this:
          TAGS: tag1, tag2, tag3
        `;
        const mergeContent = chunkResults.map((r, i) => `--- Part ${i + 1} ---\n${r}`).join('\n\n');
        const mergeUserContent = `Merge the following ${chunkResults.length} partial distillations of "${title}" into one unified Markdown document:\n\n${mergeContent}`;
        const mergePrepared = {
          title: title + ' (merged)',
          prompt: `${mergeDirective}\n\n${mergeUserContent}`,
          messages: [{ role: 'system', content: mergeDirective }, { role: 'user', content: mergeUserContent }]
        };
        const mergeSettings = { ...aiSettings, __prepared: mergePrepared };
        rawHtml = await provider.distill(extracted, mergeSettings);
      }
    }

    const tags = parseTags(rawHtml);
    const now = new Date();
    const meta = {
      title,
      sourceUrl: extracted.url || '',
      sourceName: extracted.fileName || extracted.url || title,
      dateText: (typeof dayjs === 'function' ? dayjs(now).format('DD/MM/YYYY HH:mm') : now.toLocaleString())
    };
    const formatted = reformatDistilled(rawHtml, meta);
    return { html: formatted, tags };
  }

  /**
   * Lightweight connectivity test for selected provider.
   * Uses provider-specific `test` if available; otherwise attempts a minimal `distill` call
   * to validate credentials and reachability.
   * @param {{mode:string, apiKey?:string, model?:string}} aiSettings
   * @returns {Promise<boolean>} true if the provider is reachable/authorized
   */
  async function test(aiSettings) {
    const key = (aiSettings?.mode || '').toLowerCase();
    if (!key) throw new Error('No AI provider selected.');
    const provider = window.DV?.aiProviders?.[key];
    if (!provider) throw new Error('AI provider not available: ' + key);
    if (typeof provider.test === 'function') return await provider.test(aiSettings);
    await provider.distill({ title: 'Test', text: 'ping' }, aiSettings);
    return true;
  }

  /**
   * Parse a comma-separated list of tags from a string starting with "TAGS:".
   * @param {string} text
   * @returns {string[]}
   */
  function parseTags(text = '') {
    const fallback = text.match(/\*?\*?\btags?\b\*?\*?[\s:-]*(.+)$/mi);
    let raw = fallback ? fallback[1] : '';
    if (!raw) {
      // Fallback to legacy hidden div parsing just in case
      const match = text.match(/<div[^>]*id=["']dv-tags["'][^>]*>(.*?)<\/div>/i);
      if (match) raw = match[1];
    }
    
    if (!raw) return [];
    
    raw = raw.replace(/<\/?[^>]+(>|$)/g, '').replace(/["'\[\]\{\}]/g, '').trim();
    return raw.split(/[,;|]/).map(s => {
      return s.trim().toLowerCase().replace(/[^a-z0-9#\s-]/g, '').trim();
    }).filter(s => s && s.length >= 2 && s.length < 30);
  }

  window.DV = window.DV || {};
  window.DV.ai = { distill, test };
  /**
   * Cleans the AI output of any wrappers/tag blocks and injects into standard template.
   * @param {string} html Raw provider HTML/string
   * @param {{title?:string, sourceUrl?:string, sourceName?:string, dateText?:string}} meta
   * @returns {string}
   */
  function reformatDistilled(markdown = '', meta) {
    try {
      // Strip out the tags line and any markdown codeblock wrappers the model might have added
      let cleanMd = markdown
        .replace(/^```(markdown|md|html)\s*/i, '')
        .replace(/```\s*$/i, '')
        .replace(/\*?\*?\btags?\b\*?\*?[\s:-]*(.+)$/mi, '')
        .trim();
        
      // Render to HTML securely
      const rawHtml = window.marked ? window.marked.parse(cleanMd) : '<p>' + escapeHtml(cleanMd).replace(/\n/g, '<br/>') + '</p>';
      const safeHtml = window.DOMPurify ? window.DOMPurify.sanitize(rawHtml) : rawHtml;
        
      return standardWrapHtml(safeHtml, meta);
    } catch (err) {
      console.error('Render error', err);
      return markdown;
    }
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
:root { color-scheme: light dark; }
html, body { height: 100%; margin: 0; padding: 0; }
body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  line-height: 1.75;
  padding: 32px 24px;
  color: #334155;
  background: #f8fafc;
  transition: background-color 0.2s, color 0.2s;
  max-width: 800px;
  margin: 0 auto;
}
.dark body { color: #e2e8f0; background: #0f172a; }

header { margin-bottom: 40px; }
h1 { font-size: 2.5rem; font-weight: 800; letter-spacing: -0.03em; margin: 0 0 16px; line-height: 1.2; color: #0f172a; }
.dark h1 { color: #f8fafc; }

.dv-meta { color: #64748b; font-size: 0.95rem; margin-top: 6px; display: flex; align-items: center; gap: 8px; }
.dark .dv-meta { color: #94a3b8; }

.dv-link { color: #6366f1; text-decoration: none; border-bottom: 1px solid rgba(99,102,241,0.3); transition: border-color 0.2s; }
.dv-link:hover { border-bottom-color: #6366f1; }
.dark .dv-link { color: #818cf8; border-bottom-color: rgba(129,140,248,0.3); }
.dark .dv-link:hover { border-bottom-color: #818cf8; }

hr { border: none; height: 1px; background: linear-gradient(to right, transparent, #cbd5e1, transparent); margin: 32px 0; }
.dark hr { background: linear-gradient(to right, transparent, #334155, transparent); }

main h1, main h2, main h3 { color: #0f172a; font-weight: 700; letter-spacing: -0.01em; margin: 32px 0 16px 0; }
.dark main h1, .dark main h2, .dark main h3 { color: #f1f5f9; }
main h1 { font-size: 1.8rem; }
main h2 { font-size: 1.5rem; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
.dark main h2 { border-bottom-color: #334155; }
main h3 { font-size: 1.25rem; }
main p { margin: 0 0 16px 0; }
main ul, main ol { margin: 0 0 16px 0; padding-left: 24px; }
main li { margin-bottom: 8px; }
main blockquote { border-left: 4px solid #cbd5e1; margin: 0 0 16px 0; padding: 4px 0 4px 16px; color: #475569; font-style: italic; }
.dark main blockquote { border-left-color: #475569; color: #94a3b8; }
main code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; font-family: monospace; }
.dark main code { background: #334155; }

footer.dv-footer { margin-top: 64px; padding-top: 32px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 0.85rem; text-align: center; font-weight: 500; }
.dark footer.dv-footer { border-top-color: #1e293b; color: #475569; }
</style></head><body>
<script>
  (function(){
    function updateTheme(isDark) { document.documentElement.classList.toggle('dark', isDark); }
    window.addEventListener('message', function(e) { if (e.data && e.data.type === 'dv-theme') updateTheme(e.data.isDark); });
    try { if (parent && parent.document && parent.document.documentElement.classList.contains('dark')) updateTheme(true); } catch(e){}
  })();
</script>
<header>
  <h1>${title}</h1>
  <div class="dv-meta"><strong>Source:</strong> ${srcLabel}</div>
  <div class="dv-meta"><strong>Date:</strong> ${dateText}</div>
</header>
<hr />
<main>${inner}</main>
<footer class="dv-footer">DistyVault · 2026</footer>
</body></html>`;
  }

  /**
   * Escape a string for safe inclusion in HTML text nodes or attributes.
   * @param {string} [s]
   * @returns {string}
   */
  function escapeHtml(s = '') {
    return s.replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
})();