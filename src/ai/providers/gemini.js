(function () {
  let geminiGlobalMutex = Promise.resolve();

  /**
   * Build the Gemini generateContent endpoint for a given model.
   * @param {string} model
   * @returns {string}
   */
  function endpoint(model) {
    const m = ['gemini-3.1-pro', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'].includes(model) ? model : 'gemini-3.1-pro';
    const apiModel = m === 'gemini-3.1-pro' ? 'gemini-3.1-pro-preview' : m;
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
   * Uses a global Promise-based mutex to strictly enforce Google's 15 RPM
   * free-tier limit by ensuring 4.5 seconds between ALL requests.
   */
  async function distillGemini(extracted, settings) {
    const apiKey = settings?.apiKey;
    const model = ['gemini-3.1-pro', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'].includes(settings?.model) ? settings.model : 'gemini-3.1-pro';
    if (!apiKey) throw new Error('Gemini API key required');

    let attempts = 0;
    while (attempts < 8) {
      attempts++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 900000); // 15 minute max per chunk

      let res;
      try {
        // Wait in line for our turn (strict serialization across the entire app)
        await geminiGlobalMutex;
        
        let releaseMutex;
        geminiGlobalMutex = new Promise(r => { releaseMutex = r; });

        try {
          const lastReq = parseInt(localStorage.getItem('dv.geminiLastReq') || '0', 10);
          const delay = Math.max(0, 4500 - (Date.now() - lastReq));
          if (delay > 0) {
            await new Promise(r => setTimeout(r, delay));
          }

          // Mark our execution time
          localStorage.setItem('dv.geminiLastReq', String(Date.now()));

          res = await fetch(endpoint(model) + `?key=${encodeURIComponent(apiKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: buildInput(extracted, settings) }] }],
              generationConfig: { temperature: 0.3 }
            }),
            signal: controller.signal
          });
        } finally {
          releaseMutex();
        }

        clearTimeout(timeoutId);

        if (!res.ok) {
          // If we hit a hard 429, enforce a 65-second global timeout to completely clear Google's 1-minute sliding window limit
          if (res.status === 429) {
            localStorage.setItem('dv.geminiLastReq', String(Date.now() + 65000));
          }
          let msg = `${res.status} ${res.statusText}`;
          try { const j = await res.json(); msg += ` - ${j.error?.message || ''}`; } catch { }
          const err = new Error('Gemini API error: ' + msg);
          err.status = res.status;
          throw err;
        }

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
        if (!text) throw new Error('Gemini API returned an empty response or was blocked by safety filters.');

        return text;

      } catch (err) {
        clearTimeout(timeoutId);
        
        // Google's API Gateway drops CORS headers on 429 or 500 errors, causing a generic "Failed to fetch" TypeError.
        const isNetworkOrCorsError = err.name === 'TypeError' && /Failed to fetch/i.test(err.message);
        const isRetryable = isNetworkOrCorsError || err.name === 'AbortError' || err.status === 503 || err.status === 429 || /503|429|Service Unavailable|Rate Limit|timeout/i.test(err.message);

        if (isRetryable && attempts < 8) {
          // If we suspect a hard 429 hidden behind a CORS error, apply a heavy 65s penalty
          if (isNetworkOrCorsError || err.status === 429) {
             localStorage.setItem('dv.geminiLastReq', String(Date.now() + 65000));
          }
          // Exponential backoff multiplier
          await new Promise(r => setTimeout(r, Math.pow(1.5, attempts) * 2000 + Math.random() * 1000));
          continue;
        }

        if (err.name === 'AbortError') throw new Error('Gemini API timed out after 15 minutes.');
        // Provide a clearer error if it failed due to hidden 429 CORS issues after 5 retries
        if (isNetworkOrCorsError) throw new Error('Gemini API unreachable or heavily rate-limited (CORS blocked the response).');
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
    const model = ['gemini-3.1-pro', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'].includes(settings?.model) ? settings.model : 'gemini-3.1-pro';
    const apiModel = model === 'gemini-3.1-pro' ? 'gemini-3.1-pro-preview' : model;
    if (!apiKey) throw new Error('Gemini API key required');
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(apiModel)}?key=${encodeURIComponent(apiKey)}`);
    if (!res.ok) throw new Error('API key invalid or model not accessible');
    return true;
  }

  window.DV.aiProviders.gemini = { distill: distillGemini, test: testGemini };
})();