(function() {
  const containerId = 'dv-toasts';

  /**
   * Ensure a single toast container exists in the DOM and return it.
   * Positions in the bottom-right using utility classes; style integration is
   * left to the consumer (Tailwind classes used here by default).
   * @returns {HTMLElement}
   */
  function ensureContainer() {
    let el = document.getElementById(containerId);
    if (!el) {
      el = document.createElement('div');
      el.id = containerId;
  el.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2'
      document.body.appendChild(el);
    }
    return el;
  }

  /**
   * Render a transient toast message.
   * @param {string} message Text content for the toast
   * @param {{type?: 'info'|'success'|'error', ttl?: number}} [opts]
   * @returns {() => void} A disposer that removes the toast immediately
   */
  function toast(message, opts = {}) {
    const el = ensureContainer();
  const node = document.createElement('div');
  const type = opts.type || 'info';
  const bg = type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-emerald-600' : 'bg-slate-900';
  node.className = `${bg} text-white px-3 py-2 rounded-lg shadow-lg text-sm max-w-sm glass border border-white/20 dark:border-white/10`;
    node.textContent = message;

    el.appendChild(node);

    const ttl = opts.ttl ?? 3000;
    if (ttl > 0) setTimeout(() => node.remove(), ttl);

    return () => node.remove();
  }

  window.DV = window.DV || {};
  window.DV.toast = toast;
})();