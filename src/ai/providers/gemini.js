(function(){
  function endpoint(model){
    const m = (model || 'gemini-2.5-flash');
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`;
  }

  function buildInput(extracted, settings){
    const prepared = settings?.__prepared;
    return prepared?.prompt || '';
  }

  async function distillGemini(extracted, settings){
    const apiKey = settings?.apiKey;
    const model = settings?.model || 'gemini-2.5-flash';
    if (!apiKey) throw new Error('Gemini API key required');

    const res = await fetch(endpoint(model) + `?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildInput(extracted, settings) }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.3 }
      })
    });

    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try { const j = await res.json(); msg += ` - ${j.error?.message || ''}`; } catch {}
      throw new Error('Gemini API error: ' + msg);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    return wrapHtml(text, extracted.title || 'Distilled');
  }

  function wrapHtml(inner, title='Distilled') {
    return `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>body{font-family:Inter,system-ui,sans-serif;line-height:1.6;padding:20px;color:#0f172a}h1,h2,h3{margin:16px 0 8px}p{margin:10px 0;}pre{background:#f1f5f9;padding:12px;border-radius:8px;overflow:auto}</style></head><body>${inner}</body></html>`;
  }

  function escapeHtml(s='') { 
    return s.replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); 
  }

  window.DV = window.DV || {};
  window.DV.aiProviders = window.DV.aiProviders || {};
  
  async function testGemini(settings){
    const apiKey = settings?.apiKey;
    const model = settings?.model || 'gemini-2.5-flash';
    if (!apiKey) throw new Error('Gemini API key required');
    
    const res = await fetch(endpoint(model) + `?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }], 
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0 } 
      })
    });
    
    if (!res.ok) throw new Error('API key invalid or model not accessible');
    return true;
  }

  window.DV.aiProviders.gemini = { distill: distillGemini, test: testGemini };
})();