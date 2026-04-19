(function () {
  /**
   * Build the Gemini generateContent endpoint for a given model.
   * @param {string} model
   * @returns {string}
   */
  function endpoint(model) {
    const m = ['gemini-3.1-pro', 'gemini-3-flash', 'gemini-3.1-flash-lite'].includes(model) ? model : 'gemini-3.1-pro';
    const apiModel = m.endsWith('-preview') ? m : `${m}-preview`;
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(apiModel)}:generateContent`;
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
    const model = ['gemini-3.1-pro', 'gemini-3-flash', 'gemini-3.1-flash-lite'].includes(settings?.model) ? settings.model : 'gemini-3.1-pro';
    if (!apiKey) throw new Error('Gemini API key required');

    let attempts = 0;
    while (attempts < 3) {
      attempts++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute max per chunk

      try {
        const res = await fetch(endpoint(model) + `?key=${encodeURIComponent(apiKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: buildInput(extracted, settings) }] }],
            tools: [{ google_search: {} }],
            generationConfig: { temperature: 0.3 }
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          let msg = `${res.status} ${res.statusText}`;
          try { const j = await res.json(); msg += ` - ${j.error?.message || ''}`; } catch { }
          const err = new Error('Gemini API error: ' + msg);
          err.status = res.status;
          throw err;
        }

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
        if (!text) throw new Error('Gemini API returned an empty response or was blocked by safety filters.');

        return DV.utils.wrapHtml(text, extracted.title || 'Distilled');

      } catch (err) {
        clearTimeout(timeoutId);
        const isRetryable = err.name === 'AbortError' || err.status === 503 || err.status === 429 || /503|429|Service Unavailable|Rate Limit|timeout/i.test(err.message);

        if (isRetryable && attempts < 3) {
          // Exponential backoff: 2s, 4s...
          await new Promise(r => setTimeout(r, attempts * 2000));
          continue;
        }

        // Give a descriptive error message on final failure
        if (err.name === 'AbortError') throw new Error('Gemini API timed out after 5 minutes.');
        throw err;
      }
    }
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
    const model = ['gemini-3.1-pro', 'gemini-3-flash', 'gemini-3.1-flash-lite'].includes(settings?.model) ? settings.model : 'gemini-3.1-pro';
    const apiModel = model.endsWith('-preview') ? model : `${model}-preview`;
    if (!apiKey) throw new Error('Gemini API key required');
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(apiModel)}?key=${encodeURIComponent(apiKey)}`);
    if (!res.ok) throw new Error('API key invalid or model not accessible');
    return true;
  }

  window.DV.aiProviders.gemini = { distill: distillGemini, test: testGemini };
})();