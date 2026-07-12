(function () {
  /**
   * Build the Gemini generateContent endpoint for a given model.
   */
  function endpoint(model) {
    const m = ['gemini-3.1-pro', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'].includes(model) ? model : 'gemini-3.1-pro';
    const apiModel = m === 'gemini-3.1-pro' ? 'gemini-3.1-pro-preview' : m;
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(apiModel)}:generateContent`;
  }

  function buildInput(extracted, settings) {
    const prepared = settings?.__prepared;
    return prepared?.prompt || '';
  }

  async function distillGemini(extracted, settings) {
    const apiKey = settings?.apiKey;
    const model = ['gemini-3.1-pro', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'].includes(settings?.model) ? settings.model : 'gemini-3.1-pro';
    if (!apiKey) throw new Error('Gemini API key required');

    let attempts = 0;
    while (attempts < 5) {
      attempts++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute max per chunk

      try {
        const res = await fetch(endpoint(model) + `?key=${encodeURIComponent(apiKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: buildInput(extracted, settings) }] }],
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

        return text;

      } catch (err) {
        clearTimeout(timeoutId);
        
        // Google's API Gateway drops CORS headers on 429 or 500 errors, causing a generic "Failed to fetch" TypeError.
        const isNetworkOrCorsError = err.name === 'TypeError' && /Failed to fetch/i.test(err.message);
        const isRetryable = isNetworkOrCorsError || err.name === 'AbortError' || err.status === 503 || err.status === 429 || /503|429|Service Unavailable|Rate Limit|timeout/i.test(err.message);

        if (isRetryable && attempts < 5) {
          // Robust backoff array: 5s, 15s, 30s, 60s
          const delays = [5000, 15000, 30000, 60000];
          const baseDelay = delays[attempts - 1] || 60000;
          await new Promise(r => setTimeout(r, baseDelay + Math.random() * 2000));
          continue;
        }

        if (err.name === 'AbortError') throw new Error('Gemini API timed out after 5 minutes.');
        if (isNetworkOrCorsError) throw new Error('Gemini API unreachable or heavily rate-limited (CORS blocked the response).');
        throw err;
      }
    }
  }

  window.DV = window.DV || {};
  window.DV.aiProviders = window.DV.aiProviders || {};

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