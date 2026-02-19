import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// ── Helpers ──────────────────────────────────────────────────

/**
 * Merge Tailwind classes safely.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function classNames(...arr) {
  return cn(...arr);
}

/**
 * Escape a string for safe inclusion in HTML text nodes or attributes.
 */
export function escapeHtml(s = '') {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/**
 * Strip dangerous tags and attributes from HTML string using DOMParser.
 */
export function sanitizeHtml(html) {
  if (!html) return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const badTags = ['script', 'iframe', 'object', 'embed', 'form', 'base', 'meta'];
    badTags.forEach(tag => doc.querySelectorAll(tag).forEach(n => n.remove()));

    const all = doc.querySelectorAll('*');
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      for (let j = el.attributes.length - 1; j >= 0; j--) {
        const attr = el.attributes[j];
        if (attr.name.startsWith('on') || (attr.value && attr.value.trim().toLowerCase().startsWith('javascript:'))) {
          el.removeAttribute(attr.name);
        }
      }
    }
    return doc.body.innerHTML;
  } catch (e) { return escapeHtml(html); }
}

/**
 * Wrap raw AI model output in a minimal HTML document for rendering.
 */
export function wrapHtml(inner, title = 'Distilled') {
  const clean = sanitizeHtml(inner);
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>body{font-family:Inter,system-ui,sans-serif;line-height:1.6;padding:20px;color:#0f172a}h1,h2,h3{margin:16px 0 8px}p{margin:10px 0;}pre{background:#f1f5f9;padding:12px;border-radius:8px;overflow:auto}</style></head><body>${clean}</body></html>`;
}

/**
 * Normalize whitespace and remove invisible/non-printable characters.
 */
export function normalizeText(s = '') {
  return String(s)
    .replace(/\u00a0/g, ' ')
    .replace(/[\t\r]+/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \u200b\u200c\u200d\ufeff]+/g, ' ')
    .trim();
}

/**
 * Fetch with an abort timeout; does not swallow non-timeout errors.
 */
export async function fetchWithTimeout(url, opts = {}, ms = 15000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Human-readable relative time string from a timestamp.
 */
export function relativeTime(ts) {
  if (!ts) return '-';
  const diff = Date.now() - ts;
  const abs = Math.abs(diff);
  if (abs < 60000) return 'just now';
  if (abs < 3600000) return Math.floor(abs / 60000) + 'm ago';
  if (abs < 86400000) return Math.floor(abs / 3600000) + 'h ago';
  if (abs < 604800000) return Math.floor(abs / 86400000) + 'd ago';

  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${mon}/${d.getFullYear()}`;
}

export function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}m ${r}s`;
}

export function isYouTubePlaylist(item) {
  return item.kind === 'playlist';
}



/**
 * Yield control to the browser so rendering/painting can catch up.
 */
export function yieldToBrowser() {
  return new Promise(resolve => {
    if (typeof window.requestIdleCallback === 'function') return window.requestIdleCallback(() => resolve());
    if (typeof window.requestAnimationFrame === 'function') return window.requestAnimationFrame(() => resolve());
    setTimeout(resolve, 0);
  });
}

export async function htmlToPlainText(html = '') {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body?.innerText || '').trim();
}


export function buildViewerHtml(savedHtml = '') {
  try {
    let inner = '';
    try {
      const re = /<section\s+class=["']dv-point["'][\s\S]*?<\/section>/gi;
      const matches = savedHtml.match(re);
      if (matches && matches.length) inner = matches.join('\n');
    } catch { }
    if (!inner) {
      const doc = new DOMParser().parseFromString(savedHtml, 'text/html');
      const sections = Array.from(doc.querySelectorAll('section.dv-point'));
      inner = sections.length ? sections.map(n => n.outerHTML).join('\n') : (doc.body?.innerHTML || '');
    }

    const parentDoc = window.document.documentElement;
    const isDark = parentDoc.classList.contains('dark');
    const themeClass = isDark ? 'dark' : '';

    const html = `<!doctype html><html class="${themeClass}"><head><meta charset="utf-8"/><meta name="color-scheme" content="light dark" /><style>
:root{color-scheme:light dark}
*{box-sizing:border-box}
body{margin:0;padding:16px;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;line-height:1.6;color:#0f172a;background:#ffffff;font-size:15px;transition:none}
.dark body{color:#f1f5f9;background:#0f172a}
.dv-head{font-weight:600;font-size:1.05rem;margin:0 0 8px 0;color:#1e293b}
.dark .dv-head{color:#e2e8f0}
.dv-body{margin:0}
.dv-body p{margin:8px 0 12px 0;color:#334155}
.dark .dv-body p{color:#cbd5e1}
section.dv-point{margin:0 0 20px 0;padding:0}
h1,h2,h3,h4,h5,h6{margin:0 0 12px 0;font-weight:600;color:#1e293b}
.dark h1,.dark h2,.dark h3,.dark h4,.dark h5,.dark h6{color:#e2e8f0}
ul,ol{margin:8px 0 12px 16px;padding:0}
li{margin:4px 0}
a{color:#3b82f6;text-decoration:none}
.dark a{color:#60a5fa}
a:hover{text-decoration:underline}
</style></head><body>${inner}</body>
<script>
(function(){
  try {
    var d=document.documentElement;
    var pd=parent&&parent.document&&parent.documentElement;
    function syncTheme(){
      if(pd&&pd.classList.contains('dark')){
        d.classList.add('dark');
      }else{
        d.classList.remove('dark');
      }
    }
    syncTheme();
    try {
      if(pd&&pd.classList){
        var mo=new MutationObserver(syncTheme);
        mo.observe(pd,{attributes:true,attributeFilter:['class']});
      }
    } catch (e) {}
    window.addEventListener('storage',function(e){
      if(e && (e.key==='dv.theme'||e.key==='theme'||e.key==='darkMode')){
        setTimeout(syncTheme,0);
      }
    });
    window.addEventListener('message', function(e){
      try {
        var data = e && e.data;
        if (data && data.type === 'dv-theme'){
          if (data.isDark) d.classList.add('dark'); else d.classList.remove('dark');
        }
      } catch{}
    });
  }catch(e){}
})();
</script>
</html>`;
    return html;
  } catch { return savedHtml; }
}

