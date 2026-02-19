(function () {
  /**
   * Build the Gemini generateContent endpoint for a given model.
   * @param {string} model
   * @returns {string}
   */
  function endpoint(model) {
    const m = (model || 'gemini-3-flash-preview');
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`;
  }

  /**
   * Use the prebuilt prompt when available; fallback to empty.
   * @param {{title?:string,text?:string}} extracted
   * @param {{__prepared?:{prompt?:string}}} settings
   * @returns {string}
   */
  function buildInput(extracted, settings) {
    const prepared = settings?.__prepared;
    return prepared?.prompt || '';
  }

  /**
   * Call Gemini generateContent API with the prepared user prompt.
   * Enables google_search tool; uses a modest temperature for stability.
   * @param {object} extracted
   * @param {{apiKey?:string, model?:string, __prepared?:any}} settings
   * @returns {Promise<string>}
   */
  async function distillGemini(extracted, settings) {
    const apiKey = settings?.apiKey;
    const model = settings?.model || 'gemini-3-flash-preview';
    if (!apiKey) throw new Error('Gemini API key required');

    // Use local proxy to hide API key from URL parameters
    const proxyUrl = '/api/gemini?model=' + encodeURIComponent(model);
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildInput(extracted, settings) }] }],
        generationConfig: { temperature: 0.3 }
      })
    });

    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try { const j = await res.json(); msg += ` - ${j.error?.message || ''}`; } catch { }
      throw new Error('Gemini API error: ' + msg);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    return DV.utils.wrapHtml(text, extracted.title || 'Distilled');
  }

  window.DV = window.DV || {};
  window.DV.aiProviders = window.DV.aiProviders || {};

  /**
   * Validate API key/model access by sending a trivial prompt.
   * @param {{apiKey?:string, model?:string}} settings
   * @returns {Promise<boolean>}
   */
  async function testGemini(settings) {
    const apiKey = settings?.apiKey;
    const model = settings?.model || 'gemini-3-flash-preview';
    if (!apiKey) throw new Error('Gemini API key required');
    if (!apiKey) throw new Error('Gemini API key required');
    // Test via proxy (GET not supported by our simple proxy for generateContent, so we do a minimal generation)
    // Actually, our proxy expects POST. We should use a minimal prompt test.
    const proxyUrl = '/api/gemini?model=' + encodeURIComponent(model);
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Test' }] }],
        generationConfig: { maxOutputTokens: 1 }
      })
    });
    if (!res.ok) throw new Error('API key invalid or model not accessible');
    return true;
  }

  window.DV.aiProviders.gemini = { distill: distillGemini, test: testGemini };
})();