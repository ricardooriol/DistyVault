(function () {
  const API_URL = 'https://api.deepseek.com/chat/completions';

  async function distillDeepseek(extracted, settings) {
    const apiKey = settings?.apiKey;
    if (!apiKey) throw new Error('Deepseek API key required');

    let model = settings?.model || 'deepseek-v4-flash';
    if (model === 'deepseek-chat') model = 'deepseek-v4-flash';
    if (model === 'deepseek-reasoner') model = 'deepseek-v4-pro';

    if (!['deepseek-v4-flash', 'deepseek-v4-pro'].includes(model)) {
      model = 'deepseek-v4-flash';
    }

    const prepared = settings?.__prepared;
    const reqBody = {
      model,
      messages: prepared?.messages || []
    };

    if (model === 'deepseek-v4-pro') {
      reqBody.thinking = { type: 'enabled' };
    } else {
      reqBody.temperature = 0.3;
    }

    let attempts = 0;
    while (attempts < 3) {
      attempts++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute max per chunk

      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify(reqBody),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          if (res.status === 402) {
            const err402 = new Error('DeepSeek API error: 402 Payment Required (Insufficient Balance). Please top up your prepaid balance at https://platform.deepseek.com/');
            err402.status = 402;
            throw err402;
          }
          let msg = `${res.status} ${res.statusText}`;
          try { const j = await res.json(); msg += ` - ${j.error?.message || ''}`; } catch { }
          const err = new Error('Deepseek API error: ' + msg);
          err.status = res.status;
          throw err;
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';
        return content;

      } catch (err) {
        clearTimeout(timeoutId);
        if (err.status === 402) throw err;

        const isRetryable = err.name === 'AbortError' || err.status === 503 || err.status === 429 || /503|429|Service Unavailable|Rate Limit|timeout/i.test(err.message);

        if (isRetryable && attempts < 3) {
          await new Promise(r => setTimeout(r, attempts * 2000));
          continue;
        }

        if (err.name === 'AbortError') throw new Error('Deepseek API timed out after 5 minutes.');
        throw err;
      }
    }
  }

  async function testDeepseek(settings) {
    const { apiKey } = settings || {};
    if (!apiKey) throw new Error('Deepseek API key required');
    const res = await fetch('https://api.deepseek.com/models', { headers: { 'Authorization': `Bearer ${apiKey}` } });
    if (!res.ok) {
      if (res.status === 402) {
        throw new Error('DeepSeek API error: 402 Payment Required (Insufficient Balance). Please top up your prepaid balance at https://platform.deepseek.com/');
      }
      throw new Error('API key invalid or model not accessible');
    }
    return true;
  }

  window.DV = window.DV || {};
  window.DV.aiProviders = window.DV.aiProviders || {};
  window.DV.aiProviders.deepseek = { distill: distillDeepseek, test: testDeepseek };
})();