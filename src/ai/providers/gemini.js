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
   * @param {{apiKey?:string, model?:string, __prepared?:any}} settings
   * @returns {Promise<string>}
   */
  async function distillGemini(extracted, settings) {
    const apiKey = settings?.apiKey;
    const model = settings?.model || 'gemini-3-flash-preview';
    if (!apiKey) throw new Error('Gemini API key required');

    // Use local proxy
    const proxyUrl = '/api/ai?provider=gemini&model=' + encodeURIComponent(model);

    // Aggressive Retry Configuration
    const MAX_RETRIES = 10;
    const BASE_DELAY = 1000; // 1 second

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        // We still send the prompt as a full JSON object
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
          try { const j = await res.json(); msg += ` - ${j.error?.message || JSON.stringify(j)}`; } catch {
            // try text if json fails
            try { const t = await res.text(); msg += ` - ${t}`; } catch { }
          }

          // Check for 503 Service Unavailable / High Demand
          if (res.status === 503 || msg.includes('High Demand') || msg.includes('Overloaded')) {
            if (attempt < MAX_RETRIES) {
              const delay = Math.min(BASE_DELAY * Math.pow(2, attempt), 10000) + (Math.random() * 500); // Exponential backoff with jitter
              console.warn(`Gemini 503 (Attempt ${attempt + 1}/${MAX_RETRIES}). Retrying in ${Math.round(delay)}ms...`);
              await new Promise(r => setTimeout(r, delay));
              continue; // Retry loop
            }
          }
          throw new Error('Gemini API error: ' + msg);
        }

        // Handle Streaming Response
        // The proxy pipes the "streamGenerateContent" response directly.
        // It returns a standard JSON array-like stream: JSON objects separated by some format, 
        // but typically Google returns an array of response chunks `[{...}, {...}]` or line-delimited JSON?
        // Actually, `streamGenerateContent` returns a stream of JSON objects.
        // Let's implement a robust reader that accumulates text from the stream.

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
        }
        // Flush decoder
        buffer += decoder.decode();

        // Now parse the full valid JSON response (it should be a complete array of chunks)
        try {
          const chunks = JSON.parse(buffer);
          // chunks is array of GenerateContentResponse
          accumulatedText = chunks.map(c =>
            c.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || ''
          ).join('');
        } catch (e) {
          console.error('JSON Parse error on stream', e);
          // Fallback: try to extract text with regex if JSON is broken (e.g. truncated)
          const matches = buffer.match(/"text":\s*"([^"]*)"/g);
          if (matches) {
            accumulatedText = matches.map(m => {
              try { return JSON.parse('{' + m + '}').text; } catch { return ''; }
            }).join('');
          } else {
            throw new Error('Failed to parse Gemini response');
          }
        }
        return DV.utils.wrapHtml(accumulatedText, extracted.title || 'Distilled');

      } catch (err) {
        // Re-throw if it's the last attempt or a fatal error
        if (attempt >= MAX_RETRIES) throw err;
        // Also catch network errors (fetch failed) and retry them too
        const msg = String(err.message || err);
        if (msg.includes('503') || msg.includes('Failed to fetch') || msg.includes('network')) {
          const delay = Math.min(BASE_DELAY * Math.pow(2, attempt), 10000) + (Math.random() * 500);
          console.warn(`Network error (Attempt ${attempt + 1}/${MAX_RETRIES}). Retrying in ${Math.round(delay)}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }
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