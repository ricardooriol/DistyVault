const CHUNK_SIZE = 10000;
const CHUNK_OVERLAP = 500;

function chunkText(text) {
    if (!text) return [];
    if (text.length <= CHUNK_SIZE) return [text];
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        let end = start + CHUNK_SIZE;
        if (end >= text.length) {
            chunks.push(text.slice(start));
            break;
        }
        const regionStart = Math.max(0, end - 300);
        const searchRegion = text.slice(regionStart, end + 300);
        const breakIdx = searchRegion.lastIndexOf('\n\n');
        if (breakIdx !== -1) {
            end = regionStart + breakIdx;
        }
        chunks.push(text.slice(start, end));
        start = Math.max(start + 1, end - CHUNK_OVERLAP);
    }
    return chunks;
}

function escapeHtml(s = '') {
    return s.replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function parseNumberedList(text = '') {
    const lines = text.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').split('\n');
    const pts = [];
    let current = null;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const m = line.match(/^(\d+)\.\s+(.+)/);
        if (m) {
            if (current) pts.push(current);
            current = { n: Number(m[1]), head: m[2].trim(), body: '' };
        } else if (current) {
            current.body += (current.body ? '\n' : '') + line;
        }
    }
    if (current) pts.push(current);
    return pts;
}

function standardWrapHtml(inner, meta) {
    const title = escapeHtml(meta?.title || 'Distilled');
    const srcLabel = meta?.sourceUrl ? `<a href="${escapeHtml(meta.sourceUrl)}" target="_blank" rel="noopener" class="dv-link">${escapeHtml(meta.sourceUrl)}</a>` : `<span>${escapeHtml(meta?.sourceName || '')}</span>`;
    const dateText = escapeHtml(meta?.dateText || '');
    return `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title><style>
:root{color-scheme: light dark}
html,body{height:100%;margin:0;padding:0}
body{font-family:Inter,system-ui,-apple-system,sans-serif;line-height:1.65;padding:24px;color:#1e293b;background:#ffffff;transition: background-color 0.2s, color 0.2s}
.dark body{color:#f1f5f9;background:#0f172a}
h1,h2,h3{margin:24px 0 8px;line-height:1.2}
h1{font-size:1.75rem;font-weight:800;letter-spacing:-0.025em}
p{margin:12px 0}
.dv-head{font-size:1.1rem;color:#0f172a}
.dark .dv-head{color:#ffffff}
.dv-body p{margin:12px 0}
.dv-meta{color:#64748b;font-size:0.875rem;margin-top:8px}
.dark .dv-meta{color:#94a3b8}
.dv-link{color:#4f46e5;text-decoration:none;border-bottom:1px solid rgba(79,70,229,0.3)}
.dv-link:hover{border-bottom-color:#4f46e5}
.dark .dv-link{color:#818cf8;border-bottom-color:rgba(129,140,248,0.3)}
.dark .dv-link:hover{border-bottom-color:#818cf8}
hr{border:none;border-top:1px solid #e2e8f0;margin:24px 0}
.dark hr{border-top-color:#1e293b}
footer.dv-footer{margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:0.75rem;text-align:center}
.dark footer.dv-footer{border-top-color:#1e293b;color:#475569}
</style></head><body>
<script>
  (function(){
    function updateTheme(isDark) {
      document.documentElement.classList.toggle('dark', isDark);
    }
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'dv-theme') updateTheme(e.data.isDark);
    });
    try {
      if (parent && parent.document && parent.document.documentElement.classList.contains('dark')) {
        updateTheme(true);
      }
    } catch(e){}
  })();
</script>
<header>
  <h1>${title}</h1>
  <div class="dv-meta"><strong>Source:</strong> ${srcLabel}</div>
  <div class="dv-meta"><strong>Date:</strong> ${dateText}</div>
</header>
<hr />
<main>${inner}</main>
<footer class="dv-footer">DistyVault · 2026</footer>
</body></html>`;
}

function reformatDistilled(html = '', meta) {
    try {
        const cleanHtml = html.replace(/\*?\*?\btags?\b\*?\*?[\s:-]*(.+)$/mi, '').trim();
        const rawText = cleanHtml.replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim();
        const points = parseNumberedList(rawText);
        if (!points.length) return cleanHtml;
        const body = points.map(pt => {
            const head = escapeHtml(`${pt.n}. ${pt.head}`);
            const paras = pt.body.split(/\\n{2,}/).map(p => `<p>${escapeHtml(p.trim())}</p>`).join('');
            return `
<section class="dv-point" style="margin: 8px 0 20px 0;">
  <div class="dv-head" style="font-weight:700;">${head}</div>
  <div style="height: 10px;"></div>
  <div class="dv-body" style="font-weight:400;">${paras}</div>
</section>`;
        }).join('\\n\\n');
        return standardWrapHtml(body, meta);
    } catch {
        return html;
    }
}

self.onmessage = (e) => {
    const { id, type, payload } = e.data;
    if (type === 'chunk') {
        self.postMessage({ id, chunks: chunkText(payload.text) });
    } else if (type === 'reformat') {
        self.postMessage({ id, formatted: reformatDistilled(payload.html, payload.meta) });
    }
};
