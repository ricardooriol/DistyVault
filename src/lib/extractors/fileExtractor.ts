import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import mammoth from 'mammoth';
import Tesseract from 'tesseract.js';

// Setup PDF worker
GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/4.3.136/pdf.worker.min.mjs`;

export async function extractTextFromFile(file: File): Promise<{ text: string; title: string }> {
    const title = file.name;
    let text = '';

    const extension = file.name.split('.').pop()?.toLowerCase();

    try {
        if (extension === 'txt' || extension === 'md' || extension === 'csv') {
            text = await extractTxt(file);
        } else if (extension === 'pdf') {
            text = await extractPdf(file);
        } else if (extension === 'docx') {
            text = await extractDocx(file);
        } else if (['png', 'jpg', 'jpeg', 'webp'].includes(extension || '')) {
            text = await extractImageOCR(file);
        } else {
            throw new Error('Unsupported file type.');
        }

        if (!text.trim()) {
            throw new Error('No readable text found in file.');
        }

        return { text, title };
    } catch (err: any) {
        throw new Error(`File Extraction failed: ${err.message}`);
    }
}

async function extractTxt(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

async function extractPdf(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
    }
    return fullText;
}

async function extractDocx(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value || '';
}

async function extractImageOCR(file: File): Promise<string> {
    const result = await Tesseract.recognize(file, 'eng');
    return result.data.text || '';
}
