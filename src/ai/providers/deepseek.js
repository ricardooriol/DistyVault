// Deepseek provider
(function(){
  const API_URL = 'https://api.deepseek.com/chat/completions';

  async function distillDeepseek(extracted, settings){
    const apiKey = settings?.apiKey;
    const model = settings?.model || 'deepseek-chat';
    if (!apiKey) throw new Error('Deepseek API key required');
    const prepared = settings?.__prepared;
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: prepared?.messages || [], temperature: 0.3 })
    });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try { const j = await res.json(); msg += ` - ${j.error?.message || ''}`; } catch {}
      throw new Error('Deepseek API error: ' + msg);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const title = extracted.title || extracted.fileName || extracted.url || 'Distilled';
    return wrapHtml(content, title);
  }

  async function testDeepseek(settings){
    const { apiKey } = settings || {};
    if (!apiKey) throw new Error('Deepseek API key required');
    const res = await fetch('https://api.deepseek.com/models', { headers: { 'Authorization': `Bearer ${apiKey}` } });
    if (!res.ok) throw new Error('API key invalid or model not accessible');
    return true;
  }

  function wrapHtml(inner, title='Distilled') {
    return `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>body{font-family:Inter,system-ui,sans-serif;line-height:1.6;padding:20px;color:#0f172a}h1,h2,h3{margin:16px 0 8px}p{margin:10px 0;}pre{background:#f1f5f9;padding:12px;border-radius:8px;overflow:auto}</style></head><body>${inner}</body></html>`;
  }
  function escapeHtml(s='') { return s.replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  window.DV = window.DV || {};
  window.DV.aiProviders = window.DV.aiProviders || {};
  window.DV.aiProviders.deepseek = { distill: distillDeepseek, test: testDeepseek };
})();
