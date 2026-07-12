(function () {
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

  async function distill(extracted, aiSettings) {
    const key = (aiSettings?.mode || '').toLowerCase();
    if (!key) throw new Error('No AI provider selected. Open Settings and choose a provider.');
    const provider = window.DV?.aiProviders?.[key];
    if (!provider) throw new Error('AI provider not available: ' + key);
    const title = extracted?.title || extracted?.fileName || extracted?.url || 'Untitled';
    const fullText = (extracted?.text || '').trim();
    if (!fullText) throw new Error('No text content available to distill.');

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
      7. COMPREHENSIVE LIST COVERAGE: If the source material lists lessons, rules, steps, chapters, or numbered points (e.g., "31 lessons"), you MUST extract and analyze EVERY SINGLE one of them individually. Do not skip, combine, or omit any item. Each lesson/point must be explicitly named, numbered, and detailed.
      
      OUTPUT RULES:
      - Do NOT worry about creating a beautiful final document. This is a massive raw brain dump for a subsequent editor.
      - Focus entirely on 100% retention of information, extreme depth, and sheer volume.
      - Output ONLY your raw analysis. No conversational filler or meta-commentary.
    `;

    const formatDirective = dedent`
      SYSTEM DIRECTIVE: You are an elite information architect and technical editor.
      Your task is to take an incredibly dense, exhaustive raw knowledge dump and format it into a beautifully structured, highly readable Markdown document.

      FORMATTING PROTOCOL:
      1. ELEGANT STRUCTURE: Organize the massive volume of knowledge logically using a clear hierarchy (e.g., # Main Title, ## Core Concepts, ### Nuances). Use bullet points, numbered lists, and bold text extensively to make the dense content scannable.
      2. ABSOLUTELY NO SUMMARIZATION OR REDACTION: You are strictly forbidden from summarizing, cutting, or shortening the content. You MUST retain 100% of the information, deep insights, critical nuances, and data points from the raw analysis. The final document should be extremely verbose and comprehensive.
      3. READABILITY: Break up massive walls of text. Use blockquotes for critical insights or key takeaways. Ensure the flow of information builds logically from fundamental to complex.
      4. COMPLETE ITEM RETENTION: You must preserve every single numbered item, rule, step, or lesson (e.g., all 31 lessons) present in the raw analysis. Do not group them into high-level categories if it means losing the individual numbered sections. Ensure the final document contains dedicated headings or bullet points for each point.
      
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

    let rawAnalysis = '';
    const cached = extracted?.id ? await DV.db.get('contents', extracted.id).catch(() => null) : null;
    if (cached && cached.rawAnalysis) {
      rawAnalysis = cached.rawAnalysis;
    } else {
      const chunks = chunkText(fullText);
      if (chunks.length === 1) {
        const content = `Here is the text to analyze:\n\nTitle: ${title}\nURL: ${extracted.url || ''}\n\nContent:\n${chunks[0]}`;
        const prepared = {
          title,
          prompt: `${analysisDirective}\n\n${content}`,
          messages: [{ role: 'system', content: analysisDirective }, { role: 'user', content: content }]
        };
        rawAnalysis = await provider.distill(extracted, { ...aiSettings, __prepared: prepared });
      } else {
        const analysisParts = [];
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const partNote = `[This is part ${i + 1} of ${chunks.length} of a longer document. Analyze this part thoroughly.]\n\n`;
          const content = `${partNote}Here is the text to analyze:\n\nTitle: ${title}\nURL: ${extracted.url || ''}\n\nContent:\n${chunk}`;
          const prepared = {
            title,
            prompt: `${analysisDirective}\n\n${content}`,
            messages: [{ role: 'system', content: analysisDirective }, { role: 'user', content: content }]
          };
          analysisParts.push(await provider.distill(extracted, { ...aiSettings, __prepared: prepared }));
        }
        rawAnalysis = analysisParts.map((part, i) => `--- Part ${i + 1} Analysis ---\n${part}`).join('\n\n');
      }

      if (extracted?.id) {
        await DV.db.put('contents', { id: extracted.id, rawExtracted: extracted, rawAnalysis }).catch(e => console.warn('Failed to cache analysis', e));
      }
    }

    let finalMarkdown = '';
    try {
      const formatContent = `Here is the raw analysis to format into a beautiful Markdown document:\n\n${rawAnalysis}`;
      const formatPrepared = {
        title,
        prompt: `${formatDirective}\n\n${formatContent}`,
        messages: [{ role: 'system', content: formatDirective }, { role: 'user', content: formatContent }]
      };
      finalMarkdown = await provider.distill(extracted, { ...aiSettings, __prepared: formatPrepared });
    } catch (err) {
      console.warn('Formatting pass failed, falling back to raw analysis:', err);
      finalMarkdown = rawAnalysis;
    }

    const tags = parseTags(finalMarkdown);
    const now = new Date();
    const meta = {
      title,
      sourceUrl: extracted.url || '',
      sourceName: extracted.fileName || extracted.url || title,
      dateText: (typeof dayjs === 'function' ? dayjs(now).format('DD/MM/YYYY HH:mm') : now.toLocaleString())
    };
    const formatted = reformatDistilled(finalMarkdown, meta);
    return { html: formatted, tags };
  }

  async function test(aiSettings) {
    const key = (aiSettings?.mode || '').toLowerCase();
    if (!key) throw new Error('No AI provider selected.');
    const provider = window.DV?.aiProviders?.[key];
    if (!provider) throw new Error('AI provider not available: ' + key);
    if (typeof provider.test === 'function') return await provider.test(aiSettings);
    await provider.distill({ title: 'Test', text: 'ping' }, aiSettings);
    return true;
  }

  function parseTags(text = '') {
    const fallback = String(text || '').match(/\*?\*?\btags?\b\*?\*?[\s:-]*(.+)$/mi);
    let raw = fallback ? fallback[1] : '';
    if (!raw) {
      const match = String(text || '').match(/<div[^>]*id=["']dv-tags["'][^>]*>(.*?)<\/div>/i);
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

  function reformatDistilled(markdown = '', meta) {
    try {
      if (!markdown) return standardWrapHtml('<p>No content available.</p>', meta);
      let cleanMd = String(markdown)
        .replace(/^```(markdown|md|html)\s*/i, '')
        .replace(/```\s*$/i, '')
        .replace(/\*?\*?\btags?\b\*?\*?[\s:-]*(.+)$/mi, '')
        .trim();
        
      const rawHtml = window.marked ? window.marked.parse(cleanMd) : '<p>' + escapeHtml(cleanMd).replace(/\n/g, '<br/>') + '</p>';
      const safeHtml = window.DOMPurify ? window.DOMPurify.sanitize(rawHtml) : rawHtml;
        
      return standardWrapHtml(safeHtml, meta);
    } catch (err) {
      console.error('Render error', err);
      return standardWrapHtml('<p>' + escapeHtml(String(markdown)) + '</p>', meta);
    }
  }

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

  function escapeHtml(s = '') {
    return String(s || '').replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
})();