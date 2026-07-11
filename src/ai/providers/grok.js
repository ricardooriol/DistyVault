(function () {
  const API_URL = 'https://api.x.ai/v1/chat/completions';

  async function distillGrok(extracted, settings) {
    const apiKey = settings?.apiKey;
    const model = ['grok-4.3-beta', 'grok-4.20', 'grok-4.20-reasoning'].includes(settings?.model) ? settings.model : 'grok-4.3-beta';
    if (!apiKey) throw new Error('Grok API key required');
    const prepared = settings?.__prepared;

    let attempts = 0;
    while (attempts < 3) {
      attempts++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute max per chunk

      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ model, messages: prepared?.messages || [], temperature: 0.3 }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          let msg = `${res.status} ${res.statusText}`;
          try { const j = await res.json(); msg += ` - ${j.error?.message || ''}`; } catch { }
          const err = new Error('Grok API error: ' + msg);
          err.status = res.status;
          throw err;
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';
        return content;

      } catch (err) {
        clearTimeout(timeoutId);
        const isRetryable = err.name === 'AbortError' || err.status === 503 || err.status === 429 || /503|429|Service Unavailable|Rate Limit|timeout/i.test(err.message);

        if (isRetryable && attempts < 3) {
          await new Promise(r => setTimeout(r, attempts * 2000));
          continue;
        }

        if (err.name === 'AbortError') throw new Error('Grok API timed out after 5 minutes.');
        throw err;
      }
    }
  }

  async function testGrok(settings) {
    const { apiKey } = settings || {};
    if (!apiKey) throw new Error('Grok API key required');
    const res = await fetch('https://api.x.ai/v1/models', { headers: { 'Authorization': `Bearer ${apiKey}` } });
    if (!res.ok) throw new Error('API key invalid or model not accessible');
    return true;
  }

  window.DV = window.DV || {};
  window.DV.aiProviders = window.DV.aiProviders || {};
  window.DV.aiProviders.grok = { distill: distillGrok, test: testGrok };
})();