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

    // Aggressive Retry Configuration
    const MAX_RETRIES = 10;
    const BASE_DELAY = 1000; // 1 second

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // 1. Check if aborted before starting request
      if (signal?.aborted) throw new Error('Aborted by user');

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
          }),
          signal // 2. Pass signal to fetch to kill network request
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
              if (signal?.aborted) throw new Error('Aborted by user');

              const delay = Math.min(BASE_DELAY * Math.pow(2, attempt), 10000) + (Math.random() * 500); // Exponential backoff with jitter
              console.warn(`Gemini 503 (Attempt ${attempt + 1}/${MAX_RETRIES}). Retrying in ${Math.round(delay)}ms...`);

              // Wait with abortion check
              await new Promise((resolve, reject) => {
                const timer = setTimeout(resolve, delay);
                if (signal) {
                  signal.addEventListener('abort', () => {
                    clearTimeout(timer);
                    reject(new Error('Aborted by user'));
                  });
                }
              });
              continue; // Retry loop
            }
          }
          throw new Error('Gemini API error: ' + msg);
        }

        // Handle Streaming Response
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
        }
        buffer += decoder.decode();

        // Parse accumulated JSON
        try {
          // First try standard parse (fastest)
          const chunks = JSON.parse(buffer);
          accumulatedText = chunks.map(c =>
            c.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || ''
          ).join('');
        } catch (e) {
          console.warn('Gemini stream parse failed, attempting robust extraction:', e);
          // Robust fallback: Extract valid JSON objects by counting braces
          // This handles missing commas, array brackets, or concatenated objects
          const jsonObjects = [];
          let braceCount = 0;
          let startIndex = -1;
          let inString = false;
          let escaped = false;

          for (let i = 0; i < buffer.length; i++) {
            const char = buffer[i];

            if (inString) {
              if (escaped) {
                escaped = false;
              } else if (char === '\\') {
                escaped = true;
              } else if (char === '"') {
                inString = false;
              }
              continue;
            }

            if (char === '"') {
              inString = true;
              continue;
            }

            if (char === '{') {
              if (braceCount === 0) startIndex = i;
              braceCount++;
            } else if (char === '}') {
              braceCount--;
              if (braceCount === 0 && startIndex !== -1) {
                const jsonStr = buffer.slice(startIndex, i + 1);
                try {
                  const obj = JSON.parse(jsonStr);
                  jsonObjects.push(obj);
                } catch { /* ignore invalid blocks */ }
                startIndex = -1;
              }
            }
          }

          if (jsonObjects.length > 0) {
            accumulatedText = jsonObjects.map(c =>
              c.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || ''
            ).join('');
          } else {
            // Final desperate fallback: simple regex for text (still better than nothing)
            // but flawed for quotes. Only use if structure is totally undetectable.
            const matches = buffer.match(/"text":\s*"([^"]*)"/g);
            if (matches) {
              accumulatedText = matches.map(m => {
                try { return JSON.parse('{' + m + '}').text; } catch { return ''; }
              }).join('');
            } else {
              throw new Error('Failed to parse Gemini response: ' + e.message);
            }
          }
        }
        return DV.utils.wrapHtml(accumulatedText, extracted.title || 'Distilled');

      } catch (err) {
        if (signal?.aborted || err.name === 'AbortError' || err.message === 'Aborted by user') {
          throw new Error('Aborted by user');
        }

        // Re-throw if it's the last attempt or a fatal error
        if (attempt >= MAX_RETRIES) throw err;

        // Also catch network errors (fetch failed) and retry them too
        const msg = String(err.message || err);
        if (msg.includes('503') || msg.includes('Failed to fetch') || msg.includes('network')) {
          if (signal?.aborted) throw new Error('Aborted by user');

          const delay = Math.min(BASE_DELAY * Math.pow(2, attempt), 10000) + (Math.random() * 500);
          console.warn(`Network error (Attempt ${attempt + 1}/${MAX_RETRIES}). Retrying in ${Math.round(delay)}ms...`);

          // Wait with abortion check
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, delay);
            if (signal) {
              signal.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new Error('Aborted by user'));
              });
            }
          });
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