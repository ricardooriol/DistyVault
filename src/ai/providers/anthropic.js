(function () {
  const API_URL = 'https://api.anthropic.com/v1/messages';

  /**
   * Build an Anthropic Messages API payload from prepared prompts.
   * Uses system for the directive and user content as a single text part.
   * @param {{model?:string, __prepared?:{prompt?:string, messages?:Array}}} settings
   * @returns {object}
   */
  function buildPayload(settings) {
    const prepared = settings?.__prepared || {};
    return {
      model: settings?.model || 'claude-sonnet-4.5-latest',
      max_tokens: 16384,
      system: prepared.messages?.[0]?.content || '',
      messages: [
        { role: 'user', content: [{ type: 'text', text: prepared.messages?.[1]?.content || prepared.prompt || 'Here is the text to distill.' }] }
      ],
      temperature: 0.3
    };
  }

  /**
   * Call Anthropic Messages API to perform distillation.
   * Validates API key, handles error bodies, and wraps the response in HTML.
   * @param {{title?:string,fileName?:string,url?:string}} extracted
   * @param {{apiKey?:string, model?:string, __prepared?:any}} settings
   * @returns {Promise<string>}
   */
  async function distillAnthropic(extracted, settings) {
    const apiKey = settings?.apiKey;
    if (!apiKey) throw new Error('Anthropic API key required');
    const payload = buildPayload(settings);
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try { const j = await res.json(); msg += ` - ${j.error?.message || ''}`; } catch { }
      throw new Error('Anthropic API error: ' + msg);
    }
    const data = await res.json();
    const text = (data.content?.[0]?.text) || '';
    const title = extracted.title || extracted.fileName || extracted.url || 'Distilled';
    return DV.utils.wrapHtml(text, title);
  }

  /**
   * Minimal connectivity test to verify API key and model accessibility.
   * @param {{apiKey?:string, model?:string}} settings
   * @returns {Promise<boolean>}
   */
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