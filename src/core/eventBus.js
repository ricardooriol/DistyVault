// Simple pub/sub event bus for local communication
window.DV = window.DV || {};

(function() {
  const listeners = new Map(); // event -> Set<fn>

  function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => off(event, fn);
  }

  function off(event, fn) {
    if (listeners.has(event)) listeners.get(event).delete(fn);
  }

  function emit(event, payload) {
    if (listeners.has(event)) {
      for (const fn of Array.from(listeners.get(event))) {
        try { fn(payload); } catch (err) { console.error('DV.bus listener error', event, err); }
      }
    }
  }

  window.DV.bus = { on, off, emit };
})();
