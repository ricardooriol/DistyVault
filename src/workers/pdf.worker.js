importScripts(
    'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
    'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'
);

self.onmessage = async (e) => {
    const { id, targets, contents } = e.data;
    try {
        const zip = targets.length > 1 ? new JSZip() : null;

        for (const it of targets) {
            const content = contents[it.id];
            if (!content || !content.html) continue;

            const doc = new jspdf.jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 20;
            const wrapWidth = pageWidth - (margin * 2);
            let y = 30;

            const checkPage = (height) => {
                if (y + height > pageHeight - 25) {
                    doc.addPage();
                    y = 25;
                    return true;
                }
                return false;
            };

            // 1. Title
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(24);
            doc.setTextColor(15, 23, 42); // slate-900
            const titleLines = doc.splitTextToSize(it.title || 'Distilled Content', wrapWidth);
            doc.text(titleLines, margin, y);
            y += (titleLines.length * 10) + 4;

            // 2. Metadata (Source & Date)
            const sourceLabel = it.url || 'Universal Extraction';
            const fullDate = content.meta?.dateText || new Date().toLocaleString();
            const dateOnlyDate = fullDate.split(/[ ,]+/)[0];

            doc.setFontSize(11);
            doc.setTextColor(100, 116, 139); // slate-500

            doc.setFont('Helvetica', 'bold');
            doc.text('Source: ', margin, y);
            let offset = doc.getTextWidth ? doc.getTextWidth('Source: ') : 15;
            doc.setFont('Helvetica', 'normal');
            const sl = doc.splitTextToSize(sourceLabel, wrapWidth - offset);
            doc.text(sl, margin + offset, y);
            y += (sl.length * 5) + 3;

            doc.setFont('Helvetica', 'bold');
            doc.text('Date: ', margin, y);
            offset = doc.getTextWidth ? doc.getTextWidth('Date: ') : 11;
            doc.setFont('Helvetica', 'normal');
            doc.text(dateOnlyDate, margin + offset, y);
            y += 10;

            // 3. Divider Line
            doc.setDrawColor(226, 232, 240); // slate-200
            doc.setLineWidth(0.5);
            doc.line(margin, y, pageWidth - margin, y);
            y += 10;

            // 4. Content regex parsing
            const sectionRegex = /<section[^>]*>([\s\S]*?)<\/section>/g;
            const headRegex = /<div class="dv-head"[^>]*>([\s\S]*?)<\/div>/;
            const bodyRegex = /<div class="dv-body"[^>]*>([\s\S]*?)<\/div>/;
            const pRegex = /<p>([\s\S]*?)<\/p>/g;

            let match;
            let hasPoints = false;

            while ((match = sectionRegex.exec(content.html)) !== null) {
                hasPoints = true;
                const sectionHtml = match[1];

                const headMatch = headRegex.exec(sectionHtml);
                const headText = headMatch ? headMatch[1].replace(/<[^>]+>/g, '').trim() : '';

                const bodyMatch = bodyRegex.exec(sectionHtml);
                let bodyText = '';
                if (bodyMatch) {
                    const bodyHtml = bodyMatch[1];
                    let pMatch;
                    const pTexts = [];
                    while ((pMatch = pRegex.exec(bodyHtml)) !== null) {
                        pTexts.push(pMatch[1].replace(/<[^>]+>/g, '').trim());
                    }
                    if (pTexts.length > 0) bodyText = pTexts.join('\\n\\n');
                    else bodyText = bodyHtml.replace(/<[^>]+>/g, '').trim();
                }

                if (!headText && !bodyText) continue;

                if (headText) {
                    doc.setFont('Helvetica', 'bold');
                    doc.setFontSize(14);
                    doc.setTextColor(15, 23, 42);
                    const hl = doc.splitTextToSize(headText, wrapWidth);
                    checkPage(hl.length * 7 + 8);
                    doc.text(hl, margin, y);
                    y += (hl.length * 6) + 3;
                }

                if (bodyText) {
                    doc.setFont('Helvetica', 'normal');
                    doc.setFontSize(12);
                    doc.setTextColor(51, 65, 85);
                    const bodyLines = doc.splitTextToSize(bodyText, wrapWidth);
                    for (let bLine of bodyLines) {
                        if (checkPage(8)) {
                            doc.setFont('Helvetica', 'normal');
                            doc.setFontSize(12);
                            doc.setTextColor(51, 65, 85);
                        }
                        doc.text(bLine, margin, y);
                        y += 7;
                    }
                    y += 8;
                }
            }

            if (!hasPoints) {
                // Fallback flat parsing
                const clean = content.html.replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim();
                doc.setFont('Helvetica', 'normal');
                doc.setFontSize(12);
                doc.setTextColor(51, 65, 85);
                const bodyLines = doc.splitTextToSize(clean, wrapWidth);
                for (let bLine of bodyLines) {
                    if (checkPage(8)) {
                        doc.setFont('Helvetica', 'normal');
                        doc.setFontSize(12);
                        doc.setTextColor(51, 65, 85);
                    }
                    doc.text(bLine, margin, y);
                    y += 7;
                }
            }

            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(11);
                doc.setTextColor(148, 163, 184); // slate-400
                doc.text('DistyVault', margin, pageHeight - 10);
                doc.text(`${i} / ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
            }

            if (zip) {
                const fn = (it.title || 'Export').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf';
                zip.file(fn, doc.output('arraybuffer'));
            } else {
                self.postMessage({ id, type: 'single', blob: doc.output('blob'), title: it.title });
            }
        }

        if (zip) {
            const zblob = await zip.generateAsync({ type: 'blob' });
            self.postMessage({ id, type: 'zip', blob: zblob });
        }
    } catch (err) {
        self.postMessage({ id, error: err.message });
    }
};
