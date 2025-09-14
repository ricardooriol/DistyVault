window.DV = window.DV || {};

(function() {
  /**
   * Minimal pub/sub event bus for intra-app communication. Listeners are isolated so a
   * failing callback does not prevent others from receiving the event.
   */
  const listeners = new Map();

  /**
   * Subscribe to an event.
   * @param {string} event Event name
   * @param {(payload:any)=>void} fn Callback invoked with emitted payload
   * @returns {() => void} Unsubscribe function
   */
  function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => off(event, fn);
  }

  /**
   * Remove a previously registered listener.
   * @param {string} event
   * @param {(payload:any)=>void} fn
   */
  function off(event, fn) {
    if (listeners.has(event)) listeners.get(event).delete(fn);
  }

  /**
   * Emit an event with an optional payload. Each listener is invoked in registration
   * order; exceptions are caught and logged so remaining listeners still run.
   * @param {string} event
   * @param {any} payload
   */
  function emit(event, payload) {
    if (listeners.has(event)) {
      for (const fn of Array.from(listeners.get(event))) {
        try { fn(payload); } catch (err) { console.error('DV.bus listener error', event, err); }
      }
    }
  }

  window.DV.bus = { on, off, emit };
})();