// Toast notifications - lightweight
(function() {
  const containerId = 'dv-toasts';

  function ensureContainer() {
    let el = document.getElementById(containerId);
    if (!el) {
      el = document.createElement('div');
      el.id = containerId;
      el.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2'
      document.body.appendChild(el);
    }
    return el;
  }

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