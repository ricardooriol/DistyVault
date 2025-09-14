(function(){
  const map = () => ({
    openai: DV.aiProviders.openai,
     gemini: DV.aiProviders.gemini,
    anthropic: DV.aiProviders.anthropic,
    deepseek: DV.aiProviders.deepseek,
    grok: DV.aiProviders.grok,
  });
  const providerDisplay = {
    openai: 'OpenAI',
    gemini: 'Google Gemini',
    anthropic: 'Anthropic Claude',
    deepseek: 'Deepseek',
    grok: 'Grok'
  };

  async function distill(extracted, aiSettings) {
    const key = (aiSettings?.mode);
    if (!key) throw new Error('No AI provider selected. Open Settings and choose a provider.');
    const provider = map()[key];
    if (!provider) throw new Error('AI provider not available: ' + key);
    
    const title = extracted.title || extracted.fileName || extracted.url || 'Untitled';
    const text = extracted.text?.slice(0, 12000) || '';
  const directive = `
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
- Format: "1. Main sentence here\nElaboration here\n\n2. Next main sentence here\nElaboration here"
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

The specific technical choices made here demonstrate the balance between speed and reliability. These decisions have cascading effects throughout the system and explain why certain limitations exist in the current design.`;
    const userContent = `Here is the text to distill:\n\nTitle: ${title}\nURL: ${extracted.url || ''}\n\nContent:\n${text}`;

    
    const prepared = {
      title,
      prompt: `${directive}\n\n${userContent}`,
      messages: [ { role: 'system', content: directive }, { role: 'user', content: userContent } ]
    };

    
    const settingsWithPrepared = { ...aiSettings, __prepared: prepared };
    const rawHtml = await provider.distill(extracted, settingsWithPrepared);
    
    const now = new Date();
    const meta = {
      title,
      sourceUrl: extracted.url || '',
      sourceName: extracted.fileName || extracted.url || title,
      dateText: (typeof dayjs === 'function' ? dayjs(now).format('DD/MM/YYYY HH:mm') : now.toLocaleString())
    };
    
    const formatted = reformatDistilled(rawHtml, meta);
    return formatted;
  }

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

  function escapeHtml(s='') {
    return s.replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }
})();