(function () {
  const API_URL = 'https://api.deepseek.com/chat/completions';

  /**
   * Send a chat completion request to Deepseek with prepared messages.
   * @param {{title?:string,fileName?:string,url?:string}} extracted
   * @param {{apiKey?:string, model?:string, __prepared?:{messages?:any[]}}} settings
   * @returns {Promise<string>}
   */
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

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(reqBody)
    });
    if (!res.ok) {
      if (res.status === 402) {
        throw new Error('DeepSeek API error: 402 Payment Required (Insufficient Balance). Please top up your prepaid balance at https://platform.deepseek.com/');
      }
      let msg = `${res.status} ${res.statusText}`;
      try { const j = await res.json(); msg += ` - ${j.error?.message || ''}`; } catch { }
      throw new Error('Deepseek API error: ' + msg);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    return content;
  }

  /**
   * Lightweight credential/access test using the models endpoint.
   * @param {{apiKey?:string}} settings
   * @returns {Promise<boolean>}
   */
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