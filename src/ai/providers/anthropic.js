(function () {
  const API_URL = 'https://api.anthropic.com/v1/messages';

  function buildPayload(settings) {
    const prepared = settings?.__prepared || {};
    return {
      model: ['claude-opus-4.7', 'claude-sonnet-4.6'].includes(settings?.model) ? settings.model : 'claude-opus-4.7',
      max_tokens: 16384,
      system: prepared.messages?.[0]?.content || '',
      messages: [
        { role: 'user', content: [{ type: 'text', text: prepared.messages?.[1]?.content || prepared.prompt || 'Here is the text to distill.' }] }
      ],
      temperature: 0.3
    };
  }

  async function distillAnthropic(extracted, settings) {
    const apiKey = settings?.apiKey;
    if (!apiKey) throw new Error('Anthropic API key required');
    const payload = buildPayload(settings);

    let attempts = 0;
    while (attempts < 3) {
      attempts++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute max per chunk

      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          let msg = `${res.status} ${res.statusText}`;
          try { const j = await res.json(); msg += ` - ${j.error?.message || ''}`; } catch { }
          const err = new Error('Anthropic API error: ' + msg);
          err.status = res.status;
          throw err;
        }

        const data = await res.json();
        const text = (data.content?.[0]?.text) || '';
        return text;

      } catch (err) {
        clearTimeout(timeoutId);
        const isRetryable = err.name === 'AbortError' || err.status === 503 || err.status === 429 || /503|429|Service Unavailable|Rate Limit|timeout/i.test(err.message);

        if (isRetryable && attempts < 3) {
          await new Promise(r => setTimeout(r, attempts * 2000));
          continue;
        }

        if (err.name === 'AbortError') throw new Error('Anthropic API timed out after 5 minutes.');
        throw err;
      }
    }
  }

  async function testAnthropic(settings) {
    const apiKey = settings?.apiKey;
    if (!apiKey) throw new Error('Anthropic API key required');
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      }
    });
    if (!res.ok) throw new Error('API key invalid or model not accessible');
    return true;
  }

  window.DV = window.DV || {};
  window.DV.aiProviders = window.DV.aiProviders || {};
  window.DV.aiProviders.anthropic = { distill: distillAnthropic, test: testAnthropic };
})();