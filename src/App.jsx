import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
/**
 * DistyVault — App shell and business logic
 *
 * UI components are loaded from src/components/Components.jsx (via DV.components).
 * This file contains only the App root, helper functions, and the mount point.
 *
 * No build step: loaded in index.html using <script type="text/babel">.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';

import TopBar from './layout/TopBar';
import CapturePanel from './features/CapturePanel';
import StatsRow from './features/StatsRow';
import CommandBar from './features/CommandBar';
import Table from './features/Table';
import SelectionDock from './features/SelectionDock';
import TagEditorModal from './features/TagEditorModal';
import SettingsDrawer from './features/SettingsDrawer';
import ContentModal from './features/ContentModal';
import ErrorModal from './features/ErrorModal';
import Modal from './ui/Modal';
import ErrorBoundary from './ui/ErrorBoundary';
import Icon from './ui/Icon';
import { classNames } from './utils';
import { isYouTubePlaylist, formatDuration } from './utils';


const STATUS = DV.queue.STATUS;

/**
 * Yield control to the browser so rendering/painting can catch up.
 */
function yieldToBrowser() {
  return new Promise(resolve => {
    if (typeof window.requestIdleCallback === 'function') return window.requestIdleCallback(() => resolve());
    if (typeof window.requestAnimationFrame === 'function') return window.requestAnimationFrame(() => resolve());
    setTimeout(resolve, 0);
  });
}

/**
 * Save a Blob to disk with best-effort UX across environments.
 */
async function saveBlob(blob, filename) {
  const ua = typeof navigator !== 'undefined' ? navigator : null;
  const isMobile = !!(ua && (
    (ua.userAgentData && ua.userAgentData.mobile) ||
    /Android|iPhone|iPad|iPod/i.test(ua.userAgent || '') ||
    ((ua.platform === 'MacIntel' || ua.platform === 'MacPPC') && ua.maxTouchPoints > 1)
  ));
  const isIOS = !!(ua && (/iPad|iPhone|iPod/i.test(ua.userAgent || '') || ((ua.platform === 'MacIntel' || ua.platform === 'MacPPC') && ua.maxTouchPoints > 1)));

  // 1. Desktop: try File System Access API (not iOS, not mobile)
  if (!isMobile) {
    try {
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'File', accept: { [blob.type || 'application/octet-stream']: ['.' + (filename.split('.').pop() || 'bin')] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      }
    } catch (e) {
      const msg = String(e && (e.name || e.message || e));
      if (/AbortError|NotAllowedError|cancell?ed/i.test(msg)) return;
      // Fall through to other methods
    }
  }

  // 2. Mobile: try Web Share API with file
  if (isMobile) {
    try {
      const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
      if (ua && typeof ua.share === 'function' && ua.canShare && ua.canShare({ files: [file] })) {
        await ua.share({ files: [file], title: filename });
        return;
      }
    } catch (e) {
      const msg = String(e && (e.name || e.message || e));
      if (/AbortError|NotAllowedError|cancell?ed/i.test(msg)) return;
      // Fall through
    }
  }

  // 3. Universal fallback: anchor download (works on most browsers including Android)
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 10000);
    return;
  } catch { }

  // 4. Last resort for iOS Safari: open blob in new tab
  if (isIOS) {
    const urlIOS = URL.createObjectURL(blob);
    try {
      window.open(urlIOS, '_blank');
    } finally {
      setTimeout(() => { URL.revokeObjectURL(urlIOS); }, 30000);
    }
  }
}

/**
 * App — main application component.
 */
function App() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState(localStorage.getItem('dv.sort') || 'queue');
  const [theme, setThemeState] = useState(localStorage.getItem('dv.theme') || 'system');
  const [viewItem, setViewItem] = useState(null);
  const [errorItem, setErrorItem] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({ ai: { mode: '', model: '', apiKey: '' }, concurrency: 1 });
  const [tagFilter, setTagFilter] = useState('');
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  const [contentIndex, setContentIndex] = useState(new Map());

  const allTags = useMemo(() => {
    const s = new Set();
    items.forEach(i => (i.tags || []).forEach(t => s.add(t)));
    return Array.from(s).sort();
  }, [items]);

  async function rebuildContentIndex() {
    try {
      const contents = await DV.db.getAll('contents');
      const idx = new Map();
      for (const c of contents) {
        if (c.html && !c.id.endsWith(':file')) {
          try {
            const doc = new DOMParser().parseFromString(c.html, 'text/html');
            const text = (doc.body?.innerText || '').toLowerCase().slice(0, 5000);
            idx.set(c.id, text);
          } catch { }
        }
      }
      setContentIndex(idx);
    } catch { }
  }

  useEffect(() => {
    const off1 = DV.bus.on('items:loaded', (loadedItems) => { setItems(loadedItems); rebuildContentIndex(); });
    const off2 = DV.bus.on('items:added', async () => setItems(await DV.db.getAll('items')));
    const off3 = DV.bus.on('items:updated', async () => { setItems(await DV.db.getAll('items')); rebuildContentIndex(); });
    const off4 = DV.bus.on('ui:openError', setErrorItem);
    DV.queue.loadSettings().then(() => setSettings(DV.queue.getSettings()));
    DV.queue.loadQueue();
    return () => { off1(); off2(); off3(); off4(); };
  }, []);

  useEffect(() => { localStorage.setItem('dv.sort', sort); }, [sort]);

  function setTheme(t) {
    setThemeState(t);
    localStorage.setItem('dv.theme', t);
    const isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
    try {
      const msg = { type: 'dv-theme', isDark };
      document.querySelectorAll('iframe').forEach(fr => {
        try { fr.contentWindow && fr.contentWindow.postMessage(msg, window.location.origin); } catch { }
      });
      window.postMessage(msg, window.location.origin);
    } catch { }
  }

  function applySettings(s) {
    setSettings(s);
    DV.queue.setConcurrency(s.concurrency);
    DV.queue.setSettings(s);
  }

  async function handleSubmit(urlVal, files) {
    const additions = [];
    if (urlVal) {
      // Split by comma/newline to support batch paste
      const urls = urlVal.split(/[\n,]+/).map(u => u.trim()).filter(Boolean);

      for (const url of urls) {
        try {
          // Allow valid http/https URLs or treat as search if invalid (only if single input?)
          // For batch, we strictly filter for URLs to avoid confusion
          let isUrl = false;
          try { new URL(url); isUrl = url.startsWith('http'); } catch { }

          if (!isUrl) {
            if (urls.length === 1) throw new Error('Invalid URL provided');
            continue; // Skip invalid in batch
          }

          const isPlaylist = DV.extractors.isYouTubePlaylist && DV.extractors.isYouTubePlaylist(url);
          if (isPlaylist) {
            const { items: vids, title: plTitle } = await DV.extractors.extractYouTubePlaylist(url);
            if (!vids || !vids.length) throw new Error('No videos found in playlist');
            const parent = await DV.queue.addItem({ kind: 'playlist', url, title: plTitle || 'YouTube Playlist' });
            const LIMIT = 100;
            const list = vids.slice(0, LIMIT);
            for (const v of list) {
              additions.push(DV.queue.addItem({ kind: 'youtube', url: v.url, title: v.title || v.url, parentId: parent.id }));
            }
          } else {
            const isYt = DV.extractors.isYouTube(url);
            const kind = isYt ? 'youtube' : 'url';
            const placeholder = url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || url;
            const recPromise = DV.queue.addItem({ kind, url, title: placeholder });
            additions.push(recPromise);
            recPromise.then(async rec => {
              try {
                const peek = isYt
                  ? (DV.extractors.peekYouTubeTitle ? await DV.extractors.peekYouTubeTitle(url) : null)
                  : (DV.extractors.peekTitle ? await DV.extractors.peekTitle(url) : null);
                if (peek && peek.title) await DV.queue.updateItem(rec.id, { title: peek.title, url: peek.url || url });
              } catch { }
            });
          }
        } catch (e) {
          DV.toast(String(e && (e.message || e)), { type: 'error' });
        }
      }
    }
    for (const f of files) additions.push(DV.queue.addItem({ kind: 'file', title: f.name, fileName: f.name, size: f.size, file: f, fileType: f.type }));
    await Promise.all(additions);
    if (additions.length > 0) DV.toast(`Added ${additions.length} items to queue`, { type: 'success' });
  }

  async function htmlToPlainText(html = '') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    ['style', 'script', 'head', 'link', 'meta', 'title', 'svg', 'canvas'].forEach(tag => {
      const elms = doc.getElementsByTagName(tag);
      for (let i = elms.length - 1; i >= 0; i--) elms[i].remove();
    });
    const body = doc.body || doc.documentElement;
    return normalizeText(body.innerText || body.textContent || '');
  }

  function parseFormattedPoints(html = '') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const sections = Array.from(doc.querySelectorAll('section.dv-point'));
      if (!sections.length) return null;
      return sections.map(sec => {
        const head = (sec.querySelector('.dv-head')?.textContent || '').trim();
        const paras = Array.from(sec.querySelectorAll('.dv-body p')).map(p => (p.textContent || '').trim());
        return { head, paras };
      });
    } catch { return null; }
  }

  function parseHeaderMeta(html = '') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const h1 = (doc.querySelector('h1')?.textContent || '').trim();
      const source = doc.querySelector('.dv-meta strong + a, .dv-meta strong + span');
      const srcText = (source?.textContent || '').trim();
      const dateText = (doc.querySelector('.dv-meta + .dv-meta')?.textContent || '').replace(/^Date:\s*/, '').trim();
      return { h1, srcText, dateText };
    } catch { return { h1: '', srcText: '', dateText: '' }; }
  }

  async function makePdfBlobFromHtml(html, title = 'Document') {
    const points = parseFormattedPoints(html);
    const text = points ? '' : await htmlToPlainText(html);
    const meta = parseHeaderMeta(html);
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const footerSpace = 40;
    const usableBottom = () => pageHeight - margin - footerSpace;
    const maxWidth = pageWidth - margin * 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(meta.h1 || title, margin, margin);
    doc.setFontSize(11);
    function drawLabelValue(label, value, y) {
      const labelText = String(label || '') + ' ';
      const lblW = doc.getTextWidth(labelText);
      doc.setFont('helvetica', 'bold');
      doc.text(labelText.trim(), margin, y);
      doc.setFont('helvetica', 'normal');
      const wrap = doc.splitTextToSize(String(value || ''), maxWidth - lblW - 4);
      let yy = y;
      wrap.forEach((line, idx) => {
        if (yy > usableBottom()) { doc.addPage(); yy = margin; }
        doc.text(line, margin + lblW + 4, yy);
        yy += 14;
      });
      return yy;
    }
    let yy = margin + 16;
    if (meta.srcText) yy = drawLabelValue('Source:', meta.srcText, yy);
    if (meta.dateText) yy = drawLabelValue('Date:', meta.dateText, yy);
    doc.setDrawColor(180);
    doc.line(margin, yy + 4, pageWidth - margin, yy + 4);
    doc.setFontSize(12);
    let y = yy + 24;
    const lineHeight = 16;
    if (points && points.length) {
      for (const pt of points) {
        doc.setFont('helvetica', 'bold');
        const headLines = doc.splitTextToSize(pt.head, maxWidth);
        for (const line of headLines) {
          if (y > usableBottom()) { doc.addPage(); y = margin; }
          doc.text(line, margin, y);
          y += lineHeight;
        }
        y += 8;
        doc.setFont('helvetica', 'normal');
        for (const para of pt.paras) {
          const plines = doc.splitTextToSize(para, maxWidth);
          for (const line of plines) {
            if (y > usableBottom()) { doc.addPage(); y = margin; }
            doc.text(line, margin, y);
            y += lineHeight;
          }
          y += 8;
        }
        y += 16;
      }
    } else {
      const lines = doc.splitTextToSize(text || '(No content)', maxWidth);
      for (const line of lines) {
        if (y > usableBottom()) { doc.addPage(); y = margin; }
        doc.text(line, margin, y);
        y += lineHeight;
      }
    }
    doc.setDrawColor(180);
    const sepY = Math.min(y + 8, usableBottom() - 8);
    if (sepY > margin) doc.line(margin, sepY, pageWidth - margin, sepY);
    const pageCount = doc.getNumberOfPages();
    doc.setFontSize(10);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const footerY = pageHeight - margin + 10;
      doc.setFont('helvetica', 'normal');
      doc.text(`DistyVault · ${new Date().getFullYear()}`, margin, footerY);
      const pageText = `${i}/${pageCount}`;
      const textWidth = doc.getTextWidth(pageText);
      doc.text(pageText, pageWidth - margin - textWidth, footerY);
    }
    return doc.output('blob');
  }

  function buildViewerHtml(savedHtml = '') {
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
  try { if (window && window.DV) window.DV.buildViewerHtml = buildViewerHtml; } catch { }

  async function downloadAllCompleted() {
    const completed = items.filter(i => i.status === STATUS.COMPLETED || i.status === STATUS.READ);
    if (!completed.length) return;
    if (completed.length === 1) {
      const it = completed[0];
      const content = await DV.db.get('contents', it.id);
      if (content?.html) {
        const pdf = await makePdfBlobFromHtml(content.html, it.title || 'Document');
        await saveBlob(pdf, pdfFileName(it.title));
      }
      return;
    }
    const zip = new JSZip();
    for (const it of completed) {
      await yieldToBrowser();
      const content = await DV.db.get('contents', it.id);
      if (content?.html) {
        const pdf = await makePdfBlobFromHtml(content.html, it.title || 'Document');
        zip.file(pdfFileName(it.title), pdf);
      }
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    await saveBlob(blob, 'distyvault-bulk.zip');
  }

  function sanitize(s = '') { return s.replace(/[^a-z0-9 _-]+/ig, '_').slice(0, 80) || 'file'; }
  function stripExtLike(s = '') {
    let out = String(s || '').trim();
    out = out.replace(/\.(pdf|docx|doc|txt|md|rtf|html?|png|jpe?g|webp|gif|tiff?)$/i, '');
    out = out.replace(/_(pdf|docx|doc|txt|md|rtf|html?|png|jpe?g|webp|gif|tiff?)$/i, '');
    return out.trim();
  }
  function pdfFileName(title) { return `${sanitize(stripExtLike(title || 'Document'))}.pdf`; }

  async function stopAll() {
    items.filter(i => [STATUS.PENDING, STATUS.EXTRACTING, STATUS.DISTILLING].includes(i.status)).forEach(i => DV.queue.requestStop(i.id));
    DV.queue.loadQueue();
    DV.toast('Stopped all active distillations', { type: 'success' });
  }

  async function retryFailed() {
    const failed = items.filter(i => i.status === STATUS.ERROR || i.status === STATUS.STOPPED);
    for (const it of failed) {
      const keptTags = (it?.tags || []).filter(t => t.startsWith('source:'));
      await DV.queue.updateItem(it.id, {
        status: STATUS.PENDING,
        error: null,
        durationMs: 0,
        startedAt: null,
        createdAt: Date.now(),
        tags: keptTags
      });
    }
    DV.queue.loadQueue();
    DV.toast('Retry queued');
  }

  function filteredSorted() {
    const q = search.toLowerCase();
    let arr = items.filter(i => {
      if (filter === 'all') return true;
      if (filter === 'youtube') return i.kind === 'youtube' || isYouTubePlaylist(i);
      return i.kind === filter;
    }).filter(i => {
      if (tagFilter && !(i.tags || []).includes(tagFilter)) return false;
      return true;
    }).filter(i => {
      if (!q) return true;
      if (i.title?.toLowerCase().includes(q) || i.url?.toLowerCase().includes(q) || i.fileName?.toLowerCase().includes(q)) return true;
      const body = contentIndex.get(i.id);
      if (body && body.includes(q)) return true;
      return false;
    });
    if (sort === 'title') arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    else if (sort === 'status') arr.sort((a, b) => (a.status || '').localeCompare(b.status || ''));
    else if (sort === 'source') arr.sort((a, b) => {
      const sa = ((a.tags || []).find(t => t.startsWith('source:')) || 'source:web').slice(7);
      const sb = ((b.tags || []).find(t => t.startsWith('source:')) || 'source:web').slice(7);
      return sa.localeCompare(sb);
    });
    else if (sort === 'date') arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    else if (sort === 'created') arr.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    else if (sort === 'queue') arr.sort((a, b) => (a.queueIndex || 0) - (b.queueIndex || 0));
    return arr;
  }

  async function exportAll() {
    await yieldToBrowser();
    const blob = await DV.db.exportAllToZip();
    await saveBlob(blob, 'distyvault-export.zip');
  }

  async function importZip(file) {
    await DV.db.importFromZip(file);
    DV.queue.loadQueue();
    DV.toast('Imported');
  }

  async function viewSelected() {
    if (selected.length !== 1) return;
    const id = selected[0];
    const item = items.find(i => i.id === id);
    if (item && item.status === STATUS.COMPLETED) {
      // Mark as read when viewed, if it was completed
      await DV.queue.updateItem(id, { status: STATUS.READ });
    }
    setViewItem(item || null);
  }

  async function retrySelected() {
    for (const id of selected) {
      const item = items.find(i => i.id === id);
      const keptTags = (item?.tags || []).filter(t => t.startsWith('source:'));
      await DV.queue.updateItem(id, {
        status: STATUS.PENDING,
        error: null,
        durationMs: 0,
        startedAt: null,
        createdAt: Date.now(), // Refresh date to jump to top
        tags: keptTags // Clear auto-generated tags
      });
    }
    DV.queue.loadQueue();
    setSelected([]);
  }

  async function downloadSelected() {
    if (selected.length === 1) {
      const id = selected[0];
      const item = items.find(i => i.id === id);
      const content = await DV.db.get('contents', id);
      if (content?.html) {
        const pdf = await makePdfBlobFromHtml(content.html, item?.title || 'Document');
        await saveBlob(pdf, pdfFileName(item?.title || id));
      }
      return;
    }
    const zip = new JSZip();
    for (const id of selected) {
      await yieldToBrowser();
      const item = items.find(i => i.id === id);
      const content = await DV.db.get('contents', id);
      if (content?.html) {
        const pdf = await makePdfBlobFromHtml(content.html, item?.title || 'Document');
        zip.file(pdfFileName(item?.title || id), pdf);
      }
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    await saveBlob(blob, `distyvault-bulk-download.zip`);
  }

  /**
   * Run a DB vacuum on startup to clear any orphaned content.
   */
  useEffect(() => {
    DV.db.vacuum().then(count => {
      if (count > 0) console.log(`Vacuumed ${count} orphaned records from DB.`);
    }).catch(console.error);
  }, []);

  async function deleteSelected() {
    // Use the new atomic deleteItem to ensure clean removal of files/blobs
    for (const id of selected) {
      await DV.db.deleteItem(id);
    }
    setSelected([]);
    try { if (DV.queue && DV.queue.syncLocalSummary) await DV.queue.syncLocalSummary(); } catch { }
    DV.queue.loadQueue();
  }

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') setSelected([]); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSort = (k) => {
    setSort(k);
    if (k === 'queue') DV.queue.loadQueue();
  };

  const allItemsSorted = filteredSorted();
  const [expandedIds, setExpandedIds] = React.useState(new Set());
  const byParent = React.useMemo(() => {
    const map = new Map();
    for (const it of allItemsSorted) {
      if (it.parentId) {
        if (!map.has(it.parentId)) map.set(it.parentId, []);
        map.get(it.parentId).push(it);
      }
    }
    return map;
  }, [allItemsSorted]);
  const visibleItems = React.useMemo(() => {
    const out = [];
    const seen = new Set();
    for (const it of allItemsSorted) {
      if (seen.has(it.id)) continue;
      if (!it.parentId) {
        out.push(it);
        seen.add(it.id);
        if (it.kind === 'playlist' && expandedIds.has(it.id)) {
          const children = byParent.get(it.id) || [];
          for (const ch of children) { out.push(ch); seen.add(ch.id); }
        }
      }
    }
    return out;
  }, [allItemsSorted, expandedIds, byParent]);
  const anyActive = selected.some(id => {
    const it = items.find(x => x.id === id);
    return it && [STATUS.PENDING, STATUS.EXTRACTING, STATUS.DISTILLING].includes(it.status);
  });
  const disableViewDownload = !selected.every(id => {
    const it = items.find(x => x.id === id);
    return it && (it.status === STATUS.COMPLETED || it.status === STATUS.READ);
  });
  const disableView = !selected.every(id => {
    const it = items.find(x => x.id === id);
    return it && (it.status === STATUS.COMPLETED || it.status === STATUS.READ || it.status === STATUS.ERROR || it.status === STATUS.STOPPED);
  });
  const allSelected = visibleItems.length > 0 && visibleItems.every(i => selected.includes(i.id));

  return (
    <div className="min-h-full">
      <TopBar theme={theme} setTheme={setTheme} openSettings={() => setSettingsOpen(true)} />
      <div className="max-w-6xl mx-auto px-4">
        <CapturePanel onSubmit={handleSubmit} />
        <StatsRow items={items} onDownloadAll={downloadAllCompleted} onStopAll={stopAll} onRetryFailed={retryFailed} />
        <CommandBar filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} onExport={exportAll} onImport={importZip} sort={sort} setSort={setSort} tagFilter={tagFilter} setTagFilter={setTagFilter} allTags={allTags} />
        <Table items={visibleItems} allItems={allItemsSorted} selected={selected} setSelected={setSelected} onSort={handleSort} expandedIds={expandedIds} setExpandedIds={setExpandedIds} />
        <SelectionDock
          count={selected.length}
          anyActive={anyActive}
          allSelected={allSelected}
          disableViewDownload={disableViewDownload}
          disableView={disableView}
          onView={viewSelected}
          onRetry={retrySelected}
          onStop={() => {
            selected.forEach(id => {
              const item = items.find(i => i.id === id);
              if (item && [STATUS.PENDING, STATUS.EXTRACTING, STATUS.DISTILLING].includes(item.status)) {
                DV.queue.requestStop(id);
              }
            });
            DV.queue.loadQueue();
          }}
          onDownload={downloadSelected}
          onDelete={deleteSelected}
          onSelectAll={() => setSelected(visibleItems.map(i => i.id))}
          onUnselectAll={() => setSelected([])}
          onTag={() => setTagEditorOpen(true)}
        />
      </div>

      <ContentModal item={viewItem} onClose={() => setViewItem(null)} />
      <ErrorModal item={errorItem} onClose={() => setErrorItem(null)} />
      <TagEditorModal open={tagEditorOpen} onClose={() => setTagEditorOpen(false)} selectedIds={selected} items={items} allTags={allTags} />
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} setSettings={applySettings} />

      <footer className="mt-10 py-2 text-center text-xs text-slate-600 dark:text-slate-300">DistyVault · {new Date().getFullYear()}</footer>
    </div>
  );
}

// Mount the React root with ErrorBoundary wrapper
export default App;