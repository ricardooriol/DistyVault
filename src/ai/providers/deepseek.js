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
    const model = settings?.model || 'deepseek-chat';
    if (!apiKey) throw new Error('Deepseek API key required');
    const prepared = settings?.__prepared;
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: prepared?.messages || [], ...(!/reasoner/i.test(model) && { temperature: 0.3 }) })
    });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try { const j = await res.json(); msg += ` - ${j.error?.message || ''}`; } catch { }
      throw new Error('Deepseek API error: ' + msg);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const title = extracted.title || extracted.fileName || extracted.url || 'Distilled';
    return DV.utils.wrapHtml(content, title);
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
    if (!res.ok) throw new Error('API key invalid or model not accessible');
    return true;
  }

  window.DV = window.DV || {};
  window.DV.aiProviders = window.DV.aiProviders || {};
  window.DV.aiProviders.deepseek = { distill: distillDeepseek, test: testDeepseek };
})();