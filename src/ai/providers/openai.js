(function(){
  const API_URL = 'https://api.openai.com/v1/chat/completions';

  /**
   * Submit a chat completion request to OpenAI using pre-constructed messages.
   *
   * Contract:
   * - Input `extracted`: used for default title only.
   * - Input `settings`: { apiKey: string, model?: string, __prepared?: { messages?: any[] } }
   * - Output: HTML string wrapping the LLM content returned.
   * - Errors: throws with a descriptive message on HTTP failure, including API error body when available.
   *
   * Notes:
   * - Temperature set conservatively (0.3) for deterministic distillation.
   */
  async function distillOpenAI(extracted, settings) {
    const { apiKey, model = 'gpt-4o-mini' } = settings || {};
    if (!apiKey) throw new Error('OpenAI API key required');

  const prepared = settings?.__prepared;
  const title = extracted.title || extracted.fileName || extracted.url || 'Untitled';

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: prepared?.messages || [],
        temperature: 0.3
      })
    });

    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try { const j = await res.json(); msg += ` - ${j.error?.message || ''}`; } catch {}
      throw new Error('OpenAI API error: ' + msg);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    return wrapHtml(content, title);
  }

  /**
   * Wrap the model response in a minimal HTML document for rendering.
   * @param {string} inner
   * @param {string} [title]
   * @returns {string}
   */
  function wrapHtml(inner, title='Distilled') {
    return `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>body{font-family:Inter,system-ui,sans-serif;line-height:1.6;padding:20px;color:#0f172a}h1,h2,h3{margin:16px 0 8px}p{margin:10px 0;}pre{background:#f1f5f9;padding:12px;border-radius:8px;overflow:auto}</style></head><body>${inner}</body></html>`;
  }

  /**
   * Minimal HTML escaping for safe interpolation.
   * @param {string} [s]
   * @returns {string}
   */
  function escapeHtml(s='') {
    return s.replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  window.DV = window.DV || {};
  window.DV.aiProviders = window.DV.aiProviders || {};
  /**
   * Lightweight credential/model accessibility check using the Models endpoint.
   * @param {{apiKey?:string}} settings
   * @returns {Promise<boolean>}
   */
  async function testOpenAI(settings){
    const { apiKey } = settings || {};
    if (!apiKey) throw new Error('OpenAI API key required');
    const res = await fetch('https://api.openai.com/v1/models', { headers: { 'Authorization': `Bearer ${apiKey}` } });
    if (!res.ok) throw new Error('API key invalid or model not accessible');
    return true;
  }
  window.DV.aiProviders.openai = { distill: distillOpenAI, test: testOpenAI };
})();