(function(){
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
  /** Human-friendly labels for provider selection UIs. */
  const providerDisplay = {
    openai: 'OpenAI',
    gemini: 'Google Gemini',
    anthropic: 'Anthropic Claude',
    deepseek: 'Deepseek',
    grok: 'Grok'
  };

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
    // Limit text size to control token usage and stay within provider payload limits
    const text = extracted.text?.slice(0, 12000) || '';
    // High-specificity system directive that enforces the output format for downstream parsing
    const directive = dedent`
      SYSTEM DIRECTIVE: MUST FOLLOW ALL RULES EXACTLY, DEVIATION IS STRICTLY NOT PERMITTED


      1. ROLE & GOAL (YOUR PURPOSE AND IDENTITY)
      You are a world-class research assistant and knowledge distiller
      Your paramount purpose is to produce high-quality, profoundly insightful content and teach core principles with unparalleled clarity and depth
      Your mission is to fully detail a topic, distill core knowledge, eliminate all fluff, and enrich text with profound research and insights


      2. CORE PROCESS (IMPORTANT AND CRUCIAL)
      When I provide a text to analyze, your task is to perform three critical steps:

      1. Knowledge Distillation (Deep Dive & Enrichment)
      Action: Meticulously distill essential knowledge from the provided text
      Goal: Go beyond summarizing. Identify core concepts, underlying principles, and critical information
      Process:
      - Eliminate all superficiality and extraneous details
      - Enrich by deconstructing complex ideas into simplest components
      - Ensure concepts are fully understood, deeply explained, and truly memorable
      - Prepare knowledge for comprehensive elaboration

      2. Expert Research (Comprehensive Gap Analysis & Augmentation)
      Action: Critically assess distilled knowledge for gaps, ambiguities, or areas needing more depth
      Goal: Identify and fill all knowledge gaps, ambiguities, and areas needing deeper context to ensure a complete and authoritative understanding
      Process:
      - Conduct a comprehensive, authoritative research process.
      - Use diverse, top-tier sources: peer-reviewed scientific journals, reputable academic publications, established news organizations, expert analyses
      - Synthesize most crucial, accurate, and up-to-date information
      - Augment and validate distilled knowledge for a complete, authoritative understanding

      3. Synthesis & Cohesion (Unified, Exhaustive Explanation)
      Action: Integrate all information (distillation + research) into one unified, cohesive, exhaustive speech
      Goal: Seamlessly weave together validated knowledge, presenting a holistic and deeply integrated understanding of the topic
      Process:
      - Seamlessly weave together all validated knowledge
      - Present a holistic and deeply integrated understanding of the topic


      3. CRUCIAL OUTPUT STYLE & TONE (NON-NEGOTIABLE AND BULLETPROOF)
      Tone: Direct, profoundly insightful, strictly neutral
      Precision: Be exceptionally precise, confident, and authoritative
      Uncertainty: Admit only if data is genuinely inconclusive or definitive sources are demonstrably unavailable
      Language: Absolutely avoid jargon, technical buzzwords, or colloquialisms
      Explanation: Explain all concepts with clarity and depth for a highly intelligent, curious learner to achieve profound and lasting understanding
      Primary Goal: Absolute, deep comprehension


      4. MANDATORY OUTPUT FORMAT (ABSOLUTE RULE: FOLLOW THIS STRUCTURE 100% OF THE TIME)

      START IMMEDIATELY: Begin your entire response directly with the first point of the numbered list
      NO CONVERSATIONAL INTROS: Absolutely NO conversational introductions, preambles, or any text outside this strict format: deviations are UNACCEPTABLE
      STRUCTURE: Present your response as an incremental numbered list

      EACH POINT'S STRUCTURE: Every point MUST follow this precise structure, presenting your entire response organizing the main body of your response as an incremental numbered list:
      1. Core idea sentence
      Start with a short, concise, single, memorable sentence that captures one complete, fundamental idea from your research. This sentence should be comprehensive and stand on its own as a key takeaway
      Following that sentence, write one or two detailed paragraphs to elaborate on this core idea. Deconstruct the concept, explain its nuances and implications, and provide necessary context to eliminate any knowledge gaps. Use analogies or simple examples where they can aid understanding. The purpose of this section is to cement the idea, explaining not just what it is, but why it matters and how it works based on your research

      2. Next single, short, concise, memorable, core idea sentence
      This follows the same pattern as the first point: a single, impactful sentence summarizing the next fundamental concept
      Follow up with one or two paragraphs of in-depth explanation, connecting this idea to previous points if it helps build a more cohesive mental model for the reader


      COVERAGE: Continue this rigorous pattern for as many points as are absolutely necessary to cover ALL essential knowledge on the topic with the required depth and detail. No point should be left unexplored or superficial.


      CRITICAL FORMATTING REQUIREMENTS (NON-NEGOTIABLE):
      - Format: "1. Main sentence here\\nElaboration here\\n\\n2. Next main sentence here\\nElaboration here"
      - Start with "1." (period and space, nothing else)
      - Continue sequentially: 1., 2., 3., 4., etc.
      - NEVER use: 1), (1), 1:, 1-, or any other format
      - NEVER repeat numbers (no multiple "1." entries)
      - NEVER skip numbers in sequence
      - Main sentence comes IMMEDIATELY after "1. " on the same line
      - Elaboration starts on the next line
      - Double line break between numbered points


      EXAMPLE OF PERFECT FORMAT:
      1. The core concept drives the entire system architecture

      This fundamental principle shapes how all components interact and determines the scalability limits of the platform. Understanding this relationship is crucial because it affects both performance optimization strategies and future development decisions.


      2. Implementation details reveal critical trade-offs

      The specific technical choices made here demonstrate the balance between speed and reliability. These decisions have cascading effects throughout the system and explain why certain limitations exist in the current design.
    `;
    // Separate system directive from user content to support providers that accept role-based messages
    const userContent = `Here is the text to distill:\n\nTitle: ${title}\nURL: ${extracted.url || ''}\n\nContent:\n${text}`;

    const prepared = {
      title,
      prompt: `${directive}\n\n${userContent}`,
      messages: [ { role: 'system', content: directive }, { role: 'user', content: userContent } ]
    };

    // Pass through prepared prompt/messages for providers that need a single prompt or a role-separated chat
    const settingsWithPrepared = { ...aiSettings, __prepared: prepared };
    const rawHtml = await provider.distill(extracted, settingsWithPrepared);
    const now = new Date();
    const meta = {
      title,
      sourceUrl: extracted.url || '',
      sourceName: extracted.fileName || extracted.url || title,
      // Prefer dayjs when present for deterministic formatting; fall back to locale string otherwise
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
  async function test(aiSettings){
    const key = (aiSettings?.mode);
    if (!key) throw new Error('No AI provider selected.');
    const provider = map()[key];
    if (!provider) throw new Error('AI provider not available: ' + key);
    if (typeof provider.test === 'function') return await provider.test(aiSettings);
    await provider.distill({ title: 'Test', text: 'ping' }, aiSettings);
    return true;
  }

  window.DV = window.DV || {};
  window.DV.ai = { distill, test };
  /**
   * Try to parse a strict numbered-list response and transform it into a structured
   * HTML document with consistent styling and metadata. Falls back to the original
   * provider HTML if parsing fails.
   * @param {string} html Raw provider HTML/string
   * @param {{title?:string, sourceUrl?:string, sourceName?:string, dateText?:string}} meta
   * @returns {string}
   */
  function reformatDistilled(html='', meta){
    try {
      const doc = new DOMParser().parseFromString(html || '', 'text/html');
      const rawText = (doc.body?.innerText || '').trim();
      const points = parseNumberedList(rawText);
      if (!points.length) return html;
      const body = points.map(pt => {
        const head = escapeHtml(`${pt.n}. ${pt.head}`);
        const paras = pt.body.split(/\n{2,}/).map(p => `<p>${escapeHtml(p.trim())}</p>`).join('');
        return `
<section class="dv-point" style="margin: 8px 0 20px 0;">
  <div class="dv-head" style="font-weight:700;">${head}</div>
  <div style="height: 10px;"></div>
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
  function parseNumberedList(text=''){
    const lines = text.replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ').split('\n');
    const pts = [];
    let current = null;
    for (let i=0;i<lines.length;i++){
      const line = lines[i].trim();
      const m = line.match(/^(\d+)\.\s+(.+)/);
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
  function standardWrapHtml(inner, meta){
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
<footer class="dv-footer">DistyVault · 2025</footer>
</body></html>`;
  }

  /**
   * Escape a string for safe inclusion in HTML text nodes or attributes.
   * @param {string} [s]
   * @returns {string}
   */
  function escapeHtml(s='') {
    return s.replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }
})();