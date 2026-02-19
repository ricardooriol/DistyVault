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
  /**
   * Call Gemini generateContent API via local proxy (streaming).
   * @param {object} extracted
   * @param {{apiKey?:string, model?:string, signal?:AbortSignal, __prepared?:any}} settings
   * @returns {Promise<string>}
   */
  async function distillGemini(extracted, settings) {
    const apiKey = settings?.apiKey;
    const model = settings?.model || 'gemini-3-flash-preview';
    const signal = settings?.signal;

    if (!apiKey) throw new Error('Gemini API key required');

    // Use local proxy
    const proxyUrl = '/api/ai?provider=gemini&model=' + encodeURIComponent(model);

    // 1. Check if aborted before starting request
    if (signal?.aborted) throw new Error('Aborted by user');

    try {
      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: buildInput(extracted, settings) }] }],
          generationConfig: { temperature: 0.3 }
        }),
        signal // Pass signal to fetch to kill network request
      });

      if (!res.ok) {
        let msg = `${res.status} ${res.statusText}`;
        try { const j = await res.json(); msg += ` - ${j.error?.message || JSON.stringify(j)}`; } catch {
          try { const t = await res.text(); msg += ` - ${t}`; } catch { }
        }

        // Throw specific error types for the service layer to handle
        if (res.status === 503 || res.status === 504 || msg.includes('High Demand') || msg.includes('Overloaded')) {
          throw new Error(`RetryableError: ${msg}`);
        }
        throw new Error('Gemini API error: ' + msg);
      }

      // Handle Streaming Response
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
      }
      buffer += decoder.decode();

      // Robust JSON Parsing
      // Gemini sends a JSON array of objects. Sometimes the stream cuts off before the closing ']'.
      let cleanBuffer = buffer.trim();

      // Fix 1: If it starts with '[' but doesn't end with ']', try to close it.
      if (cleanBuffer.startsWith('[') && !cleanBuffer.endsWith(']')) {
        // Attempt to close the JSON array securely
        // If it ends with a comma, remove it
        if (cleanBuffer.endsWith(',')) cleanBuffer = cleanBuffer.slice(0, -1);
        // If it's inside an object (ends with '}'), allow closing the array
        if (cleanBuffer.endsWith('}')) cleanBuffer += ']';
      }

      let jsonArray;
      try {
        jsonArray = JSON.parse(cleanBuffer);
      } catch (e) {
        // Fix 2: If standard parse fails, try the "repair" approach
        // Often it's just a missing ']' or a trailing comma inside the last object
        try {
          // Very aggressive repair: try adding brackets/braces until it parses
          // This is a naive but effective heuristic for simple stream truncations
          if (cleanBuffer.endsWith('}')) {
            jsonArray = JSON.parse(cleanBuffer + ']');
          } else {
            throw e;
          }
        } catch (repairErr) {
          console.warn('Gemini stream parse failed, attempting manual extraction:', repairErr);
          return extractTextManually(cleanBuffer);
        }
      }

      // Extract text from valid JSON
      if (Array.isArray(jsonArray)) {
        const text = jsonArray.map(c =>
          c.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || ''
        ).join('');
        return DV.utils.wrapHtml(text, extracted.title || 'Distilled');
      }

      return extractTextManually(cleanBuffer);

    } catch (err) {
      if (signal?.aborted || err.name === 'AbortError' || err.message === 'Aborted by user') {
        throw new Error('Aborted by user');
      }
      // Re-throw for service.js to handle (it catches 'RetryableError')
      throw err;
    }
  }

  /**
   * Fallback: extract text using regex if JSON parsing fails completely.
   */
  function extractTextManually(buffer) {
    const matches = buffer.match(/"text":\s*"([^"]*)"/g);
    if (matches) {
      const text = matches.map(m => {
        try { return JSON.parse('{' + m + '}').text; } catch { return ''; }
      }).join('');
      return DV.utils.wrapHtml(text, 'Distilled (Partial)');
    }
    throw new Error('Failed to parse Gemini response');
  }

  window.DV = window.DV || {};
  window.DV.aiProviders = window.DV.aiProviders || {};

  async function testGemini(settings) {
    const apiKey = settings?.apiKey;
    const model = settings?.model || 'gemini-3-flash-preview';
    if (!apiKey) throw new Error('Gemini API key required');

    const proxyUrl = '/api/ai?provider=gemini&model=' + encodeURIComponent(model);
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