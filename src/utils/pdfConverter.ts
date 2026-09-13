import * as pdfjsLib from 'pdfjs-dist';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import mammoth from 'mammoth';
import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';

// Setup pdfjs worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  canvasDataUrl?: string;
  width: number;
  height: number;
}

/**
 * Render a PDF page to canvas and return as data URL
 */
export async function renderPdfPageToImage(
  pdfData: ArrayBuffer | Uint8Array,
  pageNumber: number,
  format: 'image/jpeg' | 'image/png' = 'image/jpeg',
  scale: number = 2.0
): Promise<{ dataUrl: string; width: number; height: number }> {
  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageNumber);

  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Could not get canvas 2d context');

  // Fill white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderContext = {
    canvasContext: ctx,
    viewport: viewport,
    canvas: canvas,
  };

  await (page as any).render(renderContext).promise;
  const dataUrl = canvas.toDataURL(format, format === 'image/jpeg' ? 0.92 : undefined);
  return { dataUrl, width: viewport.width, height: viewport.height };
}

/**
 * Get total page count of a PDF
 */
export async function getPdfInfo(pdfData: ArrayBuffer | Uint8Array): Promise<{ numPages: number; title?: string }> {
  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;
  const metadata = await pdf.getMetadata().catch(() => null);
  const title = (metadata?.info as any)?.Title || undefined;
  return { numPages: pdf.numPages, title };
}

/**
 * Extract text and structure from PDF
 */
export async function extractPdfText(pdfData: ArrayBuffer | Uint8Array): Promise<ExtractedPage[]> {
  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;
  const pages: ExtractedPage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const textItems = textContent.items.map((item: any) => item.str).join(' ');
    const viewport = page.getViewport({ scale: 1.0 });

    pages.push({
      pageNumber: i,
      text: textItems,
      width: viewport.width,
      height: viewport.height,
    });
  }

  return pages;
}

/**
 * Convert PDF text content to Word .docx Blob
 */
export async function convertPdfToDocx(
  pdfData: ArrayBuffer | Uint8Array,
  docTitle: string = 'Converted Document'
): Promise<Blob> {
  const pages = await extractPdfText(pdfData);

  const docSections = pages.map((p) => {
    const lines = p.text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const paragraphs: Paragraph[] = [];

    paragraphs.push(
      new Paragraph({
        text: `--- Page ${p.pageNumber} ---`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      })
    );

    if (lines.length > 0) {
      lines.forEach((line) => {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: line, size: 22 })],
            spacing: { after: 120 },
          })
        );
      });
    } else {
      // If single block of text
      const cleanText = p.text.replace(/\s+/g, ' ').trim();
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: cleanText || '[No readable OCR text extracted from this page image]', size: 22 })],
          spacing: { after: 120 },
        })
      );
    }

    return paragraphs;
  });

  const allParagraphs = docSections.flat();

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: docTitle,
            heading: HeadingLevel.TITLE,
            spacing: { after: 300 },
          }),
          ...allParagraphs,
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Convert Word (.docx) ArrayBuffer to PDF Blob using mammoth + jsPDF
 */
export async function convertDocxToPdf(
  docxData: ArrayBuffer,
  fileName: string = 'Document'
): Promise<{ pdfBlob: Blob; textPreview: string; htmlPreview: string }> {
  const result = await mammoth.convertToHtml({ arrayBuffer: docxData });
  const html = result.value;
  const rawTextResult = await mammoth.extractRawText({ arrayBuffer: docxData });
  const rawText = rawTextResult.value;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const maxLineWidth = pageWidth - margin * 2;

  // Header Title
  pdf.setFont('Helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(19, 27, 46);
  pdf.text(fileName.replace(/\.docx?$/i, ''), margin, margin + 5);

  pdf.setDrawColor(218, 226, 253);
  pdf.line(margin, margin + 8, pageWidth - margin, margin + 8);

  pdf.setFont('Helvetica', 'normal');
  pdf.setFontSize(10.5);
  pdf.setTextColor(51, 65, 85);

  let currentY = margin + 16;
  const lines = pdf.splitTextToSize(rawText, maxLineWidth);

  for (let i = 0; i < lines.length; i++) {
    if (currentY > pageHeight - margin - 10) {
      pdf.addPage();
      currentY = margin + 5;
    }
    pdf.text(lines[i], margin, currentY);
    currentY += 5.5;
  }

  const pdfBlob = pdf.output('blob');
  return { pdfBlob, textPreview: rawText, htmlPreview: html };
}

/**
 * Convert Images (JPG/PNG) to a single combined PDF
 */
export async function convertImagesToPdf(
  images: { file: File; dataUrl: string; width: number; height: number }[],
  options: {
    pageSize?: 'a4' | 'fit';
    orientation?: 'portrait' | 'landscape';
    marginMm?: number;
    quality?: number;
  } = {}
): Promise<Blob> {
  const { pageSize = 'a4', orientation = 'portrait', marginMm = 10, quality = 0.85 } = options;

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: pageSize === 'a4' ? 'a4' : undefined,
    compress: true,
  });

  for (let i = 0; i < images.length; i++) {
    if (i > 0) {
      pdf.addPage(pageSize === 'a4' ? 'a4' : undefined, orientation);
    }

    const img = images[i];
    const pageWidthMm = pdf.internal.pageSize.getWidth();
    const pageHeightMm = pdf.internal.pageSize.getHeight();

    const maxW = pageWidthMm - marginMm * 2;
    const maxH = pageHeightMm - marginMm * 2;

    const imgRatio = img.width / img.height;
    let renderW = maxW;
    let renderH = renderW / imgRatio;

    if (renderH > maxH) {
      renderH = maxH;
      renderW = renderH * imgRatio;
    }

    const posX = marginMm + (maxW - renderW) / 2;
    const posY = marginMm + (maxH - renderH) / 2;

    pdf.addImage(img.dataUrl, 'JPEG', posX, posY, renderW, renderH, undefined, 'FAST');
  }

  return pdf.output('blob');
}

/**
 * Merge multiple PDF documents into a single unified PDF using pdf-lib
 */
export async function mergePdfDocuments(
  pdfBuffers: { name: string; buffer: ArrayBuffer }[],
  options?: {
    title?: string;
    onProgress?: (current: number, total: number, fileName: string) => void;
  }
): Promise<{ mergedBlob: Blob; totalPages: number; sizeKb: number }> {
  const mergedPdf = await PDFDocument.create();
  if (options?.title) {
    mergedPdf.setTitle(options.title);
  }

  let totalPages = 0;
  for (let i = 0; i < pdfBuffers.length; i++) {
    const item = pdfBuffers[i];
    if (options?.onProgress) {
      options.onProgress(i + 1, pdfBuffers.length, item.name);
    }
    const srcDoc = await PDFDocument.load(item.buffer, { ignoreEncryption: true });
    const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
    for (const page of copiedPages) {
      mergedPdf.addPage(page);
      totalPages++;
    }
  }

  const mergedPdfBytes = await mergedPdf.save();
  const mergedBlob = new Blob([mergedPdfBytes as any], { type: 'application/pdf' });
  const sizeKb = Math.round(mergedBlob.size / 1024);

  return { mergedBlob, totalPages, sizeKb };
}

/**
 * Parse page range expressions like "1, 3, 5-8, 10" into 1-based page number array
 */
export function parsePageRangeString(rangeStr: string, maxPages: number): number[] {
  const clean = rangeStr.trim();
  if (!clean) return [];

  const pagesSet = new Set<number>();
  const parts = clean.split(/[,;\s]+/);

  for (const part of parts) {
    if (!part) continue;
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        const minP = Math.max(1, Math.min(start, end));
        const maxP = Math.min(maxPages, Math.max(start, end));
        for (let p = minP; p <= maxP; p++) {
          pagesSet.add(p);
        }
      }
    } else {
      const p = parseInt(part, 10);
      if (!isNaN(p) && p >= 1 && p <= maxPages) {
        pagesSet.add(p);
      }
    }
  }

  return Array.from(pagesSet).sort((a, b) => a - b);
}

/**
 * Extract selected pages (range) into a new single PDF
 */
export async function extractPdfPagesRange(
  pdfBuffer: ArrayBuffer,
  pageNumbers: number[], // 1-based index
  options?: { title?: string }
): Promise<{ pdfBlob: Blob; totalPages: number; sizeKb: number }> {
  const srcDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const totalDocPages = srcDoc.getPageCount();

  const valid0BasedIndices = pageNumbers
    .filter((p) => p >= 1 && p <= totalDocPages)
    .map((p) => p - 1);

  if (valid0BasedIndices.length === 0) {
    throw new Error('No valid pages selected for extraction.');
  }

  const outDoc = await PDFDocument.create();
  if (options?.title) {
    outDoc.setTitle(options.title);
  }

  const copiedPages = await outDoc.copyPages(srcDoc, valid0BasedIndices);
  for (const page of copiedPages) {
    outDoc.addPage(page);
  }

  const outBytes = await outDoc.save();
  const pdfBlob = new Blob([outBytes as any], { type: 'application/pdf' });
  const sizeKb = Math.round(pdfBlob.size / 1024);

  return { pdfBlob, totalPages: copiedPages.length, sizeKb };
}

/**
 * Split a multi-page PDF into separate single-page PDF files
 */
export async function splitPdfToIndividualPages(
  pdfBuffer: ArrayBuffer,
  baseFileName: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ fileName: string; blob: Blob; pageNumber: number; sizeKb: number }[]> {
  const srcDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  const cleanBase = baseFileName.replace(/\.pdf$/i, '');
  const results: { fileName: string; blob: Blob; pageNumber: number; sizeKb: number }[] = [];

  for (let i = 0; i < totalPages; i++) {
    if (onProgress) {
      onProgress(i + 1, totalPages);
    }
    const singleDoc = await PDFDocument.create();
    const [copiedPage] = await singleDoc.copyPages(srcDoc, [i]);
    singleDoc.addPage(copiedPage);

    const bytes = await singleDoc.save();
    const blob = new Blob([bytes as any], { type: 'application/pdf' });
    const sizeKb = Math.round(blob.size / 1024);
    const fileName = `${cleanBase}_Page_${i + 1}.pdf`;

    results.push({
      fileName,
      blob,
      pageNumber: i + 1,
      sizeKb,
    });
  }

  return results;
}

