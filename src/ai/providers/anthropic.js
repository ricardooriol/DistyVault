
(function(){
  const API_URL = 'https://api.anthropic.com/v1/messages';

  function buildPayload(settings){
    const prepared = settings?.__prepared || {};
    return {
      model: settings?.model || 'claude-3-7-sonnet-latest',
      system: prepared.messages?.[0]?.content || '',
      messages: [
        { role: 'user', content: [ { type: 'text', text: prepared.messages?.[1]?.content || prepared.prompt || 'Here is the text to distill.' } ] }
      ],
      temperature: 0.3
    };
  }

  async function distillAnthropic(extracted, settings){
    const apiKey = settings?.apiKey;
    if (!apiKey) throw new Error('Anthropic API key required');
    const payload = buildPayload(settings);
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try { const j = await res.json(); msg += ` - ${j.error?.message || ''}`; } catch {}
      throw new Error('Anthropic API error: ' + msg);
    }
    const data = await res.json();
    const text = (data.content?.[0]?.text) || '';
    const title = extracted.title || extracted.fileName || extracted.url || 'Distilled';
    return wrapHtml(text, title);
  }

  async function testAnthropic(settings){
    const apiKey = settings?.apiKey;
    if (!apiKey) throw new Error('Anthropic API key required');
    
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model: settings?.model || 'claude-3-7-sonnet-latest', messages: [ { role:'user', content:[{type:'text', text:'ping'}] } ] })
    });
    if (!res.ok) throw new Error('API key invalid or model not accessible');
    return true;
  }

  function wrapHtml(inner, title='Distilled') {
    return `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>body{font-family:Inter,system-ui,sans-serif;line-height:1.6;padding:20px;color:#0f172a}h1,h2,h3{margin:16px 0 8px}p{margin:10px 0;}pre{background:#f1f5f9;padding:12px;border-radius:8px;overflow:auto}</style></head><body>${inner}</body></html>`;
  }
  function escapeHtml(s='') { return s.replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  window.DV = window.DV || {};
  window.DV.aiProviders = window.DV.aiProviders || {};
  window.DV.aiProviders.anthropic = { distill: distillAnthropic, test: testAnthropic };
})();