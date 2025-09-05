/**
 * NumberingProcessor - Browser version
 * Ensures AI outputs follow strict numbered format and safe HTML.
 * Ported from src/ai/numberingProcessor.js
 */
(function(){
    class NumberingProcessor {
        static fixNumberingAsHTML(text) {
            if (!text || typeof text !== 'string') return text;
            try {
                let processedText = this.fixNumbering(text);
                let html = this.formatAsHTML(processedText);
                if (!this.validateHTMLFormat(html)) {
                    html = this.forceFormat(text, true);
                    if (!this.validateHTMLFormat(html)) {
                        html = this.emergencyHTMLFormat(text);
                    }
                }
                return html;
            } catch (e) {
                return this.emergencyHTMLFormat(text);
            }
        }

        static emergencyHTMLFormat(text) {
            if (!text || typeof text !== 'string') return text;
            const escaped = this.escapeHTML(text.trim());
            if (/^\d+[\.\)\:\-]/.test(text.trim())) {
                return `<p><strong>${escaped}</strong></p>`;
            }
            return `<p><strong>1. ${escaped}</strong></p>`;
        }

        static fixNumbering(text) {
            if (!text || typeof text !== 'string') return text;
            try {
                let cleaned = this.cleanText(text);
                if (this.hasMixedOrProblematicNumbering(cleaned)) {
                    return this.forceFormat(cleaned);
                }
                const blocks = this.extractContentBlocks(cleaned);
                if (blocks.length === 0) return this.createNumberedFormat(cleaned);
                const perfect = this.applyPerfectFormat(blocks);
                return this.finalValidation(perfect);
            } catch {
                return this.emergencyFormat(text);
            }
        }

        static emergencyFormat(text) {
            const t = (text || '').toString().trim();
            return t.startsWith('1.') ? t : `1. ${t}`;
        }

        static cleanText(text) {
            return text
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n')
                .replace(/\n{3,}/g, '\n\n')
                .replace(/[ \t]+/g, ' ')
                .replace(/^\s+|\s+$/g, '');
        }

        static hasMixedOrProblematicNumbering(text) {
            const std = (text.match(/(?:^|\n)\s*(\d+)\./g) || []);
            const paren = (text.match(/(?:^|\n)\s*\((\d+)\)/g) || []);
            const colon = (text.match(/(?:^|\n)\s*(\d+):/g) || []);
            const dash = (text.match(/(?:^|\n)\s*(\d+)\s*[-–—]/g) || []);
            const rparen = (text.match(/(?:^|\n)\s*(\d+)\)/g) || []);
            const formatCount = [std, paren, colon, dash, rparen].filter(a => a.length>0).length;
            if (formatCount > 1) return true;
            if (std.length > 0) {
                const nums = std.map(m => parseInt(m.match(/\d+/)[0]));
                const uniq = new Set(nums);
                if (uniq.size < nums.length) return true;
                const sorted = [...nums].sort((a,b)=>a-b);
                if (sorted[0] !== 1 || !sorted.every((n,i)=> n === i+1)) return true;
            }
            if (/(?:^|\n)\s*\d+\.\s*\n/.test(text)) return true;
            if ((text.match(/\.\s*\d+\./g) || []).length > 0) return true;
            return false;
        }

        static extractContentBlocks(text) {
            const numbered = this.extractExistingNumberedBlocks(text);
            if (numbered.length > 0) return numbered;
            const mixed = this.extractMixedNumberingBlocks(text);
            if (mixed.length > 0) return mixed;
            const paragraphs = this.extractParagraphBlocks(text);
            if (paragraphs.length > 0) return paragraphs;
            const sentences = this.extractSentenceBlocks(text);
            if (sentences.length > 0) return sentences;
            return [];
        }

        static extractExistingNumberedBlocks(text) {
            const res = [];
            const patterns = [
                { regex: /(?:^|\n)\s*(\d+)\.\s*([^\n]*(?:\n(?!\s*\d+[\.\)\:\-])[^\n]*)*)/g },
                { regex: /(?:^|\n)\s*(\d+)\)\s*([^\n]*(?:\n(?!\s*\d+[\.\)\:\-])[^\n]*)*)/g },
                { regex: /(?:^|\n)\s*\((\d+)\)\s*([^\n]*(?:\n(?!\s*[\(\d])[^\n]*)*)/g },
                { regex: /(?:^|\n)\s*(\d+):\s*([^\n]*(?:\n(?!\s*\d+[\.\)\:\-])[^\n]*)*)/g },
                { regex: /(?:^|\n)\s*(\d+)\s*[-–—]\s*([^\n]*(?:\n(?!\s*\d+\s*[-–—])[^\n]*)*)/g }
            ];
            for (const p of patterns) {
                let m;
                const r = new RegExp(p.regex.source, p.regex.flags);
                while ((m = r.exec(text)) !== null) {
                    const num = parseInt(m[1]);
                    const content = (m[2]||'').trim();
                    if (content.length > 5) {
                        res.push({ originalNumber: num, content, startIndex: m.index, endIndex: m.index + m[0].length, fullMatch: m[0] });
                    }
                }
            }
            if (res.length === 0) return [];
            res.sort((a,b)=> a.startIndex - b.startIndex);
            const nonOverlap = [];
            let lastEnd = -1;
            for (const b of res) {
                if (b.startIndex >= lastEnd) {
                    nonOverlap.push(b);
                    lastEnd = b.endIndex;
                }
            }
            return nonOverlap;
        }

        static extractMixedNumberingBlocks(text) {
            const pattern = /(?:^|\n)\s*(?:(\d+)[\.\)\:\-]|\((\d+)\))\s*([^\n]*(?:\n(?!\s*(?:\d+[\.\)\:\-]|\(\d+\)))[^\n]*)*)/g;
            const blocks = [];
            let m;
            while ((m = pattern.exec(text)) !== null) {
                const num = parseInt(m[1] || m[2]);
                const content = (m[3]||'').trim();
                if (content.length > 5) {
                    blocks.push({ originalNumber: num, content, startIndex: m.index, endIndex: m.index + m[0].length, fullMatch: m[0] });
                }
            }
            return blocks.sort((a,b)=> a.startIndex - b.startIndex);
        }

        static extractParagraphBlocks(text) {
            const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 20);
            if (paragraphs.length < 2 || paragraphs.length > 15) return [];
            return paragraphs.map((p,i)=> ({ originalNumber: i+1, content: p.trim(), startIndex: 0, fullMatch: p }));
        }

        static extractSentenceBlocks(text) {
            const sentences = text.match(/[^.!?]+[.!?]+/g);
            if (!sentences || sentences.length < 2) return [];
            const blocks = [];
            let current = '';
            let count = 0;
            for (const s of sentences) {
                const t = s.trim();
                if (t.length < 10) continue;
                current += (current ? ' ' : '') + t;
                count++;
                if (count >= 2 && (count >= 4 || this.isNaturalBreak(t))) {
                    blocks.push({ originalNumber: blocks.length+1, content: current.trim(), startIndex: 0, fullMatch: current });
                    current = ''; count = 0;
                }
            }
            if (current.trim().length > 20) {
                blocks.push({ originalNumber: blocks.length+1, content: current.trim(), startIndex: 0, fullMatch: current });
            }
            return (blocks.length >= 2 && blocks.length <= 10) ? blocks : [];
        }

        static isNaturalBreak(sentence) {
            const indicators = ['however','furthermore','additionally','moreover','consequently','therefore','meanwhile','subsequently','nevertheless','nonetheless'];
            const low = sentence.toLowerCase();
            return indicators.some(x => low.includes(x));
        }

        static createNumberedFormat(text) {
            const chunks = text.split(/\n\s*\n/).filter(c => c.trim().length > 20);
            if (chunks.length === 0) return `1. ${text.trim()}`;
            if (chunks.length === 1) {
                const sentences = chunks[0].match(/[^.!?]+[.!?]+/g);
                if (sentences && sentences.length >= 2) {
                    return sentences.map((s,i)=> `${i+1}. ${s.trim()}`).join('\n\n');
                }
                return `1. ${chunks[0].trim()}`;
            }
            return chunks.map((c,i)=> `${i+1}. ${c.trim()}`).join('\n\n');
        }

        static applyPerfectFormat(blocks) {
            if (blocks.length === 0) return '';
            const formatted = blocks.map((block, idx) => {
                const number = idx + 1;
                let content = block.content.trim();
                content = content.replace(/^\d+[\.\)\:\-\s]+/, '');
                content = content.replace(/^\(\d+\)\s*/, '');
                const lines = content.split('\n');
                const firstLine = lines[0].trim();
                const sentenceMatch = firstLine.match(/^([^.!?]*[.!?])/);
                if (sentenceMatch) {
                    const firstSentence = sentenceMatch[1].trim();
                    const remainingFirstLine = firstLine.substring(sentenceMatch[0].length).trim();
                    const restOfLines = lines.slice(1).join('\n').trim();
                    let rest = '';
                    if (remainingFirstLine.length > 0) rest = remainingFirstLine;
                    if (restOfLines.length > 0) rest = rest ? rest + '\n' + restOfLines : restOfLines;
                    return rest && rest.length > 0 ? `${number}. ${firstSentence}\n${rest}` : `${number}. ${firstSentence}`;
                } else {
                    if (lines.length > 1) {
                        const restOfLines = lines.slice(1).join('\n').trim();
                        return restOfLines.length > 0 ? `${number}. ${firstLine}\n${restOfLines}` : `${number}. ${firstLine}`;
                    }
                    return `${number}. ${content}`;
                }
            });
            return formatted.join('\n\n');
        }

        static finalValidation(text) {
            const lines = text.split(/\n+/);
            const filtered = [];
            let expected = 1;
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.length === 0) continue;
                if (/^\d+\./.test(trimmed)) {
                    filtered.push(trimmed.replace(/^\d+\./, `${expected}.`));
                    expected++;
                } else {
                    filtered.push(trimmed);
                }
            }
            return filtered.join('\n');
        }

        static formatAsHTML(text) {
            const blocks = text.split(/\n\n+/).map(b => b.trim()).filter(Boolean);
            const htmlBlocks = blocks.map(block => {
                const match = block.match(/^(\d+)\.\s*(.+)$/s);
                if (!match) return `<p>${this.escapeHTML(block)}</p>`;
                const mainAndRest = match[2];
                const lines = mainAndRest.split('\n');
                const mainSentence = lines[0].trim();
                const rest = lines.slice(1).join('\n').trim();
                const strong = `<strong>${this.escapeHTML(`${match[1]}. ${mainSentence}`)}</strong>`;
                if (!rest) return `<p>${strong}</p>`;
                return `<p>${strong}</p><p>${this.escapeHTML(rest).replace(/\n/g,'<br>')}</p>`;
            });
            return htmlBlocks.join('\n');
        }

        static validateHTMLFormat(html) {
            if (typeof html !== 'string' || html.length === 0) return false;
            const points = (html.match(/<p>\s*<strong>\s*\d+\.\s*/g) || []).length;
            return points >= 1;
        }

        static getNumberingStats(text) {
            const m = text.match(/(?:^|\n)\s*(\d+)\./g) || [];
            const nums = m.map(x => parseInt(x.match(/\d+/)[0]));
            const isSequential = nums.length > 0 && nums.every((n,i) => n === i+1);
            return { hasNumbering: m.length > 0, totalPoints: m.length, isSequential };
        }

        static forceFormat(text, asHTML = false) {
            const lines = this.cleanText(text).split(/\n\s*\n|\n(?=\d+\.)/);
            const points = [];
            let current = '';
            for (const line of lines) {
                const l = line.trim();
                if (!l) continue;
                if (/^\d+[\.\)\:\-]/.test(l) && current) {
                    points.push(current.trim());
                    current = l;
                } else {
                    current += (current ? '\n' : '') + l;
                }
            }
            if (current) points.push(current.trim());
            if (points.length === 0) return asHTML ? this.emergencyHTMLFormat(text) : this.emergencyFormat(text);
            const numbered = points.map((p,i)=> `${i+1}. ${p.replace(/^\d+[\.\)\:\-\s]+/, '').replace(/^\(\d+\)\s*/, '')}`).join('\n\n');
            return asHTML ? this.formatAsHTML(numbered) : numbered;
        }

        static escapeHTML(str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }
    }

    window.NumberingProcessor = NumberingProcessor;
})();
