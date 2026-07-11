(function () {
  const API_URL = 'https://api.openai.com/v1/chat/completions';

  async function distillOpenAI(extracted, settings) {
    const { apiKey } = settings || {};
    const model = ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano'].includes(settings?.model) ? settings.model : 'gpt-5.4';
    if (!apiKey) throw new Error('OpenAI API key required');

    const prepared = settings?.__prepared;
    const title = extracted.title || extracted.fileName || extracted.url || 'Untitled';

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
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: prepared?.messages || [],
            temperature: 0.3
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          let msg = `${res.status} ${res.statusText}`;
          try { const j = await res.json(); msg += ` - ${j.error?.message || ''}`; } catch { }
          const err = new Error('OpenAI API error: ' + msg);
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

        if (err.name === 'AbortError') throw new Error('OpenAI API timed out after 5 minutes.');
        throw err;
      }
    }
  }

  window.DV = window.DV || {};
  window.DV.aiProviders = window.DV.aiProviders || {};

  async function testOpenAI(settings) {
    const { apiKey } = settings || {};
    if (!apiKey) throw new Error('OpenAI API key required');
    const res = await fetch('https://api.openai.com/v1/models', { headers: { 'Authorization': `Bearer ${apiKey}` } });
    if (!res.ok) throw new Error('API key invalid or model not accessible');
    return true;
  }
  window.DV.aiProviders.openai = { distill: distillOpenAI, test: testOpenAI };
})();