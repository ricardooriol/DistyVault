import { htmlToPlainText } from './utils';

/**
 * Save a Blob to disk with best-effort UX across environments.
 */
export async function saveBlob(blob, filename) {
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

export async function makePdfBlobFromHtml(html, title = 'Document') {
    // Assuming jsPDF is loaded globally or we need to import it
    // For now we rely on window.jspdf as the migration of libraries isn't complete
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
        // Fallback if jsPDF is missing
        return new Blob([html], { type: 'text/html' });
    }

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

export function sanitize(s = '') { return s.replace(/[^a-z0-9 _-]+/ig, '_').slice(0, 80) || 'file'; }

export function stripExtLike(s = '') {
    let out = String(s || '').trim();
    out = out.replace(/\.(pdf|docx|doc|txt|md|rtf|html?|png|jpe?g|webp|gif|tiff?)$/i, '');
    out = out.replace(/_(pdf|docx|doc|txt|md|rtf|html?|png|jpe?g|webp|gif|tiff?)$/i, '');
    return out.trim();
}

export function pdfFileName(title) { return `${sanitize(stripExtLike(title || 'Document'))}.pdf`; }
